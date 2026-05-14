import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Client Health hook — aggregates the snapshot per active client.
// Falls back to demo data offline so the page stays reviewable.
// ───────────────────────────────────────────

export type HealthTrend = 'improving' | 'declining' | 'stable'

export interface ClientHealthSnapshot {
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
  trend: HealthTrend
  riskFactors: string[]
}

export interface ClientHealthStats {
  avgHealth: number
  healthy: number
  atRisk: number
  openIssues: number
  avgNps: number | null
  total: number
}

interface OverviewPayload {
  stats: ClientHealthStats
  clients: ClientHealthSnapshot[]
}

const FALLBACK: OverviewPayload = {
  stats: { avgHealth: 79, healthy: 4, atRisk: 2, openIssues: 6, avgNps: 7.4, total: 7 },
  clients: [
    { id: 'c6', company: 'DataFlow Inc', contactName: 'Megan Park', vertical: 'SaaS', status: 'active', healthScore: 58, npsScore: 5, contractValue: 12000, lastInteractionAt: new Date(Date.now() - 5 * 86_400_000).toISOString(), lastInteractionLabel: '5d ago', openIssues: 3, slaCompliance: 82, trend: 'declining', riskFactors: ['Response SLA breach', 'Project overdue', 'Low engagement'] },
    { id: 'c5', company: 'CareFirst Health', contactName: 'Dr. Patel', vertical: 'Healthcare', status: 'active', healthScore: 72, npsScore: 7, contractValue: 8000, lastInteractionAt: new Date(Date.now() - 1 * 86_400_000).toISOString(), lastInteractionLabel: '1d ago', openIssues: 2, slaCompliance: 90, trend: 'declining', riskFactors: ['Project delays', 'Scope creep'] },
    { id: 'c4', company: 'Urban Threads', contactName: 'Lara Kim', vertical: 'Retail', status: 'active', healthScore: 85, npsScore: 7, contractValue: 4500, lastInteractionAt: new Date(Date.now() - 3 * 3600_000).toISOString(), lastInteractionLabel: '3h ago', openIssues: 0, slaCompliance: 95, trend: 'stable', riskFactors: [] },
    { id: 'c3', company: 'Swift Logistics', contactName: 'Carlos Reyes', vertical: 'Logistics', status: 'active', healthScore: 88, npsScore: 8, contractValue: 9200, lastInteractionAt: new Date(Date.now() - 6 * 3600_000).toISOString(), lastInteractionLabel: '6h ago', openIssues: 1, slaCompliance: 97, trend: 'improving', riskFactors: ['Onboarding gap'] },
    { id: 'c2', company: 'Bella Cucina', contactName: 'Marco Rossi', vertical: 'Hospitality', status: 'active', healthScore: 92, npsScore: 8, contractValue: 6000, lastInteractionAt: new Date(Date.now() - 2 * 3600_000).toISOString(), lastInteractionLabel: '2h ago', openIssues: 0, slaCompliance: 98, trend: 'stable', riskFactors: [] },
    { id: 'c1', company: 'Pixel Perfect Studio', contactName: 'Ava Tan', vertical: 'Agency', status: 'active', healthScore: 95, npsScore: 9, contractValue: 5500, lastInteractionAt: new Date(Date.now() - 1 * 3600_000).toISOString(), lastInteractionLabel: '1h ago', openIssues: 0, slaCompliance: 100, trend: 'improving', riskFactors: [] },
  ],
}

export function useClientHealth() {
  const [stats, setStats] = useState<ClientHealthStats>(FALLBACK.stats)
  const [clients, setClients] = useState<ClientHealthSnapshot[]>(FALLBACK.clients)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<OverviewPayload>('/client-health/overview')
      setStats(res.stats)
      setClients(res.clients)
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

  const setHealthScore = useCallback(
    async (clientId: string, healthScore: number | null) => {
      // Optimistic — bump the snapshot before the round-trip
      let prev: number | null = null
      setClients((current) =>
        current.map((c) => {
          if (c.id !== clientId) return c
          prev = c.healthScore
          return { ...c, healthScore: healthScore ?? c.healthScore }
        }),
      )
      try {
        await api.patch<unknown>(`/client-health/clients/${clientId}`, { healthScore })
        // After a manual set we re-pull so trend / atRisk counts refresh consistently
        await load()
      } catch (err) {
        if (prev !== null) {
          setClients((current) =>
            current.map((c) => (c.id === clientId ? { ...c, healthScore: prev as number } : c)),
          )
        }
        throw err
      }
    },
    [load],
  )

  const recordNPS = useCallback(
    async (clientId: string, npsScore: number) => {
      await api.post<unknown>(`/client-health/clients/${clientId}/nps`, { npsScore })
      await load()
    },
    [load],
  )

  return { stats, clients, loading, usingFallback, refresh: load, setHealthScore, recordNPS }
}
