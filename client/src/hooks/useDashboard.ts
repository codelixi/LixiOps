import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Dashboard data hook — pulls metrics/projects/pulse/team-today
// in parallel from `/api/v1/dashboard/*`. Falls back to local
// demo data when the backend is unreachable so the UI remains
// reviewable without a running server.
// ───────────────────────────────────────────

export interface DashboardMetrics {
  mrr: number
  mrrChange: number
  activeProjects: number
  newProjectsThisWeek: number
  openInvoices: number
  invoiceChange: number
  teamOnline: number
  teamTotal: number
}

export interface DashboardProject {
  id: string
  name: string
  client: string
  progress: number
  health: 'on-track' | 'at-risk' | 'delayed'
  value: number
}

export interface DashboardPulse {
  mrr: number
  openInvoices: number
  tasksInProgress: number
  hotLeads: number
  overdueBugs: number
}

export interface TeamMember {
  id: string
  name: string
  role: string
  status: 'online' | 'busy' | 'away' | 'offline'
  task: string
  hours: string
}

const FALLBACK_METRICS: DashboardMetrics = {
  mrr: 47200, mrrChange: 12.5,
  activeProjects: 12, newProjectsThisWeek: 2,
  openInvoices: 18400, invoiceChange: -8,
  teamOnline: 8, teamTotal: 11,
}

const FALLBACK_PROJECTS: DashboardProject[] = [
  { id: '1', name: 'RestaurantOS', client: 'Bella Cucina', progress: 72, health: 'on-track', value: 18000 },
  { id: '2', name: 'BookingApp', client: 'CareFirst Health', progress: 45, health: 'at-risk', value: 24000 },
  { id: '3', name: 'E-Commerce v3', client: 'Urban Threads', progress: 90, health: 'on-track', value: 12000 },
  { id: '4', name: 'SaaS Dashboard', client: 'DataFlow Inc', progress: 28, health: 'on-track', value: 32000 },
  { id: '5', name: 'Mobile App', client: 'FitTrack', progress: 15, health: 'delayed', value: 22000 },
]

const FALLBACK_PULSE: DashboardPulse = {
  mrr: 47200, openInvoices: 18400, tasksInProgress: 34, hotLeads: 7, overdueBugs: 3,
}

const FALLBACK_TEAM: TeamMember[] = [
  { id: '1', name: 'Sarah Chen', role: 'Lead Developer', status: 'online', task: 'API Integration', hours: '4h 32m' },
  { id: '2', name: 'James Wilson', role: 'Designer', status: 'busy', task: 'Brand Kit Review', hours: '3h 15m' },
  { id: '3', name: 'Maria Garcia', role: 'Sales Rep', status: 'online', task: 'Client Outreach', hours: '5h 08m' },
  { id: '4', name: 'Alex Kim', role: 'Developer', status: 'away', task: 'Bug Fix #247', hours: '2h 45m' },
  { id: '5', name: 'David Park', role: 'Operations', status: 'online', task: 'SLA Audit', hours: '4h 10m' },
]

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(FALLBACK_METRICS)
  const [projects, setProjects] = useState<DashboardProject[]>(FALLBACK_PROJECTS)
  const [pulse, setPulse] = useState<DashboardPulse>(FALLBACK_PULSE)
  const [team, setTeam] = useState<TeamMember[]>(FALLBACK_TEAM)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [m, p, pl, t] = await Promise.all([
          api.get<{ data: DashboardMetrics }>('/dashboard/metrics'),
          api.get<{ data: DashboardProject[] }>('/dashboard/projects'),
          api.get<{ data: DashboardPulse }>('/dashboard/pulse'),
          api.get<{ data: TeamMember[] }>('/dashboard/team-today'),
        ])
        if (cancelled) return
        setMetrics(m.data)
        setProjects(p.data)
        setPulse(pl.data)
        setTeam(t.data)
        setUsingFallback(false)
      } catch (err) {
        // Network or 5xx: keep fallback data, flag it so the UI can warn.
        if (!cancelled) {
          setUsingFallback(err instanceof ApiError && err.status === 0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const id = setInterval(load, 60_000) // matches "Refreshes every 60 seconds" label
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return { metrics, projects, pulse, team, loading, usingFallback }
}
