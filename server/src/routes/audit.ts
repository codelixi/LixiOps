import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { requireCEO } from '../middleware/authenticate.js'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// Audit trail — read-only surface over the AuditLog table.
// CEO only. Pagination via cursor (createdAt) so the table can
// grow indefinitely without timing out the list query.
//
// Audit entries are written by the routes themselves at write time
// (see attachments, documents, knowledge, decisions). The goal is
// to capture *who did what to which entity* without coupling the
// audit logic to any specific route.
// ───────────────────────────────────────────

router.get('/', requireCEO, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const action = typeof req.query.action === 'string' ? req.query.action : undefined
    const entity = typeof req.query.entity === 'string' ? req.query.entity : undefined
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const before = typeof req.query.before === 'string' ? req.query.before : undefined

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(action ? { action: { contains: action } } : {}),
        ...(entity ? { entity } : {}),
        ...(userId ? { userId } : {}),
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // peek for next cursor
      include: { user: { select: { id: true, name: true, avatar: true, role: true } } },
    })

    const hasMore = logs.length > limit
    const items = hasMore ? logs.slice(0, limit) : logs
    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null

    // Top actors + actions over the returned window for the summary strip
    const actorCounts = new Map<string, { id: string; name: string; count: number }>()
    const actionCounts = new Map<string, number>()
    for (const log of items) {
      if (log.user) {
        const entry = actorCounts.get(log.user.id) ?? { id: log.user.id, name: log.user.name, count: 0 }
        entry.count += 1
        actorCounts.set(log.user.id, entry)
      }
      actionCounts.set(log.action, (actionCounts.get(log.action) ?? 0) + 1)
    }

    res.json({
      logs: items.map((l) => ({
        id: l.id,
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        metadata: l.metadata,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt.toISOString(),
        user: l.user,
      })),
      nextCursor,
      stats: {
        windowCount: items.length,
        topActors: Array.from(actorCounts.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        topActions: Array.from(actionCounts.entries())
          .map(([action, count]) => ({ action, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8),
      },
    })
  } catch (err) {
    next(err)
  }
})

export { router as auditRouter }
