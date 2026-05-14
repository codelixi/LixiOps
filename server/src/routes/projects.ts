import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'

const prisma = new PrismaClient()
const router = Router()

// ═══════════════════════════════════════════
// Validation Schemas
// ═══════════════════════════════════════════

const milestoneSchema = z.object({
  title: z.string().min(1).max(200),
  dueDate: z.string().refine((d) => !isNaN(Date.parse(d))).optional(),
  phase: z.string().max(80).optional(),
})

const createProjectSchema = z.object({
  leadId: z.string().min(1, 'leadId is required — projects must originate from a Closed Won deal'),
  name: z.string().min(1).max(200),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d))).optional(),
  goLiveDate: z.string().refine((d) => !isNaN(Date.parse(d))).optional(),
  milestones: z.array(milestoneSchema).optional(),
})

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  health: z.enum(['ON_TRACK', 'AT_RISK', 'DELAYED', 'COMPLETED']).optional(),
  progress: z.number().min(0).max(100).optional(),
  goLiveDate: z.string().refine((d) => !isNaN(Date.parse(d))).optional(),
})

// ═══════════════════════════════════════════
// GET /projects
// ═══════════════════════════════════════════
router.get('/', async (_req: Request, res: Response) => {
  const projects = await prisma.project.findMany({
    include: {
      client: { select: { id: true, company: true, email: true } },
      lead: { select: { id: true, company: true, agreedValue: true } },
      _count: { select: { tasks: true, milestones: true, risks: true, invoices: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ projects })
})

// ═══════════════════════════════════════════
// GET /projects/:id
// ═══════════════════════════════════════════
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const project = await prisma.project.findUnique({
    where: { id: String(req.params.id) },
    include: {
      client: true,
      lead: { select: { id: true, company: true, agreedValue: true, closedWonAt: true } },
      milestones: { orderBy: { sortOrder: 'asc' } },
      tasks: { take: 50, orderBy: { updatedAt: 'desc' } },
      risks: { where: { status: { not: 'closed' } } },
      profitability: true,
      invoices: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!project) return next(new AppError(404, 'NOT_FOUND', 'Project not found'))
  res.json({ project })
})

// ═══════════════════════════════════════════
// POST /projects — create (ENFORCES no project without Closed Won lead)
// ═══════════════════════════════════════════
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const parse = createProjectSchema.safeParse(req.body)
  if (!parse.success) return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))

  // Guard: the lead must be CLOSED_WON and not yet converted
  const lead = await prisma.lead.findUnique({ where: { id: parse.data.leadId } })
  if (!lead) return next(new AppError(404, 'LEAD_NOT_FOUND', 'Deal/Lead not found'))
  if (lead.stage !== 'CLOSED_WON') {
    return next(new AppError(409, 'LEAD_NOT_CLOSED_WON', 'Project can only be created from a Closed Won deal'))
  }
  if (lead.convertedProjectId) {
    return next(new AppError(409, 'LEAD_ALREADY_CONVERTED', 'This deal already has a project'))
  }
  if (!lead.convertedClientId) {
    return next(new AppError(409, 'CLIENT_NOT_CREATED', 'Use POST /leads/:id/convert to create Client + Project atomically'))
  }

  const project = await prisma.project.create({
    data: {
      name: parse.data.name,
      clientId: lead.convertedClientId,
      leadId: lead.id,
      contractValue: lead.agreedValue ?? lead.value,
      startDate: parse.data.startDate ? new Date(parse.data.startDate) : lead.contractStartDate ?? new Date(),
      goLiveDate: parse.data.goLiveDate ? new Date(parse.data.goLiveDate) : null,
      milestones: parse.data.milestones?.length
        ? {
            create: parse.data.milestones.map((m, i) => ({
              title: m.title,
              phase: m.phase,
              dueDate: m.dueDate ? new Date(m.dueDate) : null,
              sortOrder: i,
            })),
          }
        : undefined,
    },
    include: { milestones: true },
  })

  await prisma.lead.update({
    where: { id: lead.id },
    data: { convertedProjectId: project.id },
  })

  res.status(201).json({ project })
})

// ═══════════════════════════════════════════
// PATCH /projects/:id
// ═══════════════════════════════════════════
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const parse = updateProjectSchema.safeParse(req.body)
  if (!parse.success) return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))

  try {
    const data: any = { ...parse.data }
    if (parse.data.goLiveDate) data.goLiveDate = new Date(parse.data.goLiveDate)
    const project = await prisma.project.update({ where: { id: String(req.params.id) }, data })
    res.json({ project })
  } catch {
    next(new AppError(404, 'NOT_FOUND', 'Project not found'))
  }
})

// ═══════════════════════════════════════════
// POST /projects/:id/milestones/:mid/complete
// ═══════════════════════════════════════════
router.post('/:id/milestones/:mid/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const m = await prisma.milestone.update({
      where: { id: String(req.params.mid) },
      data: { isComplete: true, completedAt: new Date() },
    })
    res.json({ milestone: m })
  } catch {
    next(new AppError(404, 'NOT_FOUND', 'Milestone not found'))
  }
})

export { router as projectsRouter }
