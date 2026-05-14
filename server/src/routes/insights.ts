import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// AI Engine — Layer 2 — Insights.
//
// Each generator is a small async function that produces 0..N
// Insight records by pulling indexed slices of the data we already
// have. No LLM calls; this is heuristic synthesis. Results are
// in-memory cached for 5 minutes so the dashboard doesn't re-run
// the same scans on every page mount.
// ───────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium' | 'low'
type InsightType =
  | 'churn_risk'
  | 'stuck_lead'
  | 'cashflow_window'
  | 'at_risk_okr'
  | 'rule_suggestion'
  | 'capacity_warning'
  | 'velocity_change'

interface InsightEvidence {
  entityType: string
  entityId: string
  label: string
}

interface SuggestedAction {
  label: string
  route?: string
  /** Optional action that the client can invoke (e.g. open the rule editor with prefilled values) */
  action?: { kind: 'create_rule'; trigger: string; actionType: string; config: Record<string, unknown> }
}

interface Insight {
  id: string
  type: InsightType
  severity: Severity
  title: string
  message: string
  metric?: { value: string; trend?: number }
  evidence?: InsightEvidence[]
  suggestedAction?: SuggestedAction
  confidence: number
  generatedAt: string
}

// ─────────────────────────────────────────────────────────
// Generators
// ─────────────────────────────────────────────────────────

async function genChurnRisk(): Promise<Insight[]> {
  const now = Date.now()
  const clients = await prisma.client.findMany({
    where: { status: 'active' },
    include: {
      interactions: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      projects: {
        select: {
          risks: { where: { status: 'open' }, select: { id: true } },
        },
      },
    },
  })

  const out: Insight[] = []
  for (const c of clients) {
    const lastTouch = c.interactions[0]?.createdAt?.getTime() ?? 0
    const daysStale = lastTouch === 0 ? 999 : Math.floor((now - lastTouch) / 86_400_000)
    const openRisks = c.projects.flatMap((p) => p.risks).length
    const lowNps = c.npsScore !== null && c.npsScore <= 5
    const lowHealth = c.healthScore !== null && c.healthScore < 70

    // Trip if any 2 of {low health, low NPS, stale, multiple risks}
    let flags = 0
    if (lowHealth) flags++
    if (lowNps) flags++
    if (daysStale >= 14) flags++
    if (openRisks >= 2) flags++
    if (flags < 2) continue

    const severity: Severity =
      flags >= 4 ? 'critical' : flags === 3 ? 'high' : 'medium'

    const reasons: string[] = []
    if (lowHealth) reasons.push(`health ${c.healthScore}`)
    if (lowNps) reasons.push(`NPS ${c.npsScore}`)
    if (daysStale >= 14) reasons.push(`${daysStale}d quiet`)
    if (openRisks >= 2) reasons.push(`${openRisks} open risks`)

    out.push({
      id: `churn:${c.id}`,
      type: 'churn_risk',
      severity,
      title: `${c.company} shows churn signals`,
      message: `${reasons.join(' · ')}. Worth a proactive check-in this week.`,
      evidence: [{ entityType: 'client', entityId: c.id, label: c.company }],
      confidence: Math.min(1, flags / 4),
      suggestedAction: { label: 'Open client', route: `/clients/${c.id}` },
      generatedAt: new Date().toISOString(),
    })
  }
  return out.sort((a, b) => severityRank(a.severity) - severityRank(b.severity)).slice(0, 5)
}

async function genStuckLeads(): Promise<Insight[]> {
  const cutoff = new Date(Date.now() - 14 * 86_400_000)
  const stuck = await prisma.lead.findMany({
    where: {
      stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
      lastActivityAt: { lt: cutoff },
    },
    orderBy: { lastActivityAt: 'asc' },
    take: 8,
    select: { id: true, company: true, contactName: true, stage: true, lastActivityAt: true, value: true },
  })

  const stageNext: Record<string, string> = {
    PROSPECT: 'send qualifying email',
    CONTACTED: 'schedule discovery call',
    PROPOSAL_SENT: 'follow up on proposal',
    NEGOTIATION: 'close or qualify out',
  }

  return stuck.map((l) => {
    const days = Math.floor((Date.now() - l.lastActivityAt.getTime()) / 86_400_000)
    const severity: Severity = days >= 30 ? 'high' : 'medium'
    return {
      id: `stuck:${l.id}`,
      type: 'stuck_lead',
      severity,
      title: `${l.company} stuck in ${l.stage.replace('_', ' ').toLowerCase()} for ${days}d`,
      message: `Suggested next move: ${stageNext[l.stage] ?? 'pick up the conversation'}.`,
      metric: l.value > 0 ? { value: `$${Math.round(l.value).toLocaleString()}` } : undefined,
      evidence: [{ entityType: 'lead', entityId: l.id, label: `${l.company} · ${l.contactName}` }],
      confidence: 0.85,
      suggestedAction: { label: 'Open pipeline', route: '/sales' },
      generatedAt: new Date().toISOString(),
    }
  })
}

async function genCashflowWindow(): Promise<Insight[]> {
  const now = new Date()
  const window = new Date(now.getTime() + 30 * 86_400_000)

  const open = await prisma.invoice.findMany({
    where: {
      status: { in: ['sent', 'partial'] },
      dueDate: { gte: now, lte: window },
    },
    select: { total: true, paidAmount: true, dueDate: true, invoiceNumber: true, id: true },
  })
  const overdueLot = await prisma.invoice.findMany({
    where: {
      status: { in: ['sent', 'partial', 'overdue'] },
      dueDate: { lt: now },
    },
    select: { total: true, paidAmount: true },
  })

  if (open.length === 0 && overdueLot.length === 0) return []

  const expected = open.reduce((s, i) => s + (i.total - i.paidAmount), 0)
  const overdueBalance = overdueLot.reduce((s, i) => s + (i.total - i.paidAmount), 0)

  const out: Insight[] = []
  if (expected > 0) {
    out.push({
      id: 'cashflow:30d',
      type: 'cashflow_window',
      severity: 'low',
      title: 'Cashflow window — next 30 days',
      message: `$${Math.round(expected).toLocaleString()} expected from ${open.length} invoice${open.length === 1 ? '' : 's'} maturing.`,
      metric: { value: `$${Math.round(expected).toLocaleString()}` },
      confidence: 0.9,
      suggestedAction: { label: 'View invoices', route: '/invoicing' },
      generatedAt: new Date().toISOString(),
    })
  }
  if (overdueBalance > 0) {
    const severity: Severity = overdueBalance > 20_000 ? 'high' : 'medium'
    out.push({
      id: 'cashflow:overdue',
      type: 'cashflow_window',
      severity,
      title: `$${Math.round(overdueBalance).toLocaleString()} sitting overdue`,
      message: `${overdueLot.length} invoice${overdueLot.length === 1 ? '' : 's'} past due. Reminders + payment-link nudges recover ~70% of this within 14 days.`,
      metric: { value: `$${Math.round(overdueBalance).toLocaleString()}` },
      confidence: 0.85,
      suggestedAction: { label: 'View invoices', route: '/invoicing' },
      generatedAt: new Date().toISOString(),
    })
  }
  return out
}

async function genAtRiskOKRs(): Promise<Insight[]> {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3) + 1
  const year = now.getFullYear()
  const quarter = `Q${q}`
  // Days elapsed in quarter
  const qStartMonth = (q - 1) * 3
  const qStart = new Date(year, qStartMonth, 1)
  const elapsedDays = Math.max(1, Math.floor((now.getTime() - qStart.getTime()) / 86_400_000))
  const expectedPace = Math.min(100, Math.round((elapsedDays / 90) * 100))

  const okrs = await prisma.oKR.findMany({
    where: { quarter, year },
    include: {
      department: { select: { name: true } },
      keyResults: { select: { target: true, current: true } },
    },
  })

  return okrs
    .map((o) => {
      if (o.keyResults.length === 0) return null
      const progress = Math.round(
        o.keyResults.reduce((s, kr) => s + (kr.target > 0 ? Math.min(100, (kr.current / kr.target) * 100) : 0), 0) /
          o.keyResults.length,
      )
      const gap = expectedPace - progress
      if (gap < 15) return null
      const severity: Severity = gap >= 40 ? 'critical' : gap >= 25 ? 'high' : 'medium'
      const insight: Insight = {
        id: `okr:${o.id}`,
        type: 'at_risk_okr',
        severity,
        title: `${o.objective} is ${gap}pts behind pace`,
        message: `Quarter is ${expectedPace}% through, objective is at ${progress}%. ${o.department?.name ?? 'Team'} owns it.`,
        metric: { value: `${progress}%`, trend: -gap },
        evidence: [{ entityType: 'okr', entityId: o.id, label: o.objective }],
        confidence: 0.7,
        suggestedAction: { label: 'Review OKRs', route: '/okrs' },
        generatedAt: new Date().toISOString(),
      }
      return insight
    })
    .filter((x): x is Insight => x !== null)
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 4)
}

async function genCapacityWarning(): Promise<Insight[]> {
  const weekStart = new Date(Date.now() - 7 * 86_400_000)
  const entries = await prisma.timeEntry.findMany({
    where: { date: { gte: weekStart } },
    select: { hours: true, userId: true, user: { select: { name: true, departmentId: true } } },
  })
  const byUser = new Map<string, { name: string; hours: number }>()
  for (const e of entries) {
    if (!e.user) continue
    const entry = byUser.get(e.userId) ?? { name: e.user.name, hours: 0 }
    entry.hours += e.hours
    byUser.set(e.userId, entry)
  }

  const out: Insight[] = []
  for (const [userId, { name, hours }] of byUser.entries()) {
    const pct = Math.round((hours / 40) * 100)
    if (pct < 95) continue
    out.push({
      id: `capacity:${userId}`,
      type: 'capacity_warning',
      severity: pct >= 120 ? 'high' : 'medium',
      title: `${name} is at ${pct}% capacity this week`,
      message: `${hours}h logged against a 40h baseline. Sustained overload predicts burnout — consider redistributing or hiring.`,
      metric: { value: `${pct}%` },
      evidence: [{ entityType: 'user', entityId: userId, label: name }],
      confidence: 0.75,
      suggestedAction: { label: 'View team', route: '/employees' },
      generatedAt: new Date().toISOString(),
    })
  }
  return out.slice(0, 4)
}

async function genRuleSuggestions(): Promise<Insight[]> {
  // Pattern 1: invoices that were overdue >14 days before being marked paid → suggest a
  // tighter overdue notification rule.
  const longOverdue = await prisma.invoice.findMany({
    where: { paidAt: { not: null } },
    select: { dueDate: true, paidAt: true },
    take: 200,
    orderBy: { paidAt: 'desc' },
  })
  let slowCount = 0
  let avgLatencyDays = 0
  for (const inv of longOverdue) {
    if (!inv.paidAt) continue
    const latency = (inv.paidAt.getTime() - inv.dueDate.getTime()) / 86_400_000
    if (latency > 14) {
      slowCount++
      avgLatencyDays += latency
    }
  }
  const out: Insight[] = []
  if (slowCount >= 3) {
    avgLatencyDays = Math.round(avgLatencyDays / slowCount)
    const existing = await prisma.actionRule.findFirst({
      where: { trigger: 'INVOICE_OVERDUE', actionType: 'ESCALATE', isActive: true },
    })
    if (!existing) {
      out.push({
        id: 'suggest:invoice_escalate',
        type: 'rule_suggestion',
        severity: 'medium',
        title: 'Suggested rule: escalate stuck invoices to CEO',
        message: `${slowCount} invoices were overdue ~${avgLatencyDays}d before payment. An ESCALATE rule at day 7 would have flagged them earlier.`,
        confidence: 0.8,
        suggestedAction: {
          label: 'Create rule',
          route: '/ai-engine',
          action: {
            kind: 'create_rule',
            trigger: 'INVOICE_OVERDUE',
            actionType: 'ESCALATE',
            config: { escalateTo: 'CEO', thresholdDays: 7 },
          },
        },
        generatedAt: new Date().toISOString(),
      })
    }
  }

  // Pattern 2: clients with low NPS but no NPS_LOW rule
  const lowNpsClients = await prisma.client.count({
    where: { status: 'active', npsScore: { lte: 5 } },
  })
  if (lowNpsClients >= 2) {
    const existing = await prisma.actionRule.findFirst({ where: { trigger: 'NPS_LOW', isActive: true } })
    if (!existing) {
      out.push({
        id: 'suggest:nps_low',
        type: 'rule_suggestion',
        severity: 'medium',
        title: 'Suggested rule: notify on low NPS',
        message: `${lowNpsClients} active clients have NPS ≤ 5. A NOTIFY_ROLE rule keeps account managers in the loop the moment NPS drops.`,
        confidence: 0.75,
        suggestedAction: {
          label: 'Create rule',
          route: '/ai-engine',
          action: {
            kind: 'create_rule',
            trigger: 'NPS_LOW',
            actionType: 'NOTIFY_ROLE',
            config: { recipientRole: 'MANAGER' },
          },
        },
        generatedAt: new Date().toISOString(),
      })
    }
  }
  return out
}

function severityRank(s: Severity): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[s]
}

// ─────────────────────────────────────────────────────────
// In-memory cache
// ─────────────────────────────────────────────────────────
const CACHE_MS = 5 * 60 * 1000
let cache: { insights: Insight[]; generatedAt: string; expiresAt: number } | null = null

async function generateAll(): Promise<Insight[]> {
  const results = await Promise.allSettled([
    genChurnRisk(),
    genStuckLeads(),
    genCashflowWindow(),
    genAtRiskOKRs(),
    genCapacityWarning(),
    genRuleSuggestions(),
  ])
  const all: Insight[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
    else console.error('[Insights] generator failed', r.reason)
  }
  return all.sort((a, b) => {
    if (severityRank(a.severity) !== severityRank(b.severity)) {
      return severityRank(a.severity) - severityRank(b.severity)
    }
    return b.confidence - a.confidence
  })
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const force = req.query.refresh === 'true'
    if (!force && cache && cache.expiresAt > Date.now()) {
      return res.json({ insights: cache.insights, generatedAt: cache.generatedAt, cached: true })
    }
    const insights = await generateAll()
    const generatedAt = new Date().toISOString()
    cache = { insights, generatedAt, expiresAt: Date.now() + CACHE_MS }
    res.json({ insights, generatedAt, cached: false })
  } catch (err) {
    next(err)
  }
})

export { router as insightsRouter }
