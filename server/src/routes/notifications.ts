import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { emitToUser } from '../lib/realtime.js'

const prisma = new PrismaClient()
const router = Router()

// ═══════════════════════════════════════════
// GET /notifications — list mine (optionally unread-only)
// ═══════════════════════════════════════════
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const unread = req.query.unread === 'true'
  const take = Math.min(Number(req.query.limit) || 50, 200)

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.user.userId, ...(unread ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
    }),
    prisma.notification.count({
      where: { userId: req.user.userId, isRead: false },
    }),
  ])

  res.json({ notifications: items, unreadCount })
})

// ═══════════════════════════════════════════
// POST /notifications/:id/read — mark one read
// ═══════════════════════════════════════════
router.post('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const id = String(req.params.id)
  const existing = await prisma.notification.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Notification not found'))
  if (existing.userId !== req.user.userId) {
    return next(new AppError(403, 'FORBIDDEN', 'Not your notification'))
  }
  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  })
  res.json({ notification: updated })
})

// ═══════════════════════════════════════════
// POST /notifications/read-all — mark everything read
// ═══════════════════════════════════════════
router.post('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const result = await prisma.notification.updateMany({
    where: { userId: req.user.userId, isRead: false },
    data: { isRead: true },
  })
  res.json({ updated: result.count })
})

// ═══════════════════════════════════════════
// DELETE /notifications/:id — dismiss one
// ═══════════════════════════════════════════
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const id = String(req.params.id)
  const existing = await prisma.notification.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Notification not found'))
  if (existing.userId !== req.user.userId) {
    return next(new AppError(403, 'FORBIDDEN', 'Not your notification'))
  }
  await prisma.notification.delete({ where: { id } })
  res.status(204).end()
})

// ═══════════════════════════════════════════
// POST /notifications (internal — for creating system notifications)
// Restricted to MANAGER/CEO so users can't spam each other.
// ═══════════════════════════════════════════
const createSchema = z.object({
  userId: z.string().min(1),
  type: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  message: z.string().max(500).optional(),
  link: z.string().max(500).optional(),
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  if (req.user.role !== 'CEO' && req.user.role !== 'MANAGER') {
    return next(new AppError(403, 'FORBIDDEN', 'Only CEO/MANAGER can create notifications'))
  }
  const parse = createSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const notif = await prisma.notification.create({
    data: { ...parse.data, channel: 'in_app' },
  })
  emitToUser(notif.userId, 'notification:new')
  res.status(201).json({ notification: notif })
})

export { router as notificationsRouter }
