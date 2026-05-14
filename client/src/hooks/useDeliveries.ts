import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Delivery Tracker hook — aggregates milestones across projects with
// derived status, progress, and assignee. Supports completing a
// milestone in-line (privileged).
// ───────────────────────────────────────────

export type DeliveryStatus = 'on-track' | 'at-risk' | 'overdue' | 'completed'

export interface Delivery {
  id: string
  project: string
  projectId: string
  client: string
  clientId: string | null
  milestone: string
  phase: string | null
  dueDate: string | null
  status: DeliveryStatus
  progress: number
  assignee: string | null
  assigneeAvatar: string | null
  daysRemaining: number | null
  blockers: number
  invoiceTriggered: boolean
}

export interface DeliveryStats {
  total: number
  active: number
  onTrack: number
  atRisk: number
  overdue: number
  completed: number
}

interface Payload {
  stats: DeliveryStats
  deliveries: Delivery[]
}

const FALLBACK: Payload = {
  stats: { total: 6, active: 5, onTrack: 3, atRisk: 1, overdue: 1, completed: 1 },
  deliveries: [
    { id: 'm3', project: 'DataFlow Dashboard v2', projectId: 'p3', client: 'DataFlow Inc', clientId: 'c3', milestone: 'Sprint 8 deliverables', phase: 'Sprint', dueDate: new Date(Date.now() - 1 * 86_400_000).toISOString(), status: 'overdue', progress: 90, assignee: 'Raj Patel', assigneeAvatar: null, daysRemaining: -1, blockers: 1, invoiceTriggered: false },
    { id: 'm2', project: 'CareFirst Patient Portal', projectId: 'p2', client: 'CareFirst Health', clientId: 'c2', milestone: 'Beta launch', phase: 'Build', dueDate: new Date(Date.now() + 11 * 86_400_000).toISOString(), status: 'at-risk', progress: 60, assignee: 'Sarah Chen', assigneeAvatar: null, daysRemaining: 11, blockers: 2, invoiceTriggered: false },
    { id: 'm1', project: 'Bella Cucina Rebrand', projectId: 'p1', client: 'Bella Cucina', clientId: 'c1', milestone: 'Final brand assets delivery', phase: 'Delivery', dueDate: new Date(Date.now() + 6 * 86_400_000).toISOString(), status: 'on-track', progress: 60, assignee: 'Amir Khan', assigneeAvatar: null, daysRemaining: 6, blockers: 0, invoiceTriggered: false },
    { id: 'm5', project: 'Swift Logistics App', projectId: 'p5', client: 'Swift Logistics', clientId: 'c5', milestone: 'Wireframes approval', phase: 'Design', dueDate: new Date(Date.now() + 13 * 86_400_000).toISOString(), status: 'on-track', progress: 40, assignee: 'Emily Torres', assigneeAvatar: null, daysRemaining: 13, blockers: 0, invoiceTriggered: false },
    { id: 'm4', project: 'Urban Threads E-Commerce', projectId: 'p4', client: 'Urban Threads', clientId: 'c4', milestone: 'Product catalog module', phase: 'Build', dueDate: new Date(Date.now() + 16 * 86_400_000).toISOString(), status: 'on-track', progress: 25, assignee: 'Raj Patel', assigneeAvatar: null, daysRemaining: 16, blockers: 0, invoiceTriggered: false },
    { id: 'm6', project: 'Bella Cucina Rebrand', projectId: 'p1', client: 'Bella Cucina', clientId: 'c1', milestone: 'Social media templates', phase: 'Delivery', dueDate: new Date(Date.now() - 3 * 86_400_000).toISOString(), status: 'completed', progress: 100, assignee: 'Amir Khan', assigneeAvatar: null, daysRemaining: -3, blockers: 0, invoiceTriggered: true },
  ],
}

export function useDeliveries() {
  const [stats, setStats] = useState<DeliveryStats>(FALLBACK.stats)
  const [deliveries, setDeliveries] = useState<Delivery[]>(FALLBACK.deliveries)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<Payload>('/operations/deliveries')
      setStats(res.stats)
      setDeliveries(res.deliveries)
      setUsingFallback(false)
    } catch (err) {
      setUsingFallback(err instanceof ApiError && err.status === 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const setComplete = useCallback(
    async (milestoneId: string, isComplete: boolean) => {
      // Optimistic — flip status and progress locally
      setDeliveries((prev) =>
        prev.map((d) =>
          d.id === milestoneId
            ? {
                ...d,
                status: isComplete ? 'completed' : d.daysRemaining !== null && d.daysRemaining < 0 ? 'overdue' : 'on-track',
                progress: isComplete ? 100 : 50,
              }
            : d,
        ),
      )
      try {
        await api.patch<unknown>(`/operations/milestones/${milestoneId}`, { isComplete })
        await load()
      } catch (err) {
        await load() // re-sync from server on failure
        throw err
      }
    },
    [load],
  )

  return { stats, deliveries, loading, usingFallback, refresh: load, setComplete }
}
