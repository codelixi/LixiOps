import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Design Briefs hook — list + create + status updates + approvals.
// ───────────────────────────────────────────

export type BriefStatus = 'briefing' | 'in_progress' | 'review' | 'revisions' | 'approved' | 'open'

export interface Brief {
  id: string
  objective: string
  deliverable: string
  brandRefs: string | null
  status: BriefStatus
  progress: number
  clientId: string | null
  client: { id: string; company: string; contactName: string } | null
  designer: { id: string; name: string; avatar: string | null } | null
  estimatedHours: number | null
  dueDate: string | null
  revisionCount: number
  approvalCount: number
  createdAt: string
}

export interface BriefStats {
  total: number
  active: number
  inReview: number
  revisions: number
  approved: number
}

interface Payload {
  stats: BriefStats
  briefs: Brief[]
}

const FALLBACK: Payload = {
  stats: { total: 5, active: 4, inReview: 1, revisions: 1, approved: 1 },
  briefs: [
    { id: 'b1', objective: 'Brand Identity Package', deliverable: 'Logo, colors, type system, brand guidelines PDF', brandRefs: null, status: 'review', progress: 70, clientId: 'c1', client: { id: 'c1', company: 'Bella Cucina', contactName: 'Marco Rossi' }, designer: { id: 'u3', name: 'Amir Khan', avatar: null }, estimatedHours: 40, dueDate: new Date(Date.now() + 6 * 86_400_000).toISOString(), revisionCount: 1, approvalCount: 3, createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString() },
    { id: 'b2', objective: 'Patient Portal UI', deliverable: 'Wireframes + high-fidelity mocks for 12 screens', brandRefs: null, status: 'in_progress', progress: 45, clientId: 'c2', client: { id: 'c2', company: 'CareFirst Health', contactName: 'Dr. Patel' }, designer: { id: 'u3', name: 'Amir Khan', avatar: null }, estimatedHours: 60, dueDate: new Date(Date.now() + 16 * 86_400_000).toISOString(), revisionCount: 0, approvalCount: 1, createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString() },
    { id: 'b3', objective: 'Social Media Campaign', deliverable: 'Instagram + LinkedIn templates × 8', brandRefs: null, status: 'briefing', progress: 10, clientId: 'c4', client: { id: 'c4', company: 'Urban Threads', contactName: 'Lara Kim' }, designer: { id: 'u3', name: 'Amir Khan', avatar: null }, estimatedHours: 20, dueDate: new Date(Date.now() + 22 * 86_400_000).toISOString(), revisionCount: 0, approvalCount: 0, createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString() },
    { id: 'b4', objective: 'Dashboard Redesign v2', deliverable: 'Updated DataFlow analytics dashboard', brandRefs: null, status: 'revisions', progress: 65, clientId: 'c3', client: { id: 'c3', company: 'DataFlow Inc', contactName: 'Megan Park' }, designer: { id: 'u3', name: 'Amir Khan', avatar: null }, estimatedHours: 30, dueDate: new Date(Date.now() + 9 * 86_400_000).toISOString(), revisionCount: 2, approvalCount: 4, createdAt: new Date(Date.now() - 21 * 86_400_000).toISOString() },
    { id: 'b5', objective: 'Logo Animation', deliverable: '5s After Effects intro for Bella Cucina', brandRefs: null, status: 'approved', progress: 100, clientId: 'c1', client: { id: 'c1', company: 'Bella Cucina', contactName: 'Marco Rossi' }, designer: { id: 'u3', name: 'Amir Khan', avatar: null }, estimatedHours: 8, dueDate: new Date(Date.now() - 4 * 86_400_000).toISOString(), revisionCount: 1, approvalCount: 3, createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString() },
  ],
}

export function useDesignBriefs() {
  const [stats, setStats] = useState<BriefStats>(FALLBACK.stats)
  const [briefs, setBriefs] = useState<Brief[]>(FALLBACK.briefs)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<Payload>('/design-briefs')
      setStats(res.stats)
      setBriefs(res.briefs)
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

  const createBrief = useCallback(
    async (payload: {
      objective: string
      deliverable: string
      brandRefs?: string | null
      clientId?: string | null
      designerId?: string | null
      estimatedHours?: number | null
      dueDate?: string | null
      status?: BriefStatus
    }) => {
      await api.post<unknown>('/design-briefs', payload)
      await load()
    },
    [load],
  )

  const updateStatus = useCallback(
    async (id: string, status: BriefStatus) => {
      // Optimistic
      setBriefs((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)))
      try {
        await api.patch<unknown>(`/design-briefs/${id}`, { status })
        await load()
      } catch (err) {
        await load()
        throw err
      }
    },
    [load],
  )

  const recordApproval = useCallback(
    async (id: string, payload: { stage: 'designer' | 'manager' | 'ceo' | 'client'; action: 'approved' | 'sent_back'; comment?: string }) => {
      await api.post<unknown>(`/design-briefs/${id}/approval`, payload)
      await load()
    },
    [load],
  )

  return { stats, briefs, loading, usingFallback, refresh: load, createBrief, updateStatus, recordApproval }
}
