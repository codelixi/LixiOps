import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Decision log hook — captures executive decisions with rationale
// and (eventually) outcome. Status is derived server-side from the
// presence of `outcome`.
// ───────────────────────────────────────────

export type DecisionCategory = 'strategic' | 'operational' | 'financial' | 'hr' | 'product' | 'legal'
export type DecisionImpact = 'low' | 'medium' | 'high'
export type DecisionStatus = 'pending' | 'decided'

export interface Decision {
  id: string
  title: string
  category: DecisionCategory
  impact: DecisionImpact
  rationale: string | null
  outcome: string | null
  status: DecisionStatus
  createdAt: string
  author: { id: string; name: string; avatar: string | null } | null
}

const FALLBACK: Decision[] = [
  { id: 'd1', title: 'Expand to UAE market', category: 'strategic', impact: 'high', rationale: 'Strong leads in Dubai + regulatory simplicity vs. EU', outcome: null, status: 'pending', createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), author: { id: 'u1', name: 'Noman Ali', avatar: null } },
  { id: 'd2', title: 'Hire 2 senior developers', category: 'hr', impact: 'high', rationale: 'Capacity gap on the CareFirst project', outcome: 'Approved — Hira posting roles this week', status: 'decided', createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(), author: { id: 'u9', name: 'Hira Malik', avatar: null } },
  { id: 'd3', title: 'Switch to annual billing model', category: 'financial', impact: 'medium', rationale: 'Smoothes cashflow + reduces churn cost', outcome: null, status: 'pending', createdAt: new Date(Date.now() - 4 * 86_400_000).toISOString(), author: { id: 'u1', name: 'Noman Ali', avatar: null } },
  { id: 'd4', title: 'Adopt AI code review tool', category: 'operational', impact: 'low', rationale: 'Reduce review wait time from 18h to ~4h', outcome: 'Deferred to Q3', status: 'decided', createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString(), author: { id: 'u2', name: 'Sarah Chen', avatar: null } },
  { id: 'd5', title: 'Client retention program', category: 'strategic', impact: 'high', rationale: 'NPS dropped to 7.2 over Q1', outcome: 'Approved — Zara launching incentive program', status: 'decided', createdAt: new Date(Date.now() - 21 * 86_400_000).toISOString(), author: { id: 'u8', name: 'Zara Ahmed', avatar: null } },
]

export function useDecisions() {
  const [decisions, setDecisions] = useState<Decision[]>(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ decisions: Decision[] }>('/decisions')
      setDecisions(res.decisions)
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

  const createDecision = useCallback(
    async (payload: {
      title: string
      category: DecisionCategory
      impact: DecisionImpact
      rationale?: string
      outcome?: string
    }) => {
      await api.post<unknown>('/decisions', payload)
      await load()
    },
    [load],
  )

  const updateDecision = useCallback(
    async (id: string, patch: { outcome?: string; rationale?: string; title?: string; category?: DecisionCategory; impact?: DecisionImpact }) => {
      await api.patch<unknown>(`/decisions/${id}`, patch)
      await load()
    },
    [load],
  )

  const deleteDecision = useCallback(
    async (id: string) => {
      await api.del<unknown>(`/decisions/${id}`)
      await load()
    },
    [load],
  )

  return { decisions, loading, usingFallback, refresh: load, createDecision, updateDecision, deleteDecision }
}
