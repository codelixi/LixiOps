import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { requireManager, requireCEO } from '../middleware/authenticate.js'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// OKRs — strategic alignment layer on top of the workflow.
// One OKR (Objective) belongs to a Department for a quarter+year and
// contains 1..N Key Results (each with target/current/unit).
//
// Status is computed (not stored): healthy ≥ 70%, on-track ≥ 40%,
// at-risk below 40%. KR progress is min(100, current/target * 100)
// for numeric units; future-proof for boolean/% specialisations.
// ───────────────────────────────────────────

const keyResultInputSchema = z.object({
  title: z.string().min(1).max(200),
  target: z.number().min(0),
  current: z.number().min(0).default(0),
  unit: z.string().max(20).default('%'),
})

const createOkrSchema = z.object({
  objective: z.string().min(1).max(280),
  departmentId: z.string().min(1),
  quarter: z.string().min(1).max(10),
  year: z.number().int().min(2020).max(2100),
  keyResults: z.array(keyResultInputSchema).max(20).optional(),
})

const updateOkrSchema = z.object({
  objective: z.string().min(1).max(280).optional(),
  departmentId: z.string().min(1).optional(),
  quarter: z.string().min(1).max(10).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
})

const updateKrSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  target: z.number().min(0).optional(),
  current: z.number().min(0).optional(),
  unit: z.string().max(20).optional(),
})

const okrIncludes = {
  department: { select: { id: true, name: true, headId: true } },
  keyResults: { orderBy: { id: 'asc' as const } },
}

// ═══════════════════════════════════════════
// GET / — list, filterable by year / quarter / departmentId
// ═══════════════════════════════════════════
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined
    const quarter = typeof req.query.quarter === 'string' ? req.query.quarter : undefined
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined

    const okrs = await prisma.oKR.findMany({
      where: {
        ...(year ? { year } : {}),
        ...(quarter ? { quarter } : {}),
        ...(departmentId ? { departmentId } : {}),
      },
      orderBy: [{ year: 'desc' }, { quarter: 'asc' }, { createdAt: 'desc' }],
      include: okrIncludes,
    })

    // Resolve department heads for owner display in one batch query
    const headIds = Array.from(
      new Set(okrs.map((o) => o.department?.headId).filter((id): id is string => !!id)),
    )
    const heads = headIds.length
      ? await prisma.user.findMany({
          where: { id: { in: headIds } },
          select: { id: true, name: true, avatar: true },
        })
      : []
    const headMap = new Map(heads.map((h) => [h.id, h]))

    res.json({
      okrs: okrs.map((o) => ({
        ...o,
        owner: o.department?.headId ? headMap.get(o.department.headId) ?? null : null,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// GET /:id — single OKR
// ═══════════════════════════════════════════
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id)
  const okr = await prisma.oKR.findUnique({
    where: { id },
    include: okrIncludes,
  })
  if (!okr) return next(new AppError(404, 'NOT_FOUND', 'OKR not found'))
  res.json({ okr })
})

// ═══════════════════════════════════════════
// POST / — create OKR + initial KRs (CEO/MANAGER)
// ═══════════════════════════════════════════
router.post('/', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const parse = createOkrSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }

  const dept = await prisma.department.findUnique({ where: { id: parse.data.departmentId } })
  if (!dept) return next(new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found'))

  try {
    const okr = await prisma.oKR.create({
      data: {
        objective: parse.data.objective,
        departmentId: parse.data.departmentId,
        quarter: parse.data.quarter,
        year: parse.data.year,
        keyResults: parse.data.keyResults
          ? {
              create: parse.data.keyResults.map((kr) => ({
                title: kr.title,
                target: kr.target,
                current: kr.current,
                unit: kr.unit,
              })),
            }
          : undefined,
      },
      include: okrIncludes,
    })
    res.status(201).json({ okr })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// PATCH /:id — update objective metadata (CEO/MANAGER)
// ═══════════════════════════════════════════
router.patch('/:id', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const parse = updateOkrSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const id = String(req.params.id)
  const existing = await prisma.oKR.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'OKR not found'))

  if (parse.data.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: parse.data.departmentId } })
    if (!dept) return next(new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found'))
  }

  const okr = await prisma.oKR.update({
    where: { id },
    data: parse.data,
    include: okrIncludes,
  })
  res.json({ okr })
})

// ═══════════════════════════════════════════
// DELETE /:id — remove OKR (CEO only). KRs cascade via Prisma onDelete.
// ═══════════════════════════════════════════
router.delete('/:id', requireCEO, async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id)
  const existing = await prisma.oKR.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'OKR not found'))
  await prisma.oKR.delete({ where: { id } })
  res.status(204).end()
})

// ═══════════════════════════════════════════
// POST /:id/key-results — append KR to existing OKR (CEO/MANAGER)
// ═══════════════════════════════════════════
router.post('/:id/key-results', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const parse = keyResultInputSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const okrId = String(req.params.id)
  const existing = await prisma.oKR.findUnique({ where: { id: okrId } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'OKR not found'))

  const kr = await prisma.keyResult.create({
    data: {
      okrId,
      title: parse.data.title,
      target: parse.data.target,
      current: parse.data.current,
      unit: parse.data.unit,
    },
  })
  res.status(201).json({ keyResult: kr })
})

// ═══════════════════════════════════════════
// PATCH /key-results/:id — update progress (any authenticated user)
// Anyone with access can move progress; full edits restricted by frontend UX.
// ═══════════════════════════════════════════
router.patch('/key-results/:id', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const parse = updateKrSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const id = String(req.params.id)
  const existing = await prisma.keyResult.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Key result not found'))

  // Privilege check on structural fields (title, target, unit). Anyone may move `current`.
  const isStructural =
    parse.data.title !== undefined || parse.data.target !== undefined || parse.data.unit !== undefined
  if (isStructural && req.user.role !== 'CEO' && req.user.role !== 'MANAGER') {
    return next(new AppError(403, 'FORBIDDEN', 'Only CEO/MANAGER can edit KR structure'))
  }

  const kr = await prisma.keyResult.update({ where: { id }, data: parse.data })
  res.json({ keyResult: kr })
})

// ═══════════════════════════════════════════
// DELETE /key-results/:id — remove KR (CEO/MANAGER)
// ═══════════════════════════════════════════
router.delete('/key-results/:id', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id)
  const existing = await prisma.keyResult.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Key result not found'))
  await prisma.keyResult.delete({ where: { id } })
  res.status(204).end()
})

export { router as okrsRouter }
