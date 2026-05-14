import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Reports hook — pulls the aggregated dashboard payload for a
// period (7d / 30d / 90d / 12m). Falls back to demo data offline so
// the page stays reviewable.
// ───────────────────────────────────────────

export type Period = '7d' | '30d' | '90d' | '12m'

export interface KpiCard {
  label: string
  value: string
  change: number
  period: string
}

export interface RevenuePoint {
  month: string
  revenue: number
  expenses: number
}

export interface PieSlice {
  name: string
  value: number
  color: string
}

export interface ProjectBar {
  name: string
  budget: number
  spent: number
}

export interface DeptUtilization {
  name: string
  utilization: number
  capacity: number
}

export interface ReportsOverview {
  period: Period
  kpiCards: KpiCard[]
  revenueData: RevenuePoint[]
  revenueByService: PieSlice[]
  projectPerformance: ProjectBar[]
  invoiceStatus: PieSlice[]
  teamUtilization: DeptUtilization[]
}

const FALLBACK: ReportsOverview = {
  period: '12m',
  kpiCards: [
    { label: 'Total Revenue', value: '$297,200', change: 18.2, period: 'vs prior period' },
    { label: 'Avg Project Value', value: '$38,500', change: 0, period: 'all active projects' },
    { label: 'Client Retention', value: '94%', change: 0, period: '16/17 active' },
    { label: 'Profit Margin', value: '42%', change: 0, period: 'lifetime' },
    { label: 'Team Utilization', value: '87%', change: 4.2, period: 'vs prior period' },
    { label: 'Avg Invoice Cycle', value: '12 days', change: -3.0, period: 'vs prior period' },
  ],
  revenueData: [
    { month: 'Sep', revenue: 28000, expenses: 18000 },
    { month: 'Oct', revenue: 32000, expenses: 20000 },
    { month: 'Nov', revenue: 35000, expenses: 22000 },
    { month: 'Dec', revenue: 30000, expenses: 19000 },
    { month: 'Jan', revenue: 38000, expenses: 21000 },
    { month: 'Feb', revenue: 42000, expenses: 24000 },
    { month: 'Mar', revenue: 45000, expenses: 23000 },
    { month: 'Apr', revenue: 47200, expenses: 25000 },
  ],
  revenueByService: [
    { name: 'Web Development', value: 45, color: '#ff5b01' },
    { name: 'Branding', value: 22, color: '#1a1a1a' },
    { name: 'Mobile Apps', value: 18, color: '#f59e0b' },
    { name: 'Consulting', value: 10, color: '#6366f1' },
    { name: 'Maintenance', value: 5, color: '#94a3b8' },
  ],
  projectPerformance: [
    { name: 'Bella Cucina', budget: 25000, spent: 18000 },
    { name: 'CareFirst', budget: 60000, spent: 35000 },
    { name: 'Urban Threads', budget: 35000, spent: 10500 },
    { name: 'DataFlow', budget: 80000, spent: 52000 },
    { name: 'Swift Logistics', budget: 45000, spent: 2000 },
  ],
  invoiceStatus: [
    { name: 'Paid', value: 42, color: '#22c55e' },
    { name: 'Sent', value: 28, color: '#3b82f6' },
    { name: 'Overdue', value: 15, color: '#ef4444' },
    { name: 'Draft', value: 15, color: '#94a3b8' },
  ],
  teamUtilization: [
    { name: 'Development', utilization: 92, capacity: 100 },
    { name: 'Design', utilization: 78, capacity: 100 },
    { name: 'Sales', utilization: 85, capacity: 100 },
    { name: 'Operations', utilization: 70, capacity: 100 },
    { name: 'Management', utilization: 65, capacity: 100 },
  ],
}

export function useReports(period: Period) {
  const [data, setData] = useState<ReportsOverview>(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<ReportsOverview>(`/reports/overview?period=${period}`)
      setData(res)
      setUsingFallback(false)
    } catch (err) {
      setUsingFallback(err instanceof ApiError && err.status === 0)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, usingFallback, refresh: load }
}
