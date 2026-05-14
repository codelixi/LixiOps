// ═══════════════════════════════════════════════════════════════
// Action Engine — rule-driven automation scanner
// ═══════════════════════════════════════════════════════════════
// Scans the system on a fixed interval for trigger conditions (overdue
// invoices, stale leads, past-due projects, due-soon milestones) and
// produces ScheduledAction rows + Notification rows. Runs in-process;
// swap for BullMQ in production when multi-worker scale is needed.
//
// Non-negotiable rules enforced elsewhere ensure every entity has an
// owner (repId / clientId.accountManager / project team), so this
// engine always has somebody to notify.

import { PrismaClient, Prisma } from '@prisma/client'
import { emitToUser, emitToUsers } from '../lib/realtime.js'

const prisma = new PrismaClient()

// Default thresholds — can later be loaded from ActionRule.config
const STALE_LEAD_DAYS = 7
const DUE_SOON_INVOICE_DAYS = 3
const DUE_SOON_MILESTONE_DAYS = 3

// Idempotency: don't fire the same rule against the same entity twice
// within this cool-down window. Keyed per-rule (not per-trigger) so two
// rules on the same trigger can each fire independently.
const COOL_DOWN_HOURS = 24
const WEBHOOK_TIMEOUT_MS = 5000

const ALL_TRIGGERS = [
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
] as const

type Trigger = (typeof ALL_TRIGGERS)[number]

interface DispatchCtx {
  trigger: Trigger
  entityType: string
  entityId: string
  /** Best-guess owner of the entity — used by NOTIFY_USER. */
  recipientUserId: string | null
  /** Optional projectId for CREATE_TASK / ESCALATE — keeps the auto-task
   *  attached to the right project so existing project workflows still apply. */
  projectId?: string | null
  title: string
  message: string
  link: string
}

interface RuleLite {
  id: string
  name: string
  trigger: string
  actionType: string
  config: unknown
}

// ═══════════════════════════════════════════════════════════════
// Bootstrap — seed default NOTIFY_USER rule per trigger if missing.
// Runs once on engine start so out-of-the-box behaviour is preserved
// while letting CEOs delete defaults they don't want.
// ═══════════════════════════════════════════════════════════════

async function ensureDefaultRules(): Promise<void> {
  for (const trigger of ALL_TRIGGERS) {
    const exists = await prisma.actionRule.findFirst({ where: { trigger: trigger as any } })
    if (!exists) {
      await prisma.actionRule.create({
        data: {
          name: `Default: ${trigger}`,
          trigger: trigger as any,
          actionType: 'NOTIFY_USER' as any,
          config: {},
          isActive: true,
        },
      })
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Idempotency
// ═══════════════════════════════════════════════════════════════

async function alreadyFiredRecently(ruleId: string, entityType: string, entityId: string): Promise<boolean> {
  const since = new Date(Date.now() - COOL_DOWN_HOURS * 60 * 60 * 1000)
  const recent = await prisma.scheduledAction.findFirst({
    where: {
      ruleId,
      entityType,
      entityId,
      createdAt: { gte: since },
    },
  })
  return !!recent
}

// ═══════════════════════════════════════════════════════════════
// Dispatch — fan out a trigger to every active rule that matches.
// ═══════════════════════════════════════════════════════════════

async function dispatchTrigger(ctx: DispatchCtx): Promise<number> {
  const rules = await prisma.actionRule.findMany({
    where: { trigger: ctx.trigger as any, isActive: true },
  })
  let fired = 0
  for (const rule of rules) {
    const ok = await executeRule(rule, ctx)
    if (ok) fired++
  }
  return fired
}

async function executeRule(rule: RuleLite, ctx: DispatchCtx): Promise<boolean> {
  if (await alreadyFiredRecently(rule.id, ctx.entityType, ctx.entityId)) return false
  const config = (rule.config && typeof rule.config === 'object' ? (rule.config as Record<string, unknown>) : {}) as Record<string, unknown>

  let result: Record<string, unknown> = { trigger: ctx.trigger, actionType: rule.actionType, ok: false }
  let status = 'skipped'

  try {
    switch (rule.actionType) {
      case 'NOTIFY_USER':
        result = await dispatchNotifyUser(ctx)
        status = result.ok ? 'executed' : 'skipped'
        break
      case 'NOTIFY_ROLE':
        result = await dispatchNotifyRole(ctx, config)
        status = result.ok ? 'executed' : 'skipped'
        break
      case 'EMAIL':
        result = await dispatchEmail(ctx, config)
        status = 'executed'
        break
      case 'CREATE_TASK':
        result = await dispatchCreateTask(ctx, config)
        status = result.ok ? 'executed' : 'skipped'
        break
      case 'ESCALATE':
        result = await dispatchEscalate(ctx, config)
        status = result.ok ? 'executed' : 'skipped'
        break
      case 'WEBHOOK':
        result = await dispatchWebhook(ctx, config)
        status = result.ok ? 'executed' : 'failed'
        break
      default:
        result = { trigger: ctx.trigger, actionType: rule.actionType, ok: false, reason: 'unsupported_action_type' }
        status = 'skipped'
    }
  } catch (err: any) {
    result = { trigger: ctx.trigger, actionType: rule.actionType, ok: false, error: err?.message ?? String(err) }
    status = 'failed'
  }

  result.trigger = ctx.trigger
  result.actionType = rule.actionType

  const now = new Date()
  await prisma.scheduledAction.create({
    data: {
      ruleId: rule.id,
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      scheduledFor: now,
      executedAt: now,
      status,
      attempts: 1,
      result: result as Prisma.InputJsonValue,
    },
  })
  await prisma.actionRule.update({
    where: { id: rule.id },
    data: { lastRunAt: now, runCount: { increment: 1 } },
  })
  return status === 'executed'
}

// ═══════════════════════════════════════════════════════════════
// Action handlers
// ═══════════════════════════════════════════════════════════════

async function dispatchNotifyUser(ctx: DispatchCtx): Promise<Record<string, unknown>> {
  if (!ctx.recipientUserId) return { ok: false, reason: 'no_recipient' }
  const notif = await prisma.notification.create({
    data: {
      userId: ctx.recipientUserId,
      type: ctx.trigger.toLowerCase(),
      title: ctx.title,
      message: ctx.message,
      link: ctx.link,
      channel: 'in_app',
    },
  })
  emitToUser(ctx.recipientUserId, 'notification:new')
  return { ok: true, notificationIds: [notif.id], recipients: 1 }
}

async function dispatchNotifyRole(
  ctx: DispatchCtx,
  config: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const role = typeof config.recipientRole === 'string' ? config.recipientRole : 'CEO'
  const recipients = await prisma.user.findMany({
    where: { role: { equals: role as any } },
    select: { id: true },
  })
  if (recipients.length === 0) return { ok: false, reason: 'no_role_members', role }

  const created = await Promise.all(
    recipients.map((u) =>
      prisma.notification.create({
        data: {
          userId: u.id,
          type: ctx.trigger.toLowerCase(),
          title: ctx.title,
          message: ctx.message,
          link: ctx.link,
          channel: 'in_app',
        },
      }),
    ),
  )
  emitToUsers(recipients.map((u) => u.id), 'notification:new')
  return { ok: true, notificationIds: created.map((n) => n.id), recipients: recipients.length, role }
}

async function dispatchEmail(
  ctx: DispatchCtx,
  config: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // SMTP integration is out of scope here — record the intent so it's
  // visible in the activity log, and a future EMAIL_QUEUED status can be
  // picked up by an outbound mail worker.
  const to =
    typeof config.to === 'string'
      ? config.to
      : ctx.recipientUserId
        ? (await prisma.user.findUnique({ where: { id: ctx.recipientUserId }, select: { email: true } }))?.email ?? null
        : null
  console.log(`[ActionEngine] EMAIL queued: trigger=${ctx.trigger} to=${to ?? 'unknown'}`)
  return { ok: true, queued: true, to, template: config.template ?? 'default' }
}

async function dispatchCreateTask(
  ctx: DispatchCtx,
  config: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const titleTemplate = typeof config.taskTitle === 'string' ? config.taskTitle : `Follow up: ${ctx.title}`
  const priority = typeof config.priority === 'string' ? config.priority : 'high'

  // Tasks need an assignee for the "No Work Without Assignment" rule when
  // moved to in_progress, but creating in `todo` is allowed without one.
  const task = await prisma.task.create({
    data: {
      title: titleTemplate,
      description: `Auto-created by Action Engine (${ctx.trigger}). ${ctx.message}`,
      status: 'todo',
      priority,
      assigneeId: ctx.recipientUserId ?? undefined,
      projectId: ctx.projectId ?? undefined,
    },
  })

  // Also notify the assignee so they don't miss the auto-task.
  let notificationId: string | null = null
  if (ctx.recipientUserId) {
    const n = await prisma.notification.create({
      data: {
        userId: ctx.recipientUserId,
        type: ctx.trigger.toLowerCase(),
        title: `Task created: ${task.title}`,
        message: ctx.message,
        link: `/development`,
        channel: 'in_app',
      },
    })
    notificationId = n.id
    emitToUser(ctx.recipientUserId, 'notification:new')
  }
  return { ok: true, taskId: task.id, notificationIds: notificationId ? [notificationId] : [] }
}

async function dispatchEscalate(
  ctx: DispatchCtx,
  config: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Escalate = notify the CEO chain AND create a follow-up task.
  const role = typeof config.escalateTo === 'string' ? config.escalateTo : 'CEO'
  const ceos = await prisma.user.findMany({ where: { role: { equals: role as any } }, select: { id: true } })
  if (ceos.length === 0) return { ok: false, reason: 'no_escalation_target', role }

  const notifs = await Promise.all(
    ceos.map((u) =>
      prisma.notification.create({
        data: {
          userId: u.id,
          type: `escalation_${ctx.trigger.toLowerCase()}`,
          title: `[ESCALATION] ${ctx.title}`,
          message: ctx.message,
          link: ctx.link,
          channel: 'in_app',
        },
      }),
    ),
  )
  emitToUsers(ceos.map((c) => c.id), 'notification:new')

  const task = await prisma.task.create({
    data: {
      title: `[Escalated] ${ctx.title}`,
      description: `Escalated by Action Engine. Trigger: ${ctx.trigger}. ${ctx.message}`,
      status: 'todo',
      priority: 'critical',
      assigneeId: ceos[0]!.id,
      projectId: ctx.projectId ?? undefined,
    },
  })
  return {
    ok: true,
    notificationIds: notifs.map((n) => n.id),
    taskId: task.id,
    recipients: ceos.length,
    role,
  }
}

async function dispatchWebhook(
  ctx: DispatchCtx,
  config: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = typeof config.webhookUrl === 'string' ? config.webhookUrl : null
  if (!url) return { ok: false, reason: 'missing_webhook_url' }

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        trigger: ctx.trigger,
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        title: ctx.title,
        message: ctx.message,
        link: ctx.link,
        ts: new Date().toISOString(),
      }),
      signal: ctrl.signal,
    })
    return { ok: res.ok, status: res.status, url }
  } catch (err: any) {
    return { ok: false, error: err?.name === 'AbortError' ? 'timeout' : err?.message, url }
  } finally {
    clearTimeout(timeout)
  }
}

// ═══════════════════════════════════════════════════════════════
// Back-compat shim — keep the old `fire(...)` signature so scanners
// don't need to change. Forwards to the new dispatcher.
// ═══════════════════════════════════════════════════════════════
async function fire(opts: {
  trigger: string
  entityType: string
  entityId: string
  recipientUserId: string | null
  title: string
  message: string
  link: string
  projectId?: string | null
}): Promise<void> {
  await dispatchTrigger({
    trigger: opts.trigger as Trigger,
    entityType: opts.entityType,
    entityId: opts.entityId,
    recipientUserId: opts.recipientUserId,
    projectId: opts.projectId ?? null,
    title: opts.title,
    message: opts.message,
    link: opts.link,
  })
}

// ═══════════════════════════════════════════════════════════════
// Scanners
// ═══════════════════════════════════════════════════════════════

async function scanInvoices(): Promise<number> {
  const now = new Date()
  const dueSoonCutoff = new Date(now.getTime() + DUE_SOON_INVOICE_DAYS * 86_400_000)

  const overdue = await prisma.invoice.findMany({
    where: {
      status: { in: ['sent', 'partial', 'overdue'] },
      dueDate: { lt: now },
    },
    include: { client: true, createdBy: { select: { id: true } } },
  })

  const dueSoon = await prisma.invoice.findMany({
    where: {
      status: { in: ['sent', 'partial'] },
      dueDate: { gte: now, lte: dueSoonCutoff },
    },
    include: { createdBy: { select: { id: true } } },
  })

  let count = 0
  for (const inv of overdue) {
    const days = Math.ceil((now.getTime() - inv.dueDate.getTime()) / 86_400_000)
    await fire({
      trigger: 'INVOICE_OVERDUE',
      entityType: 'invoice',
      entityId: inv.id,
      recipientUserId: inv.createdById ?? null,
      title: `Invoice ${inv.invoiceNumber} is ${days}d overdue`,
      message: `${inv.client.company} — send a reminder or call.`,
      link: `/invoices/${inv.id}`,
    })
    count++
  }
  for (const inv of dueSoon) {
    const days = Math.ceil((inv.dueDate.getTime() - now.getTime()) / 86_400_000)
    await fire({
      trigger: 'INVOICE_DUE_SOON',
      entityType: 'invoice',
      entityId: inv.id,
      recipientUserId: inv.createdById ?? null,
      title: `Invoice ${inv.invoiceNumber} due in ${days}d`,
      message: 'Consider sending a gentle reminder.',
      link: `/invoices/${inv.id}`,
    })
    count++
  }
  return count
}

async function scanLeads(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_LEAD_DAYS * 86_400_000)
  const stale = await prisma.lead.findMany({
    where: {
      stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
      lastActivityAt: { lt: cutoff },
    },
  })
  let count = 0
  for (const lead of stale) {
    const days = Math.ceil((Date.now() - lead.lastActivityAt.getTime()) / 86_400_000)
    await fire({
      trigger: 'LEAD_STALE',
      entityType: 'lead',
      entityId: lead.id,
      recipientUserId: lead.repId ?? null,
      title: `${lead.company} has been quiet for ${days}d`,
      message: `Stage: ${lead.stage}. Move it forward or mark Closed Lost.`,
      link: `/sales`,
    })
    count++
  }
  return count
}

async function scanProjects(): Promise<number> {
  const now = new Date()
  const pastDue = await prisma.project.findMany({
    where: {
      goLiveDate: { lt: now },
      health: { not: 'DELAYED' },
    },
    include: { client: true },
  })
  let count = 0
  for (const p of pastDue) {
    // TODO: look up project manager once team assignments exist. For now
    // notify the client's accountManager via raw user lookup.
    const manager = await prisma.user.findFirst({
      where: { role: { in: ['MANAGER', 'CEO'] } },
      select: { id: true },
    })
    await fire({
      trigger: 'PROJECT_PAST_DUE',
      entityType: 'project',
      entityId: p.id,
      recipientUserId: manager?.id ?? null,
      projectId: p.id,
      title: `${p.name} is past its go-live date`,
      message: `${p.client.company} project needs status update.`,
      link: `/projects/${p.id}`,
    })
    count++
  }
  return count
}

async function scanMilestones(): Promise<number> {
  const now = new Date()
  const cutoff = new Date(now.getTime() + DUE_SOON_MILESTONE_DAYS * 86_400_000)
  const due = await prisma.milestone.findMany({
    where: {
      dueDate: { gte: now, lte: cutoff },
      isComplete: false,
    },
    include: { project: { include: { client: true } } },
  })
  let count = 0
  for (const m of due) {
    if (!m.dueDate) continue
    const manager = await prisma.user.findFirst({
      where: { role: { in: ['MANAGER', 'CEO'] } },
      select: { id: true },
    })
    const days = Math.ceil((m.dueDate.getTime() - now.getTime()) / 86_400_000)
    await fire({
      trigger: 'MILESTONE_DUE_SOON',
      entityType: 'milestone',
      entityId: m.id,
      recipientUserId: manager?.id ?? null,
      projectId: m.projectId,
      title: `Milestone "${m.title}" due in ${days}d`,
      message: `${m.project.client.company} · ${m.project.name}`,
      link: `/projects/${m.projectId}`,
    })
    count++
  }
  return count
}

// ═══════════════════════════════════════════════════════════════
// Orchestrator
// ═══════════════════════════════════════════════════════════════

export async function runActionEngine(): Promise<{ fired: number; ts: Date }> {
  const ts = new Date()
  const started = Date.now()
  let fired = 0
  try {
    fired += await scanInvoices()
    fired += await scanLeads()
    fired += await scanProjects()
    // Milestone model uses a `status` string field; guard in case of schema drift
    try {
      fired += await scanMilestones()
    } catch (e) {
      console.error('[ActionEngine] milestone scan failed', e)
    }
  } catch (e) {
    console.error('[ActionEngine] scan failed', e)
  }
  const elapsed = Date.now() - started
  console.log(`[ActionEngine] fired=${fired} elapsed=${elapsed}ms`)
  return { fired, ts }
}

let handle: NodeJS.Timeout | null = null

/** Start a periodic in-process scan. Safe to call once at boot. */
export function startActionEngine(intervalMs = 5 * 60 * 1000): void {
  if (handle) return
  // Fire once at boot (after short delay so DB connections settle)
  setTimeout(async () => {
    try {
      await ensureDefaultRules()
    } catch (e) {
      console.error('[ActionEngine] ensureDefaultRules failed', e)
    }
    void runActionEngine()
  }, 10_000)
  handle = setInterval(() => {
    void runActionEngine()
  }, intervalMs)
  console.log(`[ActionEngine] started — interval ${intervalMs}ms`)
}

export function stopActionEngine(): void {
  if (handle) {
    clearInterval(handle)
    handle = null
  }
}
