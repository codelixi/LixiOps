import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'

const prisma = new PrismaClient()
const router = Router()

// ═══════════════════════════════════════════
// GET /users — lightweight directory for @mentions,
// assignee pickers, team rosters. Excludes deactivated
// users and anything beyond what the UI needs (no PII leak).
// Optional ?q=foo substring filter (case-insensitive) on name/email.
// Optional ?departmentId=xxx to scope to a department.
// ═══════════════════════════════════════════
router.get('/', async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(departmentId ? { departmentId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
    take: 200,
  })

  res.json({ users })
})

// ═══════════════════════════════════════════
// GET /users/me — current user's own profile
// ═══════════════════════════════════════════
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      phone: true,
      department: { select: { id: true, name: true } },
      lastLoginAt: true,
      createdAt: true,
    },
  })
  if (!user) return next(new AppError(404, 'NOT_FOUND', 'User not found'))

  res.json({ user })
})

// ═══════════════════════════════════════════
// PATCH /users/me — update own profile.
// Restricted to safe self-editable fields: name, phone, avatar.
// Role, email, department, isActive are changed via admin flows.
// ═══════════════════════════════════════════
const meUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  phone: z.string().max(40).nullable().optional(),
  avatar: z.string().max(500).nullable().optional(),
})

router.patch('/me', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const parse = meUpdateSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const user = await prisma.user.update({
    where: { id: req.user.userId },
    data: parse.data,
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      phone: true,
      department: { select: { id: true, name: true } },
      lastLoginAt: true,
      createdAt: true,
    },
  })
  res.json({ user })
})

// ═══════════════════════════════════════════
// GET /users/:id — public-facing fields only
// ═══════════════════════════════════════════
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const user = await prisma.user.findUnique({
    where: { id: String(req.params.id) },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      department: { select: { id: true, name: true } },
    },
  })
  if (!user || !user.id) return next(new AppError(404, 'NOT_FOUND', 'User not found'))

  res.json({ user })
})

export { router as usersRouter }
