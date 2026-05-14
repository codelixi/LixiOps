import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// Knowledge Base — internal articles (process docs, policies,
// runbooks). Schema is intentionally minimal: title, content,
// category, optional department, authorId, viewCount.
//
// Anyone authenticated can read + create + view-bump.
// Only author + CEO/MANAGER can edit/delete.
// ───────────────────────────────────────────

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50_000),
  category: z.string().min(1).max(60),
  department: z.string().max(60).nullable().optional(),
})

const updateSchema = createSchema.partial()

function isPrivileged(role: string | undefined): boolean {
  return role === 'CEO' || role === 'MANAGER'
}

// ═══════════════════════════════════════════
// GET / — list articles with optional search + category filter
// ═══════════════════════════════════════════
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const category = typeof req.query.category === 'string' ? req.query.category : undefined

    const articles = await prisma.knowledgeArticle.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { content: { contains: q, mode: 'insensitive' } },
                { category: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        title: true,
        category: true,
        department: true,
        viewCount: true,
        createdAt: true,
        updatedAt: true,
        authorId: true,
        author: { select: { id: true, name: true, avatar: true, role: true } },
      },
    })

    // Aggregate category counts for the filter chips
    const allCategories = await prisma.knowledgeArticle.groupBy({
      by: ['category'],
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
    })

    res.json({
      articles: articles.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
      categories: allCategories.map((c) => ({ name: c.category, count: c._count._all })),
    })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// GET /:id — full article with content + view bump.
// View bump is fire-and-forget so the read response stays fast.
// ═══════════════════════════════════════════
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id)
    const article = await prisma.knowledgeArticle.findUnique({
      where: { id },
      include: { author: { select: { id: true, name: true, avatar: true, role: true } } },
    })
    if (!article) return next(new AppError(404, 'NOT_FOUND', 'Article not found'))
    // View bump (fire and forget — don't block the response)
    void prisma.knowledgeArticle.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => undefined)

    res.json({
      article: {
        ...article,
        createdAt: article.createdAt.toISOString(),
        updatedAt: article.updatedAt.toISOString(),
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
  const article = await prisma.knowledgeArticle.create({
    data: {
      title: parse.data.title,
      content: parse.data.content,
      category: parse.data.category,
      department: parse.data.department ?? null,
      authorId: req.user.userId,
    },
    include: { author: { select: { id: true, name: true, avatar: true, role: true } } },
  })
  res.status(201).json({ article })
})

// ═══════════════════════════════════════════
// PATCH /:id — author or CEO/MANAGER can edit
// ═══════════════════════════════════════════
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const parse = updateSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const id = String(req.params.id)
  const existing = await prisma.knowledgeArticle.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Article not found'))

  if (existing.authorId !== req.user.userId && !isPrivileged(req.user.role)) {
    return next(new AppError(403, 'FORBIDDEN', 'Only the author or a manager can edit this article'))
  }

  const article = await prisma.knowledgeArticle.update({
    where: { id },
    data: parse.data,
    include: { author: { select: { id: true, name: true, avatar: true, role: true } } },
  })
  res.json({ article })
})

// ═══════════════════════════════════════════
// DELETE /:id — author or CEO/MANAGER
// ═══════════════════════════════════════════
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const id = String(req.params.id)
  const existing = await prisma.knowledgeArticle.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Article not found'))
  if (existing.authorId !== req.user.userId && !isPrivileged(req.user.role)) {
    return next(new AppError(403, 'FORBIDDEN', 'Only the author or a manager can delete'))
  }
  await prisma.knowledgeArticle.delete({ where: { id } })
  res.status(204).end()
})

export { router as knowledgeRouter }
