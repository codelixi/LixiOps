import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// OKRs hook — list / create / update / delete with optimistic KR
// progress updates so the slider feels instant.
// ───────────────────────────────────────────

export interface KeyResult {
  id: string
  okrId: string
  title: string
  target: number
  current: number
  unit: string
}

export interface OwnerLite {
  id: string
  name: string
  avatar: string | null
}

export interface OKR {
  id: string
  objective: string
  departmentId: string
  quarter: string
  year: number
  createdAt: string
  updatedAt: string
  department: { id: string; name: string; headId: string | null } | null
  owner: OwnerLite | null
  keyResults: KeyResult[]
}

export interface OKRFilters {
  year?: number
  quarter?: string
  departmentId?: string
}

export type OKRStatus = 'achieved' | 'healthy' | 'on-track' | 'at-risk'

export function krProgress(kr: KeyResult): number {
  if (kr.target <= 0) return 0
  return Math.min(100, Math.round((kr.current / kr.target) * 100))
}

export function okrProgress(okr: OKR): number {
  if (okr.keyResults.length === 0) return 0
  const total = okr.keyResults.reduce((s, kr) => s + krProgress(kr), 0)
  return Math.round(total / okr.keyResults.length)
}

export function okrStatus(progress: number): OKRStatus {
  if (progress >= 100) return 'achieved'
  if (progress >= 70) return 'healthy'
  if (progress >= 40) return 'on-track'
  return 'at-risk'
}

function now() {
  return new Date().toISOString()
}

const FALLBACK: OKR[] = [
  {
    id: 'o1',
    objective: 'Scale revenue to $100K MRR',
    departmentId: 'd-company',
    quarter: 'Q2',
    year: 2026,
    createdAt: now(),
    updatedAt: now(),
    department: { id: 'd-company', name: 'Company', headId: null },
    owner: null,
    keyResults: [
      { id: 'kr1', okrId: 'o1', title: 'Close enterprise deals', target: 5, current: 3, unit: 'deals' },
      { id: 'kr2', okrId: 'o1', title: 'Raise average deal size', target: 10000, current: 7800, unit: '$' },
      { id: 'kr3', okrId: 'o1', title: 'Reduce churn rate', target: 100, current: 40, unit: '%' },
    ],
  },
  {
    id: 'o2',
    objective: 'Build world-class engineering team',
    departmentId: 'd-dev',
    quarter: 'Q2',
    year: 2026,
    createdAt: now(),
    updatedAt: now(),
    department: { id: 'd-dev', name: 'Development', headId: null },
    owner: null,
    keyResults: [
      { id: 'kr4', okrId: 'o2', title: 'Hire senior engineers', target: 3, current: 2, unit: 'hires' },
      { id: 'kr5', okrId: 'o2', title: 'Sprint completion rate', target: 95, current: 88, unit: '%' },
      { id: 'kr6', okrId: 'o2', title: 'Deployment success rate', target: 98, current: 96.9, unit: '%' },
    ],
  },
  {
    id: 'o3',
    objective: 'Achieve 95% client satisfaction',
    departmentId: 'd-ops',
    quarter: 'Q2',
    year: 2026,
    createdAt: now(),
    updatedAt: now(),
    department: { id: 'd-ops', name: 'Operations', headId: null },
    owner: null,
    keyResults: [
      { id: 'kr7', okrId: 'o3', title: 'NPS score', target: 70, current: 72, unit: 'score' },
      { id: 'kr8', okrId: 'o3', title: 'SLA compliance', target: 98, current: 96.5, unit: '%' },
      { id: 'kr9', okrId: 'o3', title: 'Avg first response', target: 4, current: 3.2, unit: 'hours' },
    ],
  },
]

export function useOKRs(filters: OKRFilters = {}) {
  const [okrs, setOkrs] = useState<OKR[]>(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const queryKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (filters.year) params.set('year', String(filters.year))
    if (filters.quarter) params.set('quarter', filters.quarter)
    if (filters.departmentId) params.set('departmentId', filters.departmentId)
    const qs = params.toString() ? `?${params.toString()}` : ''
    try {
      const res = await api.get<{ okrs: OKR[] }>(`/okrs${qs}`)
      setOkrs(res.okrs)
      setUsingFallback(false)
    } catch (err) {
      setUsingFallback(err instanceof ApiError && err.status === 0)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey])

  useEffect(() => {
    load()
  }, [load])

  const createOKR = useCallback(
    async (payload: {
      objective: string
      departmentId: string
      quarter: string
      year: number
      keyResults?: Array<{ title: string; target: number; current?: number; unit?: string }>
    }) => {
      const res = await api.post<{ okr: OKR }>('/okrs', payload)
      setOkrs((prev) => [res.okr, ...prev])
      return res.okr
    },
    [],
  )

  const deleteOKR = useCallback(async (id: string) => {
    await api.del<unknown>(`/okrs/${id}`)
    setOkrs((prev) => prev.filter((o) => o.id !== id))
  }, [])

  /** Update KR progress (`current`). Optimistic + revert on failure. */
  const updateKRCurrent = useCallback(async (krId: string, current: number) => {
    let prevValue: number | null = null
    setOkrs((prev) =>
      prev.map((o) => ({
        ...o,
        keyResults: o.keyResults.map((kr) => {
          if (kr.id !== krId) return kr
          prevValue = kr.current
          return { ...kr, current }
        }),
      })),
    )
    try {
      await api.patch<unknown>(`/okrs/key-results/${krId}`, { current })
    } catch (err) {
      // Revert
      if (prevValue !== null) {
        setOkrs((prev) =>
          prev.map((o) => ({
            ...o,
            keyResults: o.keyResults.map((kr) =>
              kr.id === krId ? { ...kr, current: prevValue as number } : kr,
            ),
          })),
        )
      }
      throw err
    }
  }, [])

  const addKR = useCallback(
    async (okrId: string, payload: { title: string; target: number; current?: number; unit?: string }) => {
      const res = await api.post<{ keyResult: KeyResult }>(`/okrs/${okrId}/key-results`, payload)
      setOkrs((prev) =>
        prev.map((o) => (o.id === okrId ? { ...o, keyResults: [...o.keyResults, res.keyResult] } : o)),
      )
      return res.keyResult
    },
    [],
  )

  const deleteKR = useCallback(async (krId: string) => {
    await api.del<unknown>(`/okrs/key-results/${krId}`)
    setOkrs((prev) =>
      prev.map((o) => ({ ...o, keyResults: o.keyResults.filter((kr) => kr.id !== krId) })),
    )
  }, [])

  return {
    okrs,
    loading,
    usingFallback,
    refresh: load,
    createOKR,
    deleteOKR,
    updateKRCurrent,
    addKR,
    deleteKR,
  }
}
