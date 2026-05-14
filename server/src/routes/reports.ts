import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// Reports aggregator — one endpoint that returns everything the
// /reports page needs. Period-aware (7d/30d/90d/12m) with prior-period
// comparisons for KPI deltas. All math happens in JS after small focused
// queries so we don't bury the route in raw SQL.
// ───────────────────────────────────────────

type Period = '7d' | '30d' | '90d' | '12m'

const PERIOD_DAYS: Record<Period, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12m': 365,
}

function periodFromQuery(q: unknown): Period {
  if (q === '7d' || q === '30d' || q === '90d' || q === '12m') return q
  return '12m'
}

function startOfPeriod(period: Period, now = new Date()): Date {
  const d = new Date(now)
  d.setDate(d.getDate() - PERIOD_DAYS[period])
  d.setHours(0, 0, 0, 0)
  return d
}

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100
  return Math.round(((curr - prev) / prev) * 1000) / 10
}

function monthKey(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short' })
}

const SERVICE_COLORS = ['#ff5b01', '#1a1a1a', '#f59e0b', '#6366f1', '#94a3b8', '#22c55e', '#3b82f6']

router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = periodFromQuery(req.query.period)
    const now = new Date()
    const periodStart = startOfPeriod(period, now)
    const priorStart = new Date(periodStart.getTime() - PERIOD_DAYS[period] * 86_400_000)

    // For revenue history we always pull 8 months for the chart. KPIs use the
    // selected period.
    const eightMonthsAgo = new Date(now)
    eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 7)
    eightMonthsAgo.setDate(1)
    eightMonthsAgo.setHours(0, 0, 0, 0)

    const [
      paymentsHistory,
      profitability,
      paymentsCurr,
      paymentsPrior,
      projectsActive,
      projectsAll,
      clientsAll,
      invoicesAll,
      invoicesPaidCurr,
      invoicesPaidPrior,
      timeEntriesCurr,
      timeEntriesPrior,
      employees,
      topProjects,
      revenueByVertical,
    ] = await Promise.all([
      // Last 8 months of payments for the area chart
      prisma.payment.findMany({
        where: { createdAt: { gte: eightMonthsAgo } },
        select: { amount: true, createdAt: true, invoice: { select: { project: { select: { profitability: { select: { actualCost: true } } } } } } },
      }),
      // Actual cost roll-up for expenses series + margin KPI
      prisma.projectProfitability.aggregate({
        _sum: { actualCost: true, revenue: true },
      }),
      // Total revenue this period
      prisma.payment.aggregate({
        where: { createdAt: { gte: periodStart, lte: now } },
        _sum: { amount: true },
      }),
      // Total revenue previous period
      prisma.payment.aggregate({
        where: { createdAt: { gte: priorStart, lt: periodStart } },
        _sum: { amount: true },
      }),
      // Active projects (avg value)
      prisma.project.findMany({
        where: { health: { not: 'COMPLETED' } },
        select: { contractValue: true },
      }),
      // All projects with contract value (lifetime avg baseline)
      prisma.project.findMany({ select: { contractValue: true } }),
      // Client retention base
      prisma.client.findMany({ select: { status: true } }),
      // Invoice status pie
      prisma.invoice.findMany({ select: { status: true } }),
      // Avg cycle: paid invoices in period
      prisma.invoice.findMany({
        where: { paidAt: { gte: periodStart, lte: now }, sentAt: { not: null } },
        select: { sentAt: true, paidAt: true },
      }),
      prisma.invoice.findMany({
        where: { paidAt: { gte: priorStart, lt: periodStart }, sentAt: { not: null } },
        select: { sentAt: true, paidAt: true },
      }),
      // Team utilization (this period vs prior)
      prisma.timeEntry.findMany({
        where: { date: { gte: periodStart, lte: now } },
        select: { hours: true, user: { select: { departmentId: true, department: { select: { name: true } } } } },
      }),
      prisma.timeEntry.findMany({
        where: { date: { gte: priorStart, lt: periodStart } },
        select: { hours: true },
      }),
      // Employee count for utilization denominator
      prisma.user.count({ where: { role: { in: ['EMPLOYEE', 'MANAGER'] as any } } }),
      // Top 5 projects by spend (with budget for comparison)
      prisma.project.findMany({
        orderBy: { contractValue: 'desc' },
        take: 5,
        select: {
          name: true,
          contractValue: true,
          invoices: { select: { paidAmount: true } },
        },
      }),
      // Revenue by vertical (proxy for service line)
      prisma.invoice.findMany({
        where: { status: { in: ['paid', 'partial'] } },
        select: { paidAmount: true, client: { select: { vertical: true } } },
      }),
    ])

    // ────── Revenue history (last 8 months) ──────
    const monthBuckets = new Map<string, { month: string; revenue: number; expenses: number; sortKey: number }>()
    const cursor = new Date(eightMonthsAgo)
    for (let i = 0; i < 8; i++) {
      const key = monthKey(cursor)
      monthBuckets.set(key, { month: key, revenue: 0, expenses: 0, sortKey: cursor.getFullYear() * 12 + cursor.getMonth() })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    for (const p of paymentsHistory) {
      const key = monthKey(new Date(p.createdAt))
      const bucket = monthBuckets.get(key)
      if (bucket) bucket.revenue += p.amount
    }
    // Estimate expenses by spreading total ProjectProfitability.actualCost across
    // months proportional to revenue (placeholder until expense tracking ships).
    const totalActualCost = profitability._sum.actualCost ?? 0
    const totalRevenueAll = Array.from(monthBuckets.values()).reduce((s, b) => s + b.revenue, 0)
    if (totalActualCost > 0 && totalRevenueAll > 0) {
      for (const b of monthBuckets.values()) {
        b.expenses = Math.round((b.revenue / totalRevenueAll) * totalActualCost)
      }
    }
    const revenueData = Array.from(monthBuckets.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ month, revenue, expenses }) => ({ month, revenue, expenses }))

    // ────── KPIs ──────
    const totalRevenueCurr = paymentsCurr._sum.amount ?? 0
    const totalRevenuePrior = paymentsPrior._sum.amount ?? 0
    const avgProjectValue =
      projectsActive.length > 0
        ? projectsActive.reduce((s, p) => s + p.contractValue, 0) / projectsActive.length
        : projectsAll.length > 0
          ? projectsAll.reduce((s, p) => s + p.contractValue, 0) / projectsAll.length
          : 0
    const activeClients = clientsAll.filter((c) => c.status === 'active').length
    const retentionPct = clientsAll.length > 0 ? Math.round((activeClients / clientsAll.length) * 100) : 0

    const totalProfitabilityRev = profitability._sum.revenue ?? 0
    const profitMargin =
      totalProfitabilityRev > 0
        ? Math.round(((totalProfitabilityRev - totalActualCost) / totalProfitabilityRev) * 100)
        : 0

    const periodWeeks = PERIOD_DAYS[period] / 7
    const billableCapacity = Math.max(employees, 1) * 40 * periodWeeks
    const billedHoursCurr = timeEntriesCurr.reduce((s, t) => s + t.hours, 0)
    const billedHoursPrior = timeEntriesPrior.reduce((s, t) => s + t.hours, 0)
    const utilization = Math.min(100, Math.round((billedHoursCurr / billableCapacity) * 100))
    const utilizationPrior = Math.min(100, Math.round((billedHoursPrior / billableCapacity) * 100))

    const cycleCurr =
      invoicesPaidCurr.length > 0
        ? invoicesPaidCurr.reduce((s, i) => s + (i.paidAt!.getTime() - i.sentAt!.getTime()) / 86_400_000, 0) /
          invoicesPaidCurr.length
        : 0
    const cyclePrior =
      invoicesPaidPrior.length > 0
        ? invoicesPaidPrior.reduce((s, i) => s + (i.paidAt!.getTime() - i.sentAt!.getTime()) / 86_400_000, 0) /
          invoicesPaidPrior.length
        : 0

    const kpiCards = [
      {
        label: 'Total Revenue',
        value: `$${Math.round(totalRevenueCurr).toLocaleString()}`,
        change: pctChange(totalRevenueCurr, totalRevenuePrior),
        period: 'vs prior period',
      },
      {
        label: 'Avg Project Value',
        value: `$${Math.round(avgProjectValue).toLocaleString()}`,
        change: 0,
        period: 'all active projects',
      },
      {
        label: 'Client Retention',
        value: `${retentionPct}%`,
        change: 0,
        period: `${activeClients}/${clientsAll.length} active`,
      },
      {
        label: 'Profit Margin',
        value: `${profitMargin}%`,
        change: 0,
        period: 'lifetime',
      },
      {
        label: 'Team Utilization',
        value: `${utilization}%`,
        change: pctChange(utilization, utilizationPrior),
        period: 'vs prior period',
      },
      {
        label: 'Avg Invoice Cycle',
        value: `${Math.round(cycleCurr)} days`,
        change: pctChange(cycleCurr, cyclePrior),
        period: 'vs prior period',
      },
    ]

    // ────── Project performance ──────
    const projectPerformance = topProjects.map((p) => ({
      name: p.name.length > 18 ? p.name.slice(0, 17) + '…' : p.name,
      budget: p.contractValue,
      spent: p.invoices.reduce((s, i) => s + i.paidAmount, 0),
    }))

    // ────── Invoice status pie ──────
    const statusCounts = new Map<string, number>()
    for (const inv of invoicesAll) {
      statusCounts.set(inv.status, (statusCounts.get(inv.status) ?? 0) + 1)
    }
    const STATUS_COLOR: Record<string, string> = {
      paid: '#22c55e',
      sent: '#3b82f6',
      overdue: '#ef4444',
      draft: '#94a3b8',
      partial: '#f59e0b',
    }
    const totalInv = invoicesAll.length || 1
    const invoiceStatus = Array.from(statusCounts.entries()).map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: Math.round((count / totalInv) * 100),
      color: STATUS_COLOR[name] ?? '#a3a3a3',
    }))

    // ────── Revenue by vertical ──────
    const verticalSums = new Map<string, number>()
    let verticalTotal = 0
    for (const inv of revenueByVertical) {
      const v = inv.client?.vertical ?? 'Other'
      const amt = inv.paidAmount
      verticalSums.set(v, (verticalSums.get(v) ?? 0) + amt)
      verticalTotal += amt
    }
    const revenueByService = Array.from(verticalSums.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, sum], i) => ({
        name,
        value: verticalTotal > 0 ? Math.round((sum / verticalTotal) * 100) : 0,
        color: SERVICE_COLORS[i % SERVICE_COLORS.length],
      }))

    // ────── Team utilization by department ──────
    const deptHours = new Map<string, number>()
    for (const e of timeEntriesCurr) {
      const name = e.user?.department?.name ?? 'Unassigned'
      deptHours.set(name, (deptHours.get(name) ?? 0) + e.hours)
    }
    // Approximate capacity by average headcount per dept × period weeks × 40h/week.
    // We don't have per-dept headcount in this query; use total employees / dept count.
    const deptCount = Math.max(deptHours.size, 1)
    const perDeptCapacity = (Math.max(employees, 1) / deptCount) * 40 * periodWeeks
    const teamUtilization = Array.from(deptHours.entries())
      .map(([name, hours]) => ({
        name,
        utilization: Math.min(100, Math.round((hours / Math.max(perDeptCapacity, 1)) * 100)),
        capacity: 100,
      }))
      .sort((a, b) => b.utilization - a.utilization)

    res.json({
      period,
      kpiCards,
      revenueData,
      revenueByService,
      projectPerformance,
      invoiceStatus,
      teamUtilization,
    })
  } catch (err) {
    next(err)
  }
})

export { router as reportsRouter }
