import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { requireManager, requireCEO } from '../middleware/authenticate.js'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// Decision Log — record of executive decisions with rationale and
// (eventually) an outcome. Status is derived: `pending` if `outcome`
// is null, `decided` if set. That mirrors how real decision logs
// flow — capture early, fill outcome later.
// ───────────────────────────────────────────

const categoryEnum = z.enum(['strategic', 'operational', 'financial', 'hr', 'product', 'legal'])
const impactEnum = z.enum(['low', 'medium', 'high'])

const createSchema = z.object({
  title: z.string().min(1).max(200),
  category: categoryEnum,
  impact: impactEnum,
  rationale: z.string().max(5000).optional(),
  outcome: z.string().max(5000).optional(),
})

const updateSchema = createSchema.partial()

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const decisions = await prisma.decisionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { author: { select: { id: true, name: true, avatar: true } } },
    })
    res.json({
      decisions: decisions.map((d) => ({
        ...d,
        status: d.outcome && d.outcome.trim().length > 0 ? 'decided' : 'pending',
        createdAt: d.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const parse = createSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const decision = await prisma.decisionLog.create({
    data: { ...parse.data, authorId: req.user.userId },
    include: { author: { select: { id: true, name: true, avatar: true } } },
  })
  res.status(201).json({ decision })
})

router.patch('/:id', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const parse = updateSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const id = String(req.params.id)
  const existing = await prisma.decisionLog.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Decision not found'))
  const decision = await prisma.decisionLog.update({
    where: { id },
    data: parse.data,
    include: { author: { select: { id: true, name: true, avatar: true } } },
  })
  res.json({ decision })
})

router.delete('/:id', requireCEO, async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id)
  const existing = await prisma.decisionLog.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Decision not found'))
  await prisma.decisionLog.delete({ where: { id } })
  res.status(204).end()
})

export { router as decisionsRouter }
