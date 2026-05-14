import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient, Prisma } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { requireManager } from '../middleware/authenticate.js'
import { runActionEngine } from '../services/actionEngine.js'
import { audit } from '../lib/audit.js'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// Action Engine API — exposes the rule-driven automation
// scanner so operators can:
//   • see active rules and toggle them
//   • view recent fires with the entity context they hit
//   • trigger an on-demand scan (privileged)
//   • read aggregate stats for the dashboard
// ───────────────────────────────────────────

const triggerEnum = z.enum([
  'INVOICE_OVERDUE',
  'INVOICE_DUE_SOON',
  'LEAD_STALE',
  'LEAD_IN_STAGE_TOO_LONG',
  'PROJECT_PAST_DUE',
  'PROJECT_NO_UPDATE',
  'MILESTONE_DUE_SOON',
  'TASK_OVERDUE',
  'CONTRACT_EXPIRING',
  'SLA_BREACH',
  'NPS_LOW',
])

const actionTypeEnum = z.enum([
  'NOTIFY_USER',
  'NOTIFY_ROLE',
  'EMAIL',
  'CREATE_TASK',
  'ESCALATE',
  'WEBHOOK',
])

const createRuleSchema = z.object({
  name: z.string().min(1).max(120),
  trigger: triggerEnum,
  actionType: actionTypeEnum,
  config: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean().default(true),
})

const updateRuleSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  actionType: actionTypeEnum.optional(),
})

// ═══════════════════════════════════════════
// GET /rules — all rules (newest first), with a tiny rolling fire count
// ═══════════════════════════════════════════
router.get('/rules', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await prisma.actionRule.findMany({
      orderBy: [{ isActive: 'desc' }, { trigger: 'asc' }],
      include: {
        _count: { select: { scheduled: true } },
      },
    })
    res.json({ rules })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// POST /rules — create custom rule (CEO/MANAGER only)
// Multiple rules per trigger are allowed; the engine fires the
// first active match for idempotency tracking.
// ═══════════════════════════════════════════
router.post('/rules', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const parse = createRuleSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  try {
    const rule = await prisma.actionRule.create({
      data: {
        name: parse.data.name,
        trigger: parse.data.trigger,
        actionType: parse.data.actionType,
        config: parse.data.config as Prisma.InputJsonValue,
        isActive: parse.data.isActive,
      },
    })
    audit({
      userId: req.user?.userId,
      action: 'action_rule.create',
      entity: 'ACTION_RULE',
      entityId: rule.id,
      metadata: { name: rule.name, trigger: rule.trigger, actionType: rule.actionType },
    })
    res.status(201).json({ rule })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// DELETE /rules/:id — remove rule (CEO/MANAGER only)
// ScheduledAction history cascades via Prisma onDelete: Cascade
// ═══════════════════════════════════════════
router.delete('/rules/:id', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id)
  const existing = await prisma.actionRule.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Rule not found'))
  await prisma.actionRule.delete({ where: { id } })
  audit({
    userId: req.user?.userId,
    action: 'action_rule.delete',
    entity: 'ACTION_RULE',
    entityId: id,
    metadata: { name: existing.name, trigger: existing.trigger },
  })
  res.status(204).end()
})

// ═══════════════════════════════════════════
// PATCH /rules/:id — toggle active / rename / tweak config
// ═══════════════════════════════════════════
router.patch('/rules/:id', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const parse = updateRuleSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const id = String(req.params.id)
  const existing = await prisma.actionRule.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Rule not found'))

  const rule = await prisma.actionRule.update({
    where: { id },
    data: parse.data as Record<string, unknown>,
  })
  audit({
    userId: req.user?.userId,
    action: 'action_rule.update',
    entity: 'ACTION_RULE',
    entityId: rule.id,
    metadata: { changed: Object.keys(parse.data), name: rule.name },
  })
  res.json({ rule })
})

// ═══════════════════════════════════════════
// GET /scheduled — recent fires, optionally filtered by status / entity / trigger
// ═══════════════════════════════════════════
router.get('/scheduled', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined
    const limit = Math.min(Number(req.query.limit) || 50, 200)

    const items = await prisma.scheduledAction.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(entityType ? { entityType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        rule: { select: { id: true, name: true, trigger: true, actionType: true } },
      },
    })

    // Resolve entity titles in batches per type so we can show useful context
    const byType: Record<string, string[]> = {}
    for (const it of items) {
      ;(byType[it.entityType] ||= []).push(it.entityId)
    }

    const titles: Record<string, string> = {}
    if (byType.invoice) {
      const invs = await prisma.invoice.findMany({
        where: { id: { in: byType.invoice } },
        select: { id: true, invoiceNumber: true, client: { select: { company: true } } },
      })
      for (const i of invs) titles[`invoice:${i.id}`] = `${i.invoiceNumber} · ${i.client?.company ?? ''}`
    }
    if (byType.lead) {
      const leads = await prisma.lead.findMany({
        where: { id: { in: byType.lead } },
        select: { id: true, company: true, contactName: true },
      })
      for (const l of leads) titles[`lead:${l.id}`] = l.company || l.contactName || 'Lead'
    }
    if (byType.project) {
      const projects = await prisma.project.findMany({
        where: { id: { in: byType.project } },
        select: { id: true, name: true, client: { select: { company: true } } },
      })
      for (const p of projects) titles[`project:${p.id}`] = `${p.name} · ${p.client?.company ?? ''}`
    }
    if (byType.milestone) {
      const ms = await prisma.milestone.findMany({
        where: { id: { in: byType.milestone } },
        select: { id: true, title: true, projectId: true },
      })
      for (const m of ms) titles[`milestone:${m.id}`] = m.title
    }

    const enriched = items.map((it) => ({
      id: it.id,
      ruleId: it.ruleId,
      ruleName: it.rule.name,
      trigger: it.rule.trigger,
      actionType: it.rule.actionType,
      entityType: it.entityType,
      entityId: it.entityId,
      entityTitle: titles[`${it.entityType}:${it.entityId}`] ?? null,
      status: it.status,
      attempts: it.attempts,
      result: it.result,
      scheduledFor: it.scheduledFor.toISOString(),
      executedAt: it.executedAt?.toISOString() ?? null,
      createdAt: it.createdAt.toISOString(),
    }))

    res.json({ scheduled: enriched })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// GET /stats — quick counts for dashboard cards
// ═══════════════════════════════════════════
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [activeRules, totalRules, fired24h, fired7d, lastRule, byTrigger] = await Promise.all([
      prisma.actionRule.count({ where: { isActive: true } }),
      prisma.actionRule.count(),
      prisma.scheduledAction.count({ where: { createdAt: { gte: since24h } } }),
      prisma.scheduledAction.count({ where: { createdAt: { gte: since7d } } }),
      prisma.actionRule.findFirst({
        where: { lastRunAt: { not: null } },
        orderBy: { lastRunAt: 'desc' },
        select: { lastRunAt: true },
      }),
      prisma.actionRule.groupBy({
        by: ['trigger'],
        _sum: { runCount: true },
        orderBy: { _sum: { runCount: 'desc' } },
      }),
    ])

    res.json({
      activeRules,
      totalRules,
      fired24h,
      fired7d,
      lastRunAt: lastRule?.lastRunAt?.toISOString() ?? null,
      byTrigger: byTrigger.map((b) => ({ trigger: b.trigger, count: b._sum.runCount ?? 0 })),
    })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// POST /run — fire an immediate scan (CEO/MANAGER only)
// ═══════════════════════════════════════════
router.post('/run', requireManager, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await runActionEngine()
    res.json({ fired: result.fired, ts: result.ts.toISOString() })
  } catch (err) {
    next(err)
  }
})

export { router as actionEngineRouter }
