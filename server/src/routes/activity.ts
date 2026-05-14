import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// Activity Feed — aggregates a unified, time-sorted stream of events
// from across the system (lead activities, comments, task transitions,
// invoice events). Pull most-recent-N from each source, normalize, sort,
// and return the top N. Cheap because each query is small + indexed.
// ───────────────────────────────────────────

export type ActivityCategory =
  | 'lead'
  | 'comment'
  | 'task'
  | 'invoice'
  | 'project'

export interface ActivityEvent {
  id: string
  category: ActivityCategory
  user: string | null
  userId: string | null
  action: string
  target: string
  detail?: string
  entityType?: string
  entityId?: string
  timestamp: string
}

const PER_SOURCE_LIMIT = 25
const TOTAL_LIMIT = 60

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))

  try {
    const [leadActs, comments, completedTasks, recentTasks, invoices] = await Promise.all([
      prisma.leadActivity.findMany({
        orderBy: { createdAt: 'desc' },
        take: PER_SOURCE_LIMIT,
        include: {
          user: { select: { id: true, name: true } },
          lead: { select: { id: true, contactName: true, company: true } },
        },
      }),
      prisma.comment.findMany({
        orderBy: { createdAt: 'desc' },
        take: PER_SOURCE_LIMIT,
      }),
      prisma.task.findMany({
        where: { completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: PER_SOURCE_LIMIT,
        include: {
          assignee: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.task.findMany({
        orderBy: { createdAt: 'desc' },
        take: PER_SOURCE_LIMIT,
        include: {
          creator: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.invoice.findMany({
        orderBy: { updatedAt: 'desc' },
        take: PER_SOURCE_LIMIT,
        include: {
          client: { select: { id: true, company: true, contactName: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
    ])

    // Resolve comment authors in a single query
    const authorIds = Array.from(new Set(comments.map((c) => c.authorId).filter(Boolean)))
    const authors = authorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, name: true },
        })
      : []
    const authorMap = new Map(authors.map((a) => [a.id, a.name]))

    const events: ActivityEvent[] = []

    // Lead activities (calls, emails, meetings, notes)
    for (const a of leadActs) {
      const targetName = a.lead?.company || a.lead?.contactName || 'Lead'
      events.push({
        id: `leadact:${a.id}`,
        category: 'lead',
        user: a.user?.name ?? null,
        userId: a.userId,
        action: `logged ${a.type}`,
        target: targetName,
        detail: a.text.slice(0, 140),
        entityType: 'LEAD',
        entityId: a.leadId,
        timestamp: a.createdAt.toISOString(),
      })
    }

    // Comments
    for (const c of comments) {
      events.push({
        id: `comment:${c.id}`,
        category: 'comment',
        user: authorMap.get(c.authorId) ?? null,
        userId: c.authorId,
        action: 'commented on',
        target: c.entityType,
        detail: c.body.length > 140 ? c.body.slice(0, 137) + '…' : c.body,
        entityType: c.entityType,
        entityId: c.entityId,
        timestamp: c.createdAt.toISOString(),
      })
    }

    // Task completions
    for (const t of completedTasks) {
      if (!t.completedAt) continue
      events.push({
        id: `taskdone:${t.id}`,
        category: 'task',
        user: t.assignee?.name ?? null,
        userId: t.assigneeId,
        action: 'completed task',
        target: t.title,
        detail: t.project?.name,
        entityType: 'TASK',
        entityId: t.id,
        timestamp: t.completedAt.toISOString(),
      })
    }

    // Task creations (only if not already represented as completion)
    const completedIds = new Set(completedTasks.map((t) => t.id))
    for (const t of recentTasks) {
      if (completedIds.has(t.id)) continue
      events.push({
        id: `taskcreate:${t.id}`,
        category: 'task',
        user: t.creator?.name ?? null,
        userId: t.creatorId,
        action: 'created task',
        target: t.title,
        detail: t.project?.name,
        entityType: 'TASK',
        entityId: t.id,
        timestamp: t.createdAt.toISOString(),
      })
    }

    // Invoice events — emit one event per invoice for the most recent state change
    for (const inv of invoices) {
      let action = 'updated invoice'
      let timestamp = inv.updatedAt
      if (inv.paidAt) {
        action = 'recorded payment for'
        timestamp = inv.paidAt
      } else if (inv.sentAt) {
        action = 'sent invoice'
        timestamp = inv.sentAt
      } else {
        action = 'drafted invoice'
        timestamp = inv.createdAt
      }
      events.push({
        id: `invoice:${inv.id}:${action.replace(/\s+/g, '_')}`,
        category: 'invoice',
        user: inv.createdBy?.name ?? null,
        userId: inv.createdById,
        action,
        target: inv.invoiceNumber,
        detail: `${inv.client?.company ?? 'Client'} — $${Number(inv.total).toLocaleString()}`,
        entityType: 'INVOICE',
        entityId: inv.id,
        timestamp: timestamp.toISOString(),
      })
    }

    events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    res.json({ activity: events.slice(0, TOTAL_LIMIT) })
  } catch (err) {
    next(err)
  }
})

export { router as activityRouter }
