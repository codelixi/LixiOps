import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient, LeadStage } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'

const prisma = new PrismaClient()
const router = Router()

// ═══════════════════════════════════════════
// Validation Schemas
// ═══════════════════════════════════════════

const createLeadSchema = z.object({
  company: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  vertical: z.string().max(80).optional().nullable(),
  source: z.string().max(80).optional().nullable(),
  referralSource: z.string().max(200).optional().nullable(),
  researchNotes: z.string().max(5000).optional().nullable(),
  value: z.number().min(0).default(0),
  repId: z.string().optional().nullable(),
})

const updateLeadSchema = createLeadSchema.partial()

const stageTransitionSchema = z.object({
  stage: z.nativeEnum(LeadStage),
  agreedValue: z.number().min(0).optional(),
  contractStartDate: z.string().refine((d) => !isNaN(Date.parse(d))).optional(),
  closedLostReason: z.string().max(500).optional(),
})

const convertSchema = z.object({
  projectName: z.string().min(1).max(200),
  projectType: z.string().max(100).optional(),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d))).optional(),
  goLiveDate: z.string().refine((d) => !isNaN(Date.parse(d))).optional(),
  clientAddress: z.string().max(500).optional(),
})

const activitySchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'note']),
  text: z.string().min(1).max(2000),
})

// ═══════════════════════════════════════════
// GET /leads — pipeline (grouped by stage) or flat
// ═══════════════════════════════════════════
router.get('/', async (req: Request, res: Response) => {
  const groupBy = req.query.groupBy === 'stage'
  const leads = await prisma.lead.findMany({
    include: {
      rep: { select: { id: true, name: true, email: true, avatar: true } },
      _count: { select: { activities: true, meetings: true, proposals: true } },
    },
    orderBy: { lastActivityAt: 'desc' },
  })

  if (!groupBy) return res.json({ leads })

  const grouped: Record<LeadStage, typeof leads> = {
    PROSPECT: [], CONTACTED: [], PROPOSAL_SENT: [], NEGOTIATION: [], CLOSED_WON: [], CLOSED_LOST: [],
  }
  leads.forEach((l) => grouped[l.stage].push(l))
  return res.json({ pipeline: grouped })
})

// ═══════════════════════════════════════════
// GET /leads/:id
// ═══════════════════════════════════════════
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const lead = await prisma.lead.findUnique({
    where: { id: String(req.params.id) },
    include: {
      rep: true,
      activities: { orderBy: { createdAt: 'desc' }, take: 50, include: { user: { select: { id: true, name: true, avatar: true } } } },
      meetings: { orderBy: { date: 'desc' }, take: 20 },
      proposals: { orderBy: { createdAt: 'desc' } },
      convertedProject: { select: { id: true, name: true } },
    },
  })
  if (!lead) return next(new AppError(404, 'NOT_FOUND', 'Lead not found'))
  res.json({ lead })
})

// ═══════════════════════════════════════════
// POST /leads — create
// ═══════════════════════════════════════════
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const parse = createLeadSchema.safeParse(req.body)
  if (!parse.success) return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))

  const lead = await prisma.lead.create({
    data: { ...parse.data, stage: 'PROSPECT', lastActivityAt: new Date() },
  })
  res.status(201).json({ lead })
})

// ═══════════════════════════════════════════
// PATCH /leads/:id — update basic fields
// ═══════════════════════════════════════════
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const parse = updateLeadSchema.safeParse(req.body)
  if (!parse.success) return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))

  try {
    const lead = await prisma.lead.update({
      where: { id: String(req.params.id) },
      data: { ...parse.data, lastActivityAt: new Date() },
    })
    res.json({ lead })
  } catch {
    next(new AppError(404, 'NOT_FOUND', 'Lead not found'))
  }
})

// ═══════════════════════════════════════════
// POST /leads/:id/stage — stage transition (with guards)
// ═══════════════════════════════════════════
router.post('/:id/stage', async (req: Request, res: Response, next: NextFunction) => {
  const parse = stageTransitionSchema.safeParse(req.body)
  if (!parse.success) return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))

  const lead = await prisma.lead.findUnique({ where: { id: String(req.params.id) } })
  if (!lead) return next(new AppError(404, 'NOT_FOUND', 'Lead not found'))

  const { stage, agreedValue, contractStartDate, closedLostReason } = parse.data

  // Guard: CLOSED_WON requires agreedValue
  if (stage === 'CLOSED_WON' && !agreedValue && !lead.agreedValue) {
    return next(new AppError(400, 'DEAL_VALUE_REQUIRED', 'Closed Won requires agreedValue'))
  }
  if (stage === 'CLOSED_LOST' && !closedLostReason) {
    return next(new AppError(400, 'LOST_REASON_REQUIRED', 'Closed Lost requires a reason'))
  }

  const now = new Date()
  const data: any = { stage, lastActivityAt: now }
  if (agreedValue !== undefined) data.agreedValue = agreedValue
  if (contractStartDate) data.contractStartDate = new Date(contractStartDate)
  if (stage === 'PROPOSAL_SENT') data.proposalSentAt = now
  if (stage === 'NEGOTIATION') data.negotiationStartedAt = now
  if (stage === 'CLOSED_WON') data.closedWonAt = now
  if (stage === 'CLOSED_LOST') {
    data.closedLostAt = now
    data.closedLostReason = closedLostReason
  }

  const updated = await prisma.lead.update({ where: { id: lead.id }, data })
  res.json({ lead: updated })
})

// ═══════════════════════════════════════════
// POST /leads/:id/activity — log call/email/meeting/note
// ═══════════════════════════════════════════
router.post('/:id/activity', async (req: Request, res: Response, next: NextFunction) => {
  const parse = activitySchema.safeParse(req.body)
  if (!parse.success) return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))

  const activity = await prisma.leadActivity.create({
    data: { leadId: String(req.params.id), userId: req.user.userId, ...parse.data },
  })
  await prisma.lead.update({ where: { id: String(req.params.id) }, data: { lastActivityAt: new Date() } })
  res.status(201).json({ activity })
})

// ═══════════════════════════════════════════
// POST /leads/:id/convert — Atomic: create Client + Project from Closed Won Lead
// RULE: Lead must be in CLOSED_WON stage. Cannot convert twice.
// ═══════════════════════════════════════════
router.post('/:id/convert', async (req: Request, res: Response, next: NextFunction) => {
  const parse = convertSchema.safeParse(req.body)
  if (!parse.success) return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))

  const lead = await prisma.lead.findUnique({ where: { id: String(req.params.id) } })
  if (!lead) return next(new AppError(404, 'NOT_FOUND', 'Lead not found'))

  if (lead.stage !== 'CLOSED_WON') {
    return next(new AppError(409, 'NOT_CLOSED_WON', 'Only Closed Won leads can be converted. Move the lead to Closed Won first.'))
  }
  if (lead.convertedClientId || lead.convertedProjectId) {
    return next(new AppError(409, 'ALREADY_CONVERTED', 'This lead has already been converted.'))
  }
  if (!lead.email) {
    return next(new AppError(400, 'EMAIL_REQUIRED', 'Lead email required to create Client record'))
  }

  const agreedValue = lead.agreedValue ?? lead.value ?? 0

  // Atomic transaction: Client → Project → Lead link-back
  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        company: lead.company,
        contactName: lead.contactName,
        email: lead.email!,
        phone: lead.phone,
        vertical: lead.vertical,
        status: 'active',
        contractValue: agreedValue,
      },
    })

    const project = await tx.project.create({
      data: {
        name: parse.data.projectName,
        clientId: client.id,
        leadId: lead.id,
        contractValue: agreedValue,
        startDate: parse.data.startDate ? new Date(parse.data.startDate) : lead.contractStartDate ?? new Date(),
        goLiveDate: parse.data.goLiveDate ? new Date(parse.data.goLiveDate) : null,
        health: 'ON_TRACK',
      },
    })

    const updatedLead = await tx.lead.update({
      where: { id: lead.id },
      data: { convertedClientId: client.id, convertedProjectId: project.id },
    })

    return { client, project, lead: updatedLead }
  })

  res.status(201).json(result)
})

// ═══════════════════════════════════════════
// DELETE /leads/:id — delete (only if no conversion yet)
// ═══════════════════════════════════════════
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const lead = await prisma.lead.findUnique({ where: { id: String(req.params.id) } })
  if (!lead) return next(new AppError(404, 'NOT_FOUND', 'Lead not found'))
  if (lead.convertedClientId) {
    return next(new AppError(409, 'ALREADY_CONVERTED', 'Cannot delete a converted lead. Archive it instead.'))
  }
  await prisma.lead.delete({ where: { id: lead.id } })
  res.status(204).end()
})

export { router as leadsRouter }
