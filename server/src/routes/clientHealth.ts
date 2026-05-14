import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { requireManager } from '../middleware/authenticate.js'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// Client Health — analytics surface on top of the Client model.
// Aggregates each active client with:
//   • stored fields:       healthScore, npsScore, contractValue
//   • derived signals:     openIssues (active Risks),
//                          lastInteraction (most recent of comments /
//                          invoices / interactions),
//                          slaCompliance (% invoices paid on/before due),
//                          trend ('improving' / 'declining' / 'stable',
//                          heuristic — no history table yet),
//                          riskFactors (top open Risk titles).
//
// Two write endpoints:
//   PATCH /clients/:id        — set healthScore (CEO/MANAGER)
//   POST  /clients/:id/nps    — record NPS score
// ───────────────────────────────────────────

const HEALTH_AT_RISK = 70
const HEALTH_HEALTHY = 80

const STALE_INTERACTION_DAYS = 14
const RECENT_INTERACTION_DAYS = 7

interface ClientSnapshot {
  id: string
  company: string
  contactName: string
  vertical: string | null
  status: string
  healthScore: number
  npsScore: number | null
  contractValue: number
  lastInteractionAt: string | null
  lastInteractionLabel: string
  openIssues: number
  slaCompliance: number
  trend: 'improving' | 'declining' | 'stable'
  riskFactors: string[]
}

function daysAgo(d: Date | null | undefined): number {
  if (!d) return Number.POSITIVE_INFINITY
  return Math.max(0, (Date.now() - d.getTime()) / 86_400_000)
}

function relativeLabel(d: Date | null): string {
  if (!d) return 'no activity yet'
  const ms = Date.now() - d.getTime()
  if (ms < 0) return 'just now'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return min === 0 ? 'just now' : `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  if (day < 30) return `${Math.floor(day / 7)}w ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Derive a health score when none has been set manually. Caps at 100, floors at 0.
 * Inputs that pull it down: open risks, stale activity, overdue invoices, low NPS.
 */
function deriveHealthScore(opts: {
  npsScore: number | null
  openIssues: number
  daysSinceInteraction: number
  overdueInvoices: number
}): number {
  let score = 80
  if (opts.npsScore != null) {
    if (opts.npsScore >= 8) score += 10
    else if (opts.npsScore <= 5) score -= 15
    else if (opts.npsScore <= 3) score -= 30
  }
  score -= Math.min(30, opts.openIssues * 8)
  if (opts.daysSinceInteraction >= 30) score -= 25
  else if (opts.daysSinceInteraction >= STALE_INTERACTION_DAYS) score -= 12
  score -= Math.min(20, opts.overdueInvoices * 7)
  return Math.max(0, Math.min(100, Math.round(score)))
}

function deriveTrend(opts: {
  health: number
  npsScore: number | null
  openIssues: number
  daysSinceInteraction: number
}): 'improving' | 'declining' | 'stable' {
  if (opts.openIssues >= 2 || (opts.npsScore != null && opts.npsScore <= 5) || opts.daysSinceInteraction >= STALE_INTERACTION_DAYS) {
    return 'declining'
  }
  if ((opts.npsScore ?? 0) >= 8 && opts.openIssues === 0 && opts.daysSinceInteraction <= RECENT_INTERACTION_DAYS) {
    return 'improving'
  }
  return 'stable'
}

router.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Fan out all the queries we need to compute a snapshot per active client.
    const clients = await prisma.client.findMany({
      where: { status: { in: ['active', 'paused'] } },
      orderBy: [{ status: 'asc' }, { contractValue: 'desc' }],
      include: {
        interactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
        projects: {
          select: {
            id: true,
            updatedAt: true,
            risks: {
              where: { status: 'open' },
              orderBy: { riskScore: 'desc' },
              select: { id: true, title: true, riskScore: true },
            },
          },
        },
        invoices: {
          select: { status: true, dueDate: true, paidAt: true, updatedAt: true },
        },
      },
    })

    const now = new Date()
    const snapshots: ClientSnapshot[] = clients.map((c) => {
      // Most recent client touchpoint (interaction / project update / invoice activity)
      const interactionAt = c.interactions[0]?.createdAt ?? null
      const projectUpdate = c.projects.reduce<Date | null>(
        (acc, p) => (acc === null || p.updatedAt > acc ? p.updatedAt : acc),
        null,
      )
      const invoiceUpdate = c.invoices.reduce<Date | null>(
        (acc, i) => (acc === null || i.updatedAt > acc ? i.updatedAt : acc),
        null,
      )
      const lastTouch = [interactionAt, projectUpdate, invoiceUpdate].reduce<Date | null>(
        (acc, d) => (acc === null || (d && d > acc) ? d ?? acc : acc),
        null,
      )

      const openRisks = c.projects.flatMap((p) => p.risks)
      const openIssues = openRisks.length
      const riskFactors = openRisks.slice(0, 3).map((r) => r.title)

      const paidInvoices = c.invoices.filter((i) => i.paidAt && i.dueDate)
      const onTime = paidInvoices.filter((i) => i.paidAt! <= i.dueDate).length
      const slaCompliance = paidInvoices.length > 0 ? Math.round((onTime / paidInvoices.length) * 100) : 100

      const overdueInvoices = c.invoices.filter(
        (i) => (i.status === 'sent' || i.status === 'partial' || i.status === 'overdue') && i.dueDate < now,
      ).length

      const days = daysAgo(lastTouch)
      const derivedHealth = deriveHealthScore({
        npsScore: c.npsScore,
        openIssues,
        daysSinceInteraction: days,
        overdueInvoices,
      })
      const healthScore = c.healthScore ?? derivedHealth
      const trend = deriveTrend({
        health: healthScore,
        npsScore: c.npsScore,
        openIssues,
        daysSinceInteraction: days,
      })

      return {
        id: c.id,
        company: c.company,
        contactName: c.contactName,
        vertical: c.vertical,
        status: c.status,
        healthScore,
        npsScore: c.npsScore,
        contractValue: c.contractValue,
        lastInteractionAt: lastTouch ? lastTouch.toISOString() : null,
        lastInteractionLabel: relativeLabel(lastTouch),
        openIssues,
        slaCompliance,
        trend,
        riskFactors,
      }
    })

    // Sort: declining first, then by health asc so the worst rise to the top.
    snapshots.sort((a, b) => {
      const t = (x: typeof a) => (x.trend === 'declining' ? 0 : x.trend === 'stable' ? 1 : 2)
      if (t(a) !== t(b)) return t(a) - t(b)
      return a.healthScore - b.healthScore
    })

    // Roll-up stats
    const scoredClients = snapshots.filter((s) => s.healthScore > 0)
    const avgHealth =
      scoredClients.length > 0
        ? Math.round(scoredClients.reduce((s, c) => s + c.healthScore, 0) / scoredClients.length)
        : 0
    const healthy = snapshots.filter((s) => s.healthScore >= HEALTH_HEALTHY).length
    const atRisk = snapshots.filter((s) => s.healthScore < HEALTH_AT_RISK).length
    const openIssuesTotal = snapshots.reduce((s, c) => s + c.openIssues, 0)
    const npsScored = snapshots.filter((s) => s.npsScore != null)
    const avgNps =
      npsScored.length > 0
        ? Math.round((npsScored.reduce((s, c) => s + (c.npsScore ?? 0), 0) / npsScored.length) * 10) / 10
        : null

    res.json({
      stats: {
        avgHealth,
        healthy,
        atRisk,
        openIssues: openIssuesTotal,
        avgNps,
        total: snapshots.length,
      },
      clients: snapshots,
    })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// PATCH /clients/:id — manually set healthScore (CEO/MANAGER)
// Range: 0..100, with null to clear (so the derived score takes over).
// ═══════════════════════════════════════════
const patchHealthSchema = z.object({
  healthScore: z.number().int().min(0).max(100).nullable(),
})

router.patch('/clients/:id', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  const parse = patchHealthSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const id = String(req.params.id)
  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Client not found'))
  const client = await prisma.client.update({
    where: { id },
    data: { healthScore: parse.data.healthScore },
  })
  res.json({ client })
})

// ═══════════════════════════════════════════
// POST /clients/:id/nps — record an NPS score (anyone authenticated)
// Stored as the latest npsScore on the Client row.
// ═══════════════════════════════════════════
const npsSchema = z.object({
  npsScore: z.number().int().min(0).max(10),
})

router.post('/clients/:id/nps', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const parse = npsSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }
  const id = String(req.params.id)
  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Client not found'))
  const client = await prisma.client.update({
    where: { id },
    data: { npsScore: parse.data.npsScore },
  })
  res.json({ client })
})

export { router as clientHealthRouter }
