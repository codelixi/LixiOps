import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { requireManager } from '../middleware/authenticate.js'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// Operations / Delivery Tracker — aggregates milestones across all
// projects with derived status (on-track / at-risk / overdue / completed).
//
// The Milestone model is minimal (title, isComplete, dueDate, projectId),
// so we derive progress + assignee + blockers from joined data:
//   • progress    — 100 if completed; else clamped by days-to-due
//   • assignee    — most recently active task's assignee on this project
//   • blockers    — count of open Risks + blocked Tasks on this project
//   • daysRemaining — sign-aware day delta
//   • status      — completed > overdue > at-risk (≤7d or blockers≥1) > on-track
// ───────────────────────────────────────────

const AT_RISK_DAYS = 7

interface DeliveryRow {
  id: string
  project: string
  projectId: string
  client: string
  clientId: string | null
  milestone: string
  phase: string | null
  dueDate: string | null
  status: 'on-track' | 'at-risk' | 'overdue' | 'completed'
  progress: number
  assignee: string | null
  assigneeAvatar: string | null
  daysRemaining: number | null
  blockers: number
  invoiceTriggered: boolean
}

function deriveStatus(opts: {
  isComplete: boolean
  daysRemaining: number | null
  blockers: number
}): DeliveryRow['status'] {
  if (opts.isComplete) return 'completed'
  if (opts.daysRemaining !== null && opts.daysRemaining < 0) return 'overdue'
  if (opts.blockers >= 1) return 'at-risk'
  if (opts.daysRemaining !== null && opts.daysRemaining <= AT_RISK_DAYS) return 'at-risk'
  return 'on-track'
}

function deriveProgress(opts: { isComplete: boolean; daysRemaining: number | null }): number {
  if (opts.isComplete) return 100
  if (opts.daysRemaining === null) return 50
  // The longer the runway the lower the progress. Tunable later.
  if (opts.daysRemaining <= 0) return 90
  if (opts.daysRemaining <= 3) return 80
  if (opts.daysRemaining <= 7) return 60
  if (opts.daysRemaining <= 14) return 40
  return 25
}

router.get('/deliveries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const includeCompleted = req.query.includeCompleted !== 'false'
    const now = new Date()

    const milestones = await prisma.milestone.findMany({
      where: includeCompleted ? {} : { isComplete: false },
      orderBy: [{ isComplete: 'asc' }, { dueDate: 'asc' }],
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, company: true } },
            risks: { where: { status: 'open' }, select: { id: true } },
            tasks: {
              where: { OR: [{ blockedBy: { not: null } }, { status: 'in_progress' }] },
              select: {
                id: true,
                blockedBy: true,
                status: true,
                updatedAt: true,
                assignee: { select: { id: true, name: true, avatar: true } },
              },
              orderBy: { updatedAt: 'desc' },
            },
          },
        },
      },
    })

    const rows: DeliveryRow[] = milestones.map((m) => {
      const p = m.project
      const daysRemaining = m.dueDate
        ? Math.ceil((m.dueDate.getTime() - now.getTime()) / 86_400_000)
        : null
      const blockedTasks = p.tasks.filter((t) => t.blockedBy).length
      const blockers = (p.risks?.length ?? 0) + blockedTasks
      const status = deriveStatus({ isComplete: m.isComplete, daysRemaining, blockers })
      const progress = deriveProgress({ isComplete: m.isComplete, daysRemaining })
      const recentTask = p.tasks.find((t) => t.assignee) ?? null

      return {
        id: m.id,
        project: p.name,
        projectId: p.id,
        client: p.client?.company ?? 'Unassigned',
        clientId: p.client?.id ?? null,
        milestone: m.title,
        phase: m.phase ?? null,
        dueDate: m.dueDate ? m.dueDate.toISOString() : null,
        status,
        progress,
        assignee: recentTask?.assignee?.name ?? null,
        assigneeAvatar: recentTask?.assignee?.avatar ?? null,
        daysRemaining,
        blockers,
        invoiceTriggered: m.invoiceTriggered,
      }
    })

    // Sort: overdue > at-risk > on-track > completed; within group by due date asc
    const order = { overdue: 0, 'at-risk': 1, 'on-track': 2, completed: 3 } as const
    rows.sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      return 0
    })

    const stats = {
      total: rows.length,
      active: rows.filter((r) => r.status !== 'completed').length,
      onTrack: rows.filter((r) => r.status === 'on-track').length,
      atRisk: rows.filter((r) => r.status === 'at-risk').length,
      overdue: rows.filter((r) => r.status === 'overdue').length,
      completed: rows.filter((r) => r.status === 'completed').length,
    }

    res.json({ stats, deliveries: rows })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// PATCH /milestones/:id — toggle isComplete (CEO/MANAGER)
// Sets/clears completedAt automatically.
// ═══════════════════════════════════════════
const updateMilestoneSchema = z.object({
  isComplete: z.boolean().optional(),
  title: z.string().min(1).max(200).optional(),
  dueDate: z.string().refine((d) => !isNaN(Date.parse(d))).nullable().optional(),
})

router.patch('/milestones/:id', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const parse = updateMilestoneSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const id = String(req.params.id)
  const existing = await prisma.milestone.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Milestone not found'))

  const data: Record<string, unknown> = { ...parse.data }
  if (parse.data.dueDate === null) data.dueDate = null
  else if (typeof parse.data.dueDate === 'string') data.dueDate = new Date(parse.data.dueDate)

  // Auto-stamp completedAt
  if (parse.data.isComplete === true && !existing.isComplete) {
    data.completedAt = new Date()
  }
  if (parse.data.isComplete === false && existing.isComplete) {
    data.completedAt = null
  }

  const milestone = await prisma.milestone.update({ where: { id }, data })
  res.json({ milestone })
})

export { router as operationsRouter }
