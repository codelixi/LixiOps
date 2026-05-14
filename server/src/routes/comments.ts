import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient, CommentEntity } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { emitToEntity, emitToUsers } from '../lib/realtime.js'

const prisma = new PrismaClient()
const router = Router()

// ═══════════════════════════════════════════
// Validation Schemas
// ═══════════════════════════════════════════

const entityQuerySchema = z.object({
  entityType: z.nativeEnum(CommentEntity),
  entityId: z.string().min(1),
})

const createCommentSchema = z.object({
  entityType: z.nativeEnum(CommentEntity),
  entityId: z.string().min(1),
  body: z.string().min(1).max(10_000),
  parentId: z.string().optional(),
})

const updateCommentSchema = z.object({
  body: z.string().min(1).max(10_000),
})

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

// Parse @mentions: @userId or @Name (we support both — @userId is precise, @Name resolves by lookup)
// Format used by frontend: `@[Name](userId)` (stable machine+human form)
const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g

function extractMentionedUserIds(body: string): string[] {
  const ids = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = MENTION_RE.exec(body)) !== null) {
    ids.add(m[2])
  }
  return Array.from(ids)
}

async function notifyMentioned(opts: {
  mentionedUserIds: string[]
  authorId: string
  authorName: string
  entityType: CommentEntity
  entityId: string
  snippet: string
}) {
  const { mentionedUserIds, authorId, authorName, entityType, entityId, snippet } = opts
  if (mentionedUserIds.length === 0) return

  const link = `/${entityType.toLowerCase()}s/${entityId}`
  await prisma.notification.createMany({
    data: mentionedUserIds
      .filter((uid) => uid !== authorId) // don't notify self
      .map((uid) => ({
        userId: uid,
        type: 'mention',
        title: `${authorName} mentioned you`,
        message: snippet.slice(0, 200),
        link,
        channel: 'in_app',
      })),
  })
}

// ═══════════════════════════════════════════
// GET /comments?entityType=PROJECT&entityId=xxx — fetch thread
// ═══════════════════════════════════════════
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const parse = entityQuerySchema.safeParse({
    entityType: req.query.entityType,
    entityId: req.query.entityId,
  })
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'entityType and entityId are required'))
  }

  const comments = await prisma.comment.findMany({
    where: { entityType: parse.data.entityType, entityId: parse.data.entityId, parentId: null },
    orderBy: { createdAt: 'asc' },
    include: {
      replies: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  // Collect all authorIds for user lookup
  const authorIds = new Set<string>()
  comments.forEach((c) => {
    authorIds.add(c.authorId)
    c.replies.forEach((r) => authorIds.add(r.authorId))
  })
  const authors = await prisma.user.findMany({
    where: { id: { in: Array.from(authorIds) } },
    select: { id: true, name: true, email: true, avatar: true, role: true },
  })
  const authorMap = new Map(authors.map((a) => [a.id, a]))

  const enriched = comments.map((c) => ({
    ...c,
    author: authorMap.get(c.authorId) ?? null,
    replies: c.replies.map((r) => ({ ...r, author: authorMap.get(r.authorId) ?? null })),
  }))

  res.json({ comments: enriched })
})

// ═══════════════════════════════════════════
// POST /comments — create
// ═══════════════════════════════════════════
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const parse = createCommentSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }

  const { entityType, entityId, body, parentId } = parse.data
  const mentioned = extractMentionedUserIds(body)

  // If parentId is provided, verify it belongs to the same entity (no cross-entity threading)
  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId } })
    if (!parent) return next(new AppError(404, 'PARENT_NOT_FOUND', 'Parent comment not found'))
    if (parent.entityType !== entityType || parent.entityId !== entityId) {
      return next(new AppError(400, 'PARENT_MISMATCH', 'Reply entity must match parent'))
    }
  }

  const comment = await prisma.comment.create({
    data: {
      entityType,
      entityId,
      authorId: req.user.userId,
      body,
      mentions: mentioned.length > 0 ? mentioned : undefined,
      parentId,
    },
  })

  // Fire-and-forget notifications for @mentions
  const author = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { id: true, name: true, avatar: true, email: true },
  })
  if (author && mentioned.length > 0) {
    await notifyMentioned({
      mentionedUserIds: mentioned,
      authorId: author.id,
      authorName: author.name,
      entityType,
      entityId,
      snippet: body.replace(MENTION_RE, '@$1'),
    })
    // Push notification refresh to each mentioned user (excluding self)
    emitToUsers(
      mentioned.filter((uid) => uid !== author.id),
      'notification:new',
    )
  }

  // Notify anyone viewing this entity's comment thread
  emitToEntity(entityType, entityId, 'comment:new', { id: comment.id })

  res.status(201).json({ comment: { ...comment, author } })
})

// ═══════════════════════════════════════════
// PATCH /comments/:id — edit (only author)
// ═══════════════════════════════════════════
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const parse = updateCommentSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }

  const existing = await prisma.comment.findUnique({ where: { id: String(req.params.id) } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Comment not found'))
  if (existing.authorId !== req.user.userId) {
    return next(new AppError(403, 'FORBIDDEN', 'You can only edit your own comments'))
  }

  const mentioned = extractMentionedUserIds(parse.data.body)
  const updated = await prisma.comment.update({
    where: { id: existing.id },
    data: { body: parse.data.body, mentions: mentioned.length > 0 ? mentioned : undefined, editedAt: new Date() },
  })
  emitToEntity(existing.entityType, existing.entityId, 'comment:updated', { id: updated.id })
  res.json({ comment: updated })
})

// ═══════════════════════════════════════════
// DELETE /comments/:id — delete (author or Manager/CEO)
// ═══════════════════════════════════════════
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))

  const existing = await prisma.comment.findUnique({ where: { id: String(req.params.id) } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Comment not found'))

  const isAuthor = existing.authorId === req.user.userId
  const isPrivileged = req.user.role === 'CEO' || req.user.role === 'MANAGER'
  if (!isAuthor && !isPrivileged) {
    return next(new AppError(403, 'FORBIDDEN', 'Cannot delete another user\'s comment'))
  }

  await prisma.comment.delete({ where: { id: existing.id } })
  emitToEntity(existing.entityType, existing.entityId, 'comment:deleted', { id: existing.id })
  res.status(204).end()
})

export { router as commentsRouter }
