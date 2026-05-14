import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { requireManager } from '../middleware/authenticate.js'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// Design Briefs — creative work tracking.
// Schema is minimal (objective/deliverable/designer/status), so we
// derive progress from status mapping and count approval actions
// per brief as the "revision count".
//
// status values: briefing → in_progress → review → revisions → approved
// (matching the UI; mapped here to/from the DB string field).
// ───────────────────────────────────────────

const briefStatus = z.enum(['briefing', 'in_progress', 'review', 'revisions', 'approved'])

const createSchema = z.object({
  objective: z.string().min(1).max(200),
  deliverable: z.string().min(1).max(500),
  brandRefs: z.string().max(2000).nullable().optional(),
  clientId: z.string().min(1).nullable().optional(),
  designerId: z.string().min(1).nullable().optional(),
  estimatedHours: z.number().min(0).max(10_000).nullable().optional(),
  dueDate: z.string().refine((d) => !isNaN(Date.parse(d))).nullable().optional(),
  status: briefStatus.default('briefing'),
})

const updateSchema = createSchema.partial()

const STATUS_PROGRESS: Record<string, number> = {
  briefing: 10,
  in_progress: 45,
  review: 70,
  revisions: 65,
  approved: 100,
  open: 10, // legacy default
}

// ═══════════════════════════════════════════
// GET / — list all briefs with derived progress + revision count
// ═══════════════════════════════════════════
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const briefs = await prisma.designBrief.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: {
        designer: { select: { id: true, name: true, avatar: true } },
      },
    })

    // Resolve clients in batch
    const clientIds = Array.from(new Set(briefs.map((b) => b.clientId).filter((id): id is string => !!id)))
    const clients = clientIds.length
      ? await prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, company: true, contactName: true },
        })
      : []
    const clientMap = new Map(clients.map((c) => [c.id, c]))

    // Approval action counts per brief
    const briefIds = briefs.map((b) => b.id)
    const approvals = briefIds.length
      ? await prisma.approvalAction.findMany({
          where: { entityType: 'design', entityId: { in: briefIds } },
          select: { entityId: true, action: true },
        })
      : []
    const approvalsByBrief = new Map<string, { total: number; sentBack: number }>()
    for (const a of approvals) {
      const entry = approvalsByBrief.get(a.entityId) ?? { total: 0, sentBack: 0 }
      entry.total += 1
      if (a.action === 'sent_back') entry.sentBack += 1
      approvalsByBrief.set(a.entityId, entry)
    }

    const rows = briefs.map((b) => {
      const client = b.clientId ? clientMap.get(b.clientId) ?? null : null
      const approvalStats = approvalsByBrief.get(b.id) ?? { total: 0, sentBack: 0 }
      return {
        id: b.id,
        objective: b.objective,
        deliverable: b.deliverable,
        brandRefs: b.brandRefs,
        status: b.status,
        progress: STATUS_PROGRESS[b.status] ?? 30,
        clientId: b.clientId,
        client: client ? { id: client.id, company: client.company, contactName: client.contactName } : null,
        designer: b.designer,
        estimatedHours: b.estimatedHours,
        dueDate: b.dueDate ? b.dueDate.toISOString() : null,
        revisionCount: approvalStats.sentBack,
        approvalCount: approvalStats.total,
        createdAt: b.createdAt.toISOString(),
      }
    })

    const stats = {
      total: rows.length,
      active: rows.filter((r) => r.status !== 'approved').length,
      inReview: rows.filter((r) => r.status === 'review').length,
      revisions: rows.filter((r) => r.status === 'revisions').length,
      approved: rows.filter((r) => r.status === 'approved').length,
    }

    res.json({ stats, briefs: rows })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// POST / — create brief (CEO/MANAGER)
// ═══════════════════════════════════════════
router.post('/', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const parse = createSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }

  if (parse.data.clientId) {
    const client = await prisma.client.findUnique({ where: { id: parse.data.clientId } })
    if (!client) return next(new AppError(404, 'CLIENT_NOT_FOUND', 'Client not found'))
  }
  if (parse.data.designerId) {
    const designer = await prisma.user.findUnique({ where: { id: parse.data.designerId } })
    if (!designer) return next(new AppError(404, 'DESIGNER_NOT_FOUND', 'Designer not found'))
  }

  const data: Record<string, unknown> = {
    ...parse.data,
    dueDate: parse.data.dueDate ? new Date(parse.data.dueDate) : null,
  }

  const brief = await prisma.designBrief.create({
    data: data as any,
    include: { designer: { select: { id: true, name: true, avatar: true } } },
  })
  res.status(201).json({ brief })
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
  const existing = await prisma.designBrief.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Brief not found'))

  const data: Record<string, unknown> = { ...parse.data }
  if (parse.data.dueDate === null) data.dueDate = null
  else if (typeof parse.data.dueDate === 'string') data.dueDate = new Date(parse.data.dueDate)

  const brief = await prisma.designBrief.update({
    where: { id },
    data: data as any,
    include: { designer: { select: { id: true, name: true, avatar: true } } },
  })
  res.json({ brief })
})

// ═══════════════════════════════════════════
// POST /:id/approval — record an approval / send-back (any auth)
// Pushes an ApprovalAction row + auto-bumps brief status when
// stage='client' and action='approved' (terminal flow).
// ═══════════════════════════════════════════
const approvalSchema = z.object({
  stage: z.enum(['designer', 'manager', 'ceo', 'client']),
  action: z.enum(['approved', 'sent_back']),
  comment: z.string().max(2000).optional(),
})

router.post('/:id/approval', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const parse = approvalSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const id = String(req.params.id)
  const brief = await prisma.designBrief.findUnique({ where: { id } })
  if (!brief) return next(new AppError(404, 'NOT_FOUND', 'Brief not found'))

  const approval = await prisma.approvalAction.create({
    data: {
      entityType: 'design',
      entityId: id,
      stage: parse.data.stage,
      action: parse.data.action,
      comment: parse.data.comment,
      userId: req.user.userId,
    },
  })

  // Side effect on brief status — sent_back → revisions; client/CEO approved → approved
  let nextStatus: string | null = null
  if (parse.data.action === 'sent_back') nextStatus = 'revisions'
  else if (parse.data.action === 'approved' && (parse.data.stage === 'client' || parse.data.stage === 'ceo')) {
    nextStatus = 'approved'
  } else if (parse.data.action === 'approved') {
    nextStatus = 'review'
  }

  if (nextStatus) {
    await prisma.designBrief.update({ where: { id }, data: { status: nextStatus } })
  }

  res.status(201).json({ approval })
})

export { router as designBriefsRouter }
