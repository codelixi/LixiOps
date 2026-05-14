import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'

const prisma = new PrismaClient()
const router = Router()

// ═══════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════

const levelEnum = z.enum(['low', 'medium', 'high'])
const statusEnum = z.enum(['open', 'mitigated', 'accepted', 'closed'])

const createRiskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(40), // technical, client, timeline, financial, compliance, operational, legal, strategic
  likelihood: levelEnum,
  impact: levelEnum,
  mitigation: z.string().max(2000).optional(),
  ownerId: z.string().optional(),
})

const updateRiskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(40).optional(),
  likelihood: levelEnum.optional(),
  impact: levelEnum.optional(),
  mitigation: z.string().max(2000).nullable().optional(),
  ownerId: z.string().nullable().optional(),
  status: statusEnum.optional(),
})

// likelihood × impact → score (1–9). Used to sort / flag severity.
function computeRiskScore(likelihood: string, impact: string): number {
  const map: Record<string, number> = { low: 1, medium: 2, high: 3 }
  return (map[likelihood] ?? 1) * (map[impact] ?? 1)
}

// ═══════════════════════════════════════════
// GET /risks — org-wide register (with optional ?projectId)
// ═══════════════════════════════════════════
router.get('/', async (req: Request, res: Response) => {
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined
  const status = typeof req.query.status === 'string' ? req.query.status : undefined

  const risks = await prisma.risk.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      owner: { select: { id: true, name: true, avatar: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
  })

  res.json({ risks })
})

// ═══════════════════════════════════════════
// GET /risks/:id
// ═══════════════════════════════════════════
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const risk = await prisma.risk.findUnique({
    where: { id: String(req.params.id) },
    include: {
      owner: { select: { id: true, name: true, avatar: true } },
      project: { select: { id: true, name: true } },
    },
  })
  if (!risk) return next(new AppError(404, 'NOT_FOUND', 'Risk not found'))
  res.json({ risk })
})

// ═══════════════════════════════════════════
// POST /risks — create
// ═══════════════════════════════════════════
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const parse = createRiskSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }

  // Project must exist — risks are always scoped to a project
  const project = await prisma.project.findUnique({ where: { id: parse.data.projectId } })
  if (!project) return next(new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found'))

  const risk = await prisma.risk.create({
    data: {
      ...parse.data,
      riskScore: computeRiskScore(parse.data.likelihood, parse.data.impact),
    },
    include: {
      owner: { select: { id: true, name: true, avatar: true } },
      project: { select: { id: true, name: true } },
    },
  })
  res.status(201).json({ risk })
})

// ═══════════════════════════════════════════
// PATCH /risks/:id — update (recomputes riskScore if likelihood/impact changed)
// ═══════════════════════════════════════════
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const parse = updateRiskSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }

  const existing = await prisma.risk.findUnique({ where: { id: String(req.params.id) } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Risk not found'))

  const nextLikelihood = parse.data.likelihood ?? existing.likelihood
  const nextImpact = parse.data.impact ?? existing.impact
  const recompute =
    parse.data.likelihood !== undefined || parse.data.impact !== undefined
      ? { riskScore: computeRiskScore(nextLikelihood, nextImpact) }
      : {}

  const risk = await prisma.risk.update({
    where: { id: existing.id },
    data: { ...parse.data, ...recompute },
    include: {
      owner: { select: { id: true, name: true, avatar: true } },
      project: { select: { id: true, name: true } },
    },
  })
  res.json({ risk })
})

// ═══════════════════════════════════════════
// DELETE /risks/:id
// ═══════════════════════════════════════════
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const existing = await prisma.risk.findUnique({ where: { id: String(req.params.id) } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Risk not found'))
  await prisma.risk.delete({ where: { id: existing.id } })
  res.status(204).end()
})

export { router as risksRouter }
