import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { requireManager, requireCEO } from '../middleware/authenticate.js'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// Departments — full CRUD plus an aggregated overview that joins
// members, OKR progress, active task fan-out, and budget.
//
// Status is computed: 'healthy' if utilization < 85 and OKR progress
// >= 60; 'needs-attention' if either threshold trips; 'critical' when
// both do or OKR progress < 40.
// ───────────────────────────────────────────

const HOURS_PER_WEEK = 40

const createSchema = z.object({
  name: z.string().min(1).max(80),
  headId: z.string().min(1).nullable().optional(),
  budget: z.number().min(0).optional(),
  description: z.string().max(500).nullable().optional(),
})

const updateSchema = createSchema.partial()

interface AggregateDept {
  id: string
  name: string
  description: string | null
  budget: number
  headId: string | null
  head: { id: string; name: string; role: string; avatar: string | null } | null
  members: number
  activeProjects: number
  okrProgress: number
  utilization: number
  status: 'healthy' | 'needs-attention' | 'critical'
}

function krProgress(target: number, current: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

function deriveStatus(utilization: number, okrProgress: number): AggregateDept['status'] {
  if (okrProgress < 40 || utilization >= 100) return 'critical'
  if (utilization >= 85 || okrProgress < 60) return 'needs-attention'
  return 'healthy'
}

// ═══════════════════════════════════════════
// GET / — list with aggregated rollups
// ═══════════════════════════════════════════
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        members: { select: { id: true } },
        okrs: { select: { keyResults: { select: { target: true, current: true } } } },
        tasks: { where: { status: { in: ['todo', 'in_progress', 'in_review'] } }, select: { projectId: true } },
      },
    })

    // Resolve heads in one batched query
    const headIds = Array.from(
      new Set(departments.map((d) => d.headId).filter((id): id is string => !!id)),
    )
    const heads = headIds.length
      ? await prisma.user.findMany({
          where: { id: { in: headIds } },
          select: { id: true, name: true, role: true, avatar: true },
        })
      : []
    const headMap = new Map(heads.map((h) => [h.id, h]))

    // Utilization needs time entries for the current week, grouped by user.departmentId.
    const weekStart = new Date(Date.now() - 7 * 86_400_000)
    const timeEntries = await prisma.timeEntry.findMany({
      where: { date: { gte: weekStart } },
      select: { hours: true, user: { select: { departmentId: true } } },
    })
    const hoursByDept = new Map<string, number>()
    for (const t of timeEntries) {
      const did = t.user?.departmentId
      if (!did) continue
      hoursByDept.set(did, (hoursByDept.get(did) ?? 0) + t.hours)
    }

    const out: AggregateDept[] = departments.map((d) => {
      // OKR progress = avg of KR progress across all OKRs in this dept
      const allKrs = d.okrs.flatMap((o) => o.keyResults)
      const okrProgress =
        allKrs.length > 0
          ? Math.round(allKrs.reduce((s, kr) => s + krProgress(kr.target, kr.current), 0) / allKrs.length)
          : 0

      const activeProjects = new Set(d.tasks.map((t) => t.projectId).filter((p): p is string => !!p)).size

      const hours = hoursByDept.get(d.id) ?? 0
      const capacity = Math.max(d.members.length, 1) * HOURS_PER_WEEK
      const utilization = Math.min(100, Math.round((hours / capacity) * 100))

      return {
        id: d.id,
        name: d.name,
        description: d.description,
        budget: d.budget,
        headId: d.headId,
        head: d.headId ? headMap.get(d.headId) ?? null : null,
        members: d.members.length,
        activeProjects,
        okrProgress,
        utilization,
        status: deriveStatus(utilization, okrProgress),
      }
    })

    res.json({ departments: out })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// GET /:id — single department detail with members + OKRs
// ═══════════════════════════════════════════
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id)
  const dept = await prisma.department.findUnique({
    where: { id },
    include: {
      members: { select: { id: true, name: true, email: true, role: true, avatar: true, isActive: true } },
      okrs: {
        select: { id: true, objective: true, quarter: true, year: true, keyResults: true },
        orderBy: [{ year: 'desc' }, { quarter: 'asc' }],
      },
    },
  })
  if (!dept) return next(new AppError(404, 'NOT_FOUND', 'Department not found'))

  const head = dept.headId
    ? await prisma.user.findUnique({
        where: { id: dept.headId },
        select: { id: true, name: true, role: true, avatar: true, email: true },
      })
    : null

  res.json({ department: { ...dept, head } })
})

// ═══════════════════════════════════════════
// POST / — create (CEO/MANAGER)
// ═══════════════════════════════════════════
router.post('/', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const parse = createSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }

  if (parse.data.headId) {
    const head = await prisma.user.findUnique({ where: { id: parse.data.headId } })
    if (!head) return next(new AppError(404, 'HEAD_NOT_FOUND', 'Head user not found'))
  }

  try {
    const department = await prisma.department.create({
      data: {
        name: parse.data.name,
        headId: parse.data.headId ?? null,
        budget: parse.data.budget ?? 0,
        description: parse.data.description ?? null,
      },
    })
    res.status(201).json({ department })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return next(new AppError(409, 'CONFLICT', 'A department with that name already exists'))
    }
    next(err)
  }
})

// ═══════════════════════════════════════════
// PATCH /:id — update (CEO/MANAGER)
// ═══════════════════════════════════════════
router.patch('/:id', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const parse = updateSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const id = String(req.params.id)
  const existing = await prisma.department.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Department not found'))

  if (parse.data.headId) {
    const head = await prisma.user.findUnique({ where: { id: parse.data.headId } })
    if (!head) return next(new AppError(404, 'HEAD_NOT_FOUND', 'Head user not found'))
  }

  try {
    const department = await prisma.department.update({
      where: { id },
      data: parse.data,
    })
    res.json({ department })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return next(new AppError(409, 'CONFLICT', 'A department with that name already exists'))
    }
    next(err)
  }
})

// ═══════════════════════════════════════════
// DELETE /:id — CEO only; refuses if any members / OKRs / tasks still attached.
// Forces explicit cleanup rather than silently orphaning data.
// ═══════════════════════════════════════════
router.delete('/:id', requireCEO, async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id)
  const existing = await prisma.department.findUnique({
    where: { id },
    include: {
      _count: { select: { members: true, okrs: true, tasks: true } },
    },
  })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Department not found'))

  if (existing._count.members > 0 || existing._count.okrs > 0 || existing._count.tasks > 0) {
    return next(
      new AppError(
        409,
        'DEPARTMENT_NOT_EMPTY',
        `Cannot delete — still attached to ${existing._count.members} member(s), ${existing._count.okrs} OKR(s), ${existing._count.tasks} task(s).`,
      ),
    )
  }

  await prisma.department.delete({ where: { id } })
  res.status(204).end()
})

// ═══════════════════════════════════════════
// POST /:id/members — assign a user (CEO/MANAGER)
// PATCH on the user is the underlying op; departmentId is single-valued
// so re-assigning automatically removes from the previous dept.
// ═══════════════════════════════════════════
const memberSchema = z.object({ userId: z.string().min(1) })

router.post('/:id/members', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const parse = memberSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'userId is required'))
  }
  const id = String(req.params.id)
  const dept = await prisma.department.findUnique({ where: { id } })
  if (!dept) return next(new AppError(404, 'NOT_FOUND', 'Department not found'))
  const user = await prisma.user.findUnique({ where: { id: parse.data.userId } })
  if (!user) return next(new AppError(404, 'USER_NOT_FOUND', 'User not found'))

  const updated = await prisma.user.update({
    where: { id: parse.data.userId },
    data: { departmentId: id },
    select: { id: true, name: true, email: true, role: true, avatar: true, departmentId: true },
  })
  res.json({ user: updated })
})

// ═══════════════════════════════════════════
// DELETE /:id/members/:userId — remove user from dept (sets departmentId=null)
// ═══════════════════════════════════════════
router.delete('/:id/members/:userId', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id)
  const userId = String(req.params.userId)
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return next(new AppError(404, 'USER_NOT_FOUND', 'User not found'))
  if (user.departmentId !== id) {
    return next(new AppError(409, 'NOT_MEMBER', 'User is not a member of this department'))
  }
  await prisma.user.update({ where: { id: userId }, data: { departmentId: null } })
  res.status(204).end()
})

export { router as departmentsRouter }
