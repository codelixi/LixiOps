import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { requireManager, requireCEO } from '../middleware/authenticate.js'
import { emitToUser, emitToUsers } from '../lib/realtime.js'
import { sendEmail, buildEmail } from '../lib/email.js'
import { env } from '../lib/env.js'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// Broadcasts — company-wide / department / individual announcements.
// Each broadcast fans out BroadcastReceipt rows on create so we can
// track read + acknowledged state per recipient.
// ───────────────────────────────────────────

const typeEnum = z.enum(['announcement', 'urgent', 'update'])
const recipientTypeEnum = z.enum(['all', 'department', 'individual'])

const createSchema = z.object({
  type: typeEnum,
  message: z.string().min(1).max(5000),
  recipientType: recipientTypeEnum.default('all'),
  recipientId: z.string().min(1).optional(), // departmentId or userId depending on recipientType
  isPinned: z.boolean().default(false),
  requiresAck: z.boolean().default(false),
})

const updateSchema = z.object({
  isPinned: z.boolean().optional(),
  message: z.string().min(1).max(5000).optional(),
})

// ─── Helpers ──────────────────────────────────

async function resolveRecipients(
  recipientType: 'all' | 'department' | 'individual',
  recipientId: string | undefined,
): Promise<string[]> {
  if (recipientType === 'all') {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    })
    return users.map((u) => u.id)
  }
  if (recipientType === 'department') {
    if (!recipientId) return []
    const users = await prisma.user.findMany({
      where: { isActive: true, departmentId: recipientId },
      select: { id: true },
    })
    return users.map((u) => u.id)
  }
  if (recipientType === 'individual') {
    if (!recipientId) return []
    const u = await prisma.user.findUnique({ where: { id: recipientId }, select: { id: true, isActive: true } })
    return u && u.isActive ? [u.id] : []
  }
  return []
}

// ═══════════════════════════════════════════
// GET / — list broadcasts with author + read/ack stats + caller's receipt
// Pinned first, then newest first.
// ═══════════════════════════════════════════
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
    const broadcasts = await prisma.broadcast.findMany({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      include: {
        author: { select: { id: true, name: true, avatar: true, role: true } },
        receipts: {
          select: { userId: true, acknowledged: true, readAt: true, acknowledgedAt: true },
        },
      },
    })

    const userId = req.user.userId
    const out = broadcasts.map((b) => {
      const totalRecipients = b.receipts.length
      const readCount = b.receipts.filter((r) => r.readAt !== null).length
      const ackCount = b.receipts.filter((r) => r.acknowledged).length
      const myReceipt = b.receipts.find((r) => r.userId === userId) ?? null
      // Drop full receipts payload — keep response lean
      const { receipts: _drop, ...rest } = b
      return {
        ...rest,
        author: b.author,
        totalRecipients,
        readCount,
        ackCount,
        myReceipt: myReceipt
          ? {
              read: myReceipt.readAt !== null,
              acknowledged: myReceipt.acknowledged,
              readAt: myReceipt.readAt?.toISOString() ?? null,
              acknowledgedAt: myReceipt.acknowledgedAt?.toISOString() ?? null,
            }
          : null,
        createdAt: b.createdAt.toISOString(),
      }
    })

    res.json({ broadcasts: out })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// POST / — create + fan out receipts (CEO/MANAGER)
// ═══════════════════════════════════════════
router.post('/', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const parse = createSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }

  const recipientUserIds = await resolveRecipients(parse.data.recipientType, parse.data.recipientId)
  if (recipientUserIds.length === 0) {
    return next(new AppError(400, 'NO_RECIPIENTS', 'No active users match the recipient selection'))
  }

  const broadcast = await prisma.broadcast.create({
    data: {
      authorId: req.user.userId,
      type: parse.data.type,
      message: parse.data.message,
      recipientType: parse.data.recipientType,
      recipientId: parse.data.recipientId,
      isPinned: parse.data.isPinned,
      requiresAck: parse.data.requiresAck,
      receipts: {
        create: recipientUserIds.map((uid) => ({ userId: uid })),
      },
    },
    include: { author: { select: { id: true, name: true, avatar: true, role: true } } },
  })

  // Push a notification per recipient so the bell badge updates instantly.
  const otherRecipientIds = recipientUserIds.filter((uid) => uid !== req.user!.userId)
  await prisma.notification.createMany({
    data: otherRecipientIds.map((uid) => ({
      userId: uid,
      type: parse.data.type === 'urgent' ? 'broadcast_urgent' : 'broadcast',
      title:
        parse.data.type === 'urgent'
          ? `Urgent broadcast from ${broadcast.author.name}`
          : `New broadcast from ${broadcast.author.name}`,
      message: parse.data.message.slice(0, 200),
      link: '/broadcasts',
      channel: 'in_app',
    })),
  })
  emitToUsers(otherRecipientIds, 'notification:new')

  // For URGENT broadcasts also send email — in-app bell isn't enough.
  if (parse.data.type === 'urgent' && otherRecipientIds.length > 0) {
    const recipients = await prisma.user.findMany({
      where: { id: { in: otherRecipientIds } },
      select: { email: true, name: true },
    })
    const broadcastsUrl = `${env.CORS_ORIGIN}/broadcasts`
    for (const r of recipients) {
      void sendEmail({
        to: r.email,
        subject: `[Urgent] ${broadcast.author.name} sent a broadcast`,
        html: buildEmail({
          heading: 'Urgent broadcast',
          body: `
            <p>${broadcast.author.name} sent an urgent broadcast you should see right away:</p>
            <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #ff5b01;background:#fafafa;color:#262626;border-radius:0 8px 8px 0;font-size:14px;line-height:1.5;">
              ${parse.data.message
                .slice(0, 1000)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>')}
            </blockquote>
          `,
          cta: { label: 'Open in LixiOps', url: broadcastsUrl },
          footer: 'Urgent broadcasts are also delivered by email so you see them off-app.',
        }),
      })
    }
  }

  res.status(201).json({ broadcast })
})

// ═══════════════════════════════════════════
// PATCH /:id — pin / edit message (CEO/MANAGER)
// ═══════════════════════════════════════════
router.patch('/:id', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const parse = updateSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const id = String(req.params.id)
  const existing = await prisma.broadcast.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Broadcast not found'))
  const broadcast = await prisma.broadcast.update({ where: { id }, data: parse.data })
  res.json({ broadcast })
})

// ═══════════════════════════════════════════
// DELETE /:id — CEO only. Receipts cascade via Prisma.
// ═══════════════════════════════════════════
router.delete('/:id', requireCEO, async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id)
  const existing = await prisma.broadcast.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Broadcast not found'))
  await prisma.broadcast.delete({ where: { id } })
  res.status(204).end()
})

// ═══════════════════════════════════════════
// POST /:id/read — mark this user's receipt as read
// ═══════════════════════════════════════════
router.post('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const id = String(req.params.id)
  const receipt = await prisma.broadcastReceipt.findUnique({
    where: { broadcastId_userId: { broadcastId: id, userId: req.user.userId } },
  })
  if (!receipt) return next(new AppError(404, 'NOT_RECIPIENT', 'Not a recipient of this broadcast'))
  if (receipt.readAt) return res.json({ receipt })
  const updated = await prisma.broadcastReceipt.update({
    where: { id: receipt.id },
    data: { readAt: new Date() },
  })
  res.json({ receipt: updated })
})

// ═══════════════════════════════════════════
// POST /:id/ack — acknowledge (auto-marks read too).
// Pings the author so they can see the ack came in.
// ═══════════════════════════════════════════
router.post('/:id/ack', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const id = String(req.params.id)
  const broadcast = await prisma.broadcast.findUnique({ where: { id } })
  if (!broadcast) return next(new AppError(404, 'NOT_FOUND', 'Broadcast not found'))
  const receipt = await prisma.broadcastReceipt.findUnique({
    where: { broadcastId_userId: { broadcastId: id, userId: req.user.userId } },
  })
  if (!receipt) return next(new AppError(404, 'NOT_RECIPIENT', 'Not a recipient of this broadcast'))
  const now = new Date()
  const updated = await prisma.broadcastReceipt.update({
    where: { id: receipt.id },
    data: {
      acknowledged: true,
      acknowledgedAt: now,
      readAt: receipt.readAt ?? now,
    },
  })
  // Let the author know in real-time
  emitToUser(broadcast.authorId, 'broadcast:ack', { broadcastId: id, userId: req.user.userId })
  res.json({ receipt: updated })
})

export { router as broadcastsRouter }
