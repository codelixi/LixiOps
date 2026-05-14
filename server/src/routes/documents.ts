import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { audit } from '../lib/audit.js'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// Documents — rich-text contracts, proposals, templates, reports
// tied optionally to a client. The Document schema stores text
// content (not files), so this surface is the authoring library.
// File attachments would need a separate storage layer (S3/MinIO).
//
// Status lifecycle: draft → sent → signed (or expired).
// Authors + CEO/MANAGER can edit/delete. Everyone authenticated can read.
// ───────────────────────────────────────────

const typeEnum = z.enum(['contract', 'proposal', 'template', 'report', 'policy', 'other'])
const statusEnum = z.enum(['draft', 'sent', 'signed', 'expired'])

const createSchema = z.object({
  title: z.string().min(1).max(200),
  type: typeEnum,
  content: z.string().max(100_000).optional(),
  clientId: z.string().min(1).nullable().optional(),
  status: statusEnum.default('draft'),
})

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: typeEnum.optional(),
  content: z.string().max(100_000).optional(),
  clientId: z.string().min(1).nullable().optional(),
  status: statusEnum.optional(),
})

function isPrivileged(role: string | undefined): boolean {
  return role === 'CEO' || role === 'MANAGER'
}

// ═══════════════════════════════════════════
// GET / — list with optional ?type=, ?status=, ?clientId=, ?q=
// Returns summary rows (no content field) so the list payload stays lean.
// ═══════════════════════════════════════════
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''

    const docs = await prisma.document.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(clientId ? { clientId } : {}),
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        version: true,
        clientId: true,
        client: { select: { id: true, company: true } },
        author: { select: { id: true, name: true, avatar: true } },
        authorId: true,
        signedAt: true,
        signatureExpiry: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    res.json({
      documents: docs.map((d) => ({
        ...d,
        signedAt: d.signedAt?.toISOString() ?? null,
        signatureExpiry: d.signatureExpiry?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
    })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// GET /:id — full document with content
// ═══════════════════════════════════════════
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id)
    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, company: true, contactName: true } },
        author: { select: { id: true, name: true, avatar: true, role: true } },
      },
    })
    if (!doc) return next(new AppError(404, 'NOT_FOUND', 'Document not found'))
    res.json({
      document: {
        ...doc,
        signedAt: doc.signedAt?.toISOString() ?? null,
        signatureExpiry: doc.signatureExpiry?.toISOString() ?? null,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      },
    })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// POST / — create (any authenticated user)
// ═══════════════════════════════════════════
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const parse = createSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }

  if (parse.data.clientId) {
    const client = await prisma.client.findUnique({ where: { id: parse.data.clientId } })
    if (!client) return next(new AppError(404, 'CLIENT_NOT_FOUND', 'Client not found'))
  }

  const document = await prisma.document.create({
    data: {
      title: parse.data.title,
      type: parse.data.type,
      content: parse.data.content ?? null,
      clientId: parse.data.clientId ?? null,
      status: parse.data.status,
      authorId: req.user.userId,
    },
    include: {
      client: { select: { id: true, company: true } },
      author: { select: { id: true, name: true, avatar: true } },
    },
  })
  audit({
    userId: req.user.userId,
    action: 'document.create',
    entity: 'DOCUMENT',
    entityId: document.id,
    metadata: { title: document.title, type: document.type, status: document.status },
  })
  res.status(201).json({ document })
})

// ═══════════════════════════════════════════
// PATCH /:id — author or CEO/MANAGER. Bumps version on content change.
// Status transitions: draft → sent → signed; auto-stamps signedAt.
// ═══════════════════════════════════════════
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const parse = updateSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const id = String(req.params.id)
  const existing = await prisma.document.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Document not found'))

  if (existing.authorId !== req.user.userId && !isPrivileged(req.user.role)) {
    return next(new AppError(403, 'FORBIDDEN', 'Only the author or a manager can edit this document'))
  }

  const data: Record<string, unknown> = { ...parse.data }
  // Version bump on content change
  if (parse.data.content !== undefined && parse.data.content !== existing.content) {
    data.version = existing.version + 1
  }
  // Stamp signedAt on status transition into 'signed'
  if (parse.data.status === 'signed' && existing.status !== 'signed') {
    data.signedAt = new Date()
  }
  if (parse.data.status && parse.data.status !== 'signed' && existing.status === 'signed') {
    data.signedAt = null
  }

  const document = await prisma.document.update({
    where: { id },
    data,
    include: {
      client: { select: { id: true, company: true } },
      author: { select: { id: true, name: true, avatar: true } },
    },
  })
  audit({
    userId: req.user.userId,
    action: 'document.update',
    entity: 'DOCUMENT',
    entityId: document.id,
    metadata: { changed: Object.keys(parse.data), newStatus: parse.data.status, newVersion: data.version },
  })
  res.json({ document })
})

// ═══════════════════════════════════════════
// DELETE /:id — author or CEO/MANAGER
// ═══════════════════════════════════════════
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const id = String(req.params.id)
  const existing = await prisma.document.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Document not found'))
  if (existing.authorId !== req.user.userId && !isPrivileged(req.user.role)) {
    return next(new AppError(403, 'FORBIDDEN', 'Only the author or a manager can delete'))
  }
  await prisma.document.delete({ where: { id } })
  audit({
    userId: req.user.userId,
    action: 'document.delete',
    entity: 'DOCUMENT',
    entityId: id,
    metadata: { title: existing.title },
  })
  res.status(204).end()
})

export { router as documentsRouter }
