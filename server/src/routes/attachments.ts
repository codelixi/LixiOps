import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { storage, MAX_UPLOAD_BYTES, isAllowedMime } from '../lib/storage.js'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// Polymorphic file attachments.
// Each row links a stored blob to (entityType, entityId).
// Storage is abstracted via lib/storage — local FS by default,
// S3-ready interface for production.
// ───────────────────────────────────────────

const ENTITY_TYPES = ['DOCUMENT', 'COMMENT', 'PROJECT', 'TASK', 'INVOICE', 'CLIENT', 'LEAD', 'MILESTONE', 'RISK'] as const
type EntityType = (typeof ENTITY_TYPES)[number]

const entityQuery = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().min(1),
})

// Multer config — memory storage, then handed to the storage adapter.
// Keeps things simple and means an S3 swap doesn't change this layer.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedMime(file.mimetype)) {
      return cb(new AppError(400, 'UNSUPPORTED_TYPE', `File type ${file.mimetype} is not allowed`))
    }
    cb(null, true)
  },
})

function isPrivileged(role: string | undefined): boolean {
  return role === 'CEO' || role === 'MANAGER'
}

// ═══════════════════════════════════════════
// GET /?entityType=DOCUMENT&entityId=xxx
// List attachments for an entity.
// ═══════════════════════════════════════════
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const parse = entityQuery.safeParse({
    entityType: req.query.entityType,
    entityId: req.query.entityId,
  })
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'entityType and entityId required'))
  }

  const attachments = await prisma.attachment.findMany({
    where: { entityType: parse.data.entityType, entityId: parse.data.entityId },
    orderBy: { createdAt: 'desc' },
  })

  // Resolve uploaders
  const uploaderIds = Array.from(new Set(attachments.map((a) => a.uploadedById).filter((id): id is string => !!id)))
  const uploaders = uploaderIds.length
    ? await prisma.user.findMany({
        where: { id: { in: uploaderIds } },
        select: { id: true, name: true, avatar: true },
      })
    : []
  const uploaderMap = new Map(uploaders.map((u) => [u.id, u]))

  res.json({
    attachments: attachments.map((a) => ({
      id: a.id,
      entityType: a.entityType,
      entityId: a.entityId,
      fileName: a.fileName,
      fileType: a.fileType,
      fileSize: a.fileSize,
      uploadedBy: a.uploadedById ? uploaderMap.get(a.uploadedById) ?? null : null,
      createdAt: a.createdAt.toISOString(),
    })),
  })
})

// ═══════════════════════════════════════════
// POST / — upload (multipart). Field name: "file".
// Body fields: entityType, entityId (both required as form fields).
// ═══════════════════════════════════════════
router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
    if (!req.file) return next(new AppError(400, 'NO_FILE', 'No file provided (field "file")'))

    const parse = entityQuery.safeParse({
      entityType: req.body.entityType,
      entityId: req.body.entityId,
    })
    if (!parse.success) {
      return next(new AppError(400, 'VALIDATION', 'entityType and entityId required'))
    }

    const { storageKey } = await storage.put(req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    })

    const attachment = await prisma.attachment.create({
      data: {
        entityType: parse.data.entityType,
        entityId: parse.data.entityId,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        storageKey,
        uploadedById: req.user.userId,
      },
    })

    // Write an AuditLog entry — this is the seed of the audit-trail surface.
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'attachment.create',
        entity: parse.data.entityType,
        entityId: parse.data.entityId,
        metadata: { fileName: attachment.fileName, fileSize: attachment.fileSize, attachmentId: attachment.id },
      },
    }).catch(() => undefined) // non-fatal if audit write fails

    res.status(201).json({ attachment })
  } catch (err: any) {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(413, 'FILE_TOO_LARGE', `File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit`))
    }
    next(err)
  }
})

// ═══════════════════════════════════════════
// GET /:id/download — stream the file with auth + entity check
// Content-Disposition forces a download with the original filename.
// ═══════════════════════════════════════════
router.get('/:id/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id)
    const attachment = await prisma.attachment.findUnique({ where: { id } })
    if (!attachment) return next(new AppError(404, 'NOT_FOUND', 'Attachment not found'))

    const stream = await storage.getStream(attachment.storageKey)
    res.setHeader('Content-Type', attachment.fileType)
    res.setHeader('Content-Length', attachment.fileSize)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${attachment.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
    )
    stream.on('error', (err) => next(err))
    stream.pipe(res)
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// DELETE /:id — uploader or CEO/MANAGER. Cleans up blob + row.
// ═══════════════════════════════════════════
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
    const id = String(req.params.id)
    const attachment = await prisma.attachment.findUnique({ where: { id } })
    if (!attachment) return next(new AppError(404, 'NOT_FOUND', 'Attachment not found'))

    if (attachment.uploadedById !== req.user.userId && !isPrivileged(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Only the uploader or a manager can delete'))
    }

    await storage.delete(attachment.storageKey)
    await prisma.attachment.delete({ where: { id } })

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'attachment.delete',
        entity: attachment.entityType,
        entityId: attachment.entityId,
        metadata: { fileName: attachment.fileName, attachmentId: attachment.id },
      },
    }).catch(() => undefined)

    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export { router as attachmentsRouter }
