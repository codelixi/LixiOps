import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Projects list hook — maps the server shape into the flat
// row the list page renders. Tasks/team counts come from the
// Prisma `_count` include. Status is derived from health because
// the Project model tracks health (ON_TRACK/AT_RISK/DELAYED/COMPLETED)
// rather than a separate lifecycle state.
// ───────────────────────────────────────────

export interface ProjectListItem {
  id: string
  name: string
  client: string
  status: 'active' | 'completed' | 'on-hold' | 'planning'
  health: 'on-track' | 'at-risk' | 'delayed'
  progress: number
  budget: number
  spent: number
  startDate: string
  dueDate: string
  teamSize: number
  teamAvatars: string[]
  tasksCompleted: number
  tasksTotal: number
  type: string
}

interface ServerProject {
  id: string
  name: string
  health: string
  progress: number
  contractValue: number | null
  startDate: string | null
  goLiveDate: string | null
  createdAt: string
  client: { id: string; company: string; email: string } | null
  lead: { id: string; company: string; agreedValue: number | null } | null
  _count: { tasks: number; milestones: number; risks: number; invoices: number }
}

const FALLBACK: ProjectListItem[] = [
  { id: '1', name: 'Bella Cucina Rebrand', client: 'Bella Cucina', status: 'active', health: 'on-track', progress: 72, budget: 25000, spent: 18000, startDate: 'Feb 1', dueDate: 'Apr 30', teamSize: 4, teamAvatars: ['Sarah Chen', 'Amir Khan', 'Raj Patel', 'Emily Torres'], tasksCompleted: 28, tasksTotal: 39, type: 'Branding' },
  { id: '2', name: 'CareFirst Patient Portal', client: 'CareFirst Health', status: 'active', health: 'at-risk', progress: 45, budget: 60000, spent: 35000, startDate: 'Jan 15', dueDate: 'May 15', teamSize: 5, teamAvatars: ['Sarah Chen', 'Raj Patel', 'David Park', 'Fatima Zahra', 'Emily Torres'], tasksCompleted: 18, tasksTotal: 40, type: 'Web App' },
  { id: '3', name: 'DataFlow Dashboard v2', client: 'DataFlow Inc', status: 'active', health: 'delayed', progress: 55, budget: 80000, spent: 52000, startDate: 'Dec 1', dueDate: 'Apr 15', teamSize: 6, teamAvatars: ['Sarah Chen', 'Raj Patel', 'David Park'], tasksCompleted: 33, tasksTotal: 60, type: 'SaaS' },
]

function mapHealth(h: string): ProjectListItem['health'] {
  const v = h.toUpperCase()
  if (v === 'AT_RISK') return 'at-risk'
  if (v === 'DELAYED') return 'delayed'
  return 'on-track'
}

function mapStatus(health: string, progress: number): ProjectListItem['status'] {
  if (health.toUpperCase() === 'COMPLETED' || progress >= 100) return 'completed'
  if (progress === 0) return 'planning'
  return 'active'
}

function shortDate(iso: string | null) {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function mapProject(p: ServerProject): ProjectListItem {
  return {
    id: p.id,
    name: p.name,
    client: p.client?.company || p.lead?.company || '—',
    status: mapStatus(p.health, p.progress),
    health: mapHealth(p.health),
    progress: p.progress,
    budget: p.contractValue ?? 0,
    // No true "spent" field in the schema yet — approximate as budget × progress%.
    spent: Math.round((p.contractValue ?? 0) * (p.progress / 100)),
    startDate: shortDate(p.startDate),
    dueDate: shortDate(p.goLiveDate),
    teamSize: 0, // Requires project_members relation, future addition
    teamAvatars: [],
    tasksCompleted: 0, // Prisma _count doesn't split by status — UI expects split
    tasksTotal: p._count?.tasks ?? 0,
    type: 'Project',
  }
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectListItem[]>(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get<{ projects: ServerProject[] }>('/projects')
        if (cancelled) return
        setProjects(res.projects.map(mapProject))
        setUsingFallback(false)
      } catch (err) {
        if (!cancelled) setUsingFallback(err instanceof ApiError && err.status === 0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { projects, loading, usingFallback }
}
