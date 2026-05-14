import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Departments hook — full CRUD plus the aggregated rollup that the
// /departments page consumes. The OKR form only needs id+name; that
// shape is a subset of the richer DepartmentAggregate so consumers
// can use this hook everywhere.
// ───────────────────────────────────────────

export type DeptStatus = 'healthy' | 'needs-attention' | 'critical'

export interface DepartmentHead {
  id: string
  name: string
  role: string
  avatar: string | null
}

export interface DepartmentAggregate {
  id: string
  name: string
  description: string | null
  budget: number
  headId: string | null
  head: DepartmentHead | null
  members: number
  activeProjects: number
  okrProgress: number
  utilization: number
  status: DeptStatus
}

// Light shape used by the OKR form picker
export interface DepartmentLite {
  id: string
  name: string
  headId: string | null
  description?: string | null
  _count?: { members: number; okrs: number }
}

const FALLBACK: DepartmentAggregate[] = [
  { id: 'd1', name: 'Development', description: 'Engineering team', budget: 120000, headId: null, head: { id: 'u1', name: 'Sarah Chen', role: 'MANAGER', avatar: null }, members: 4, activeProjects: 5, okrProgress: 72, utilization: 85, status: 'healthy' },
  { id: 'd2', name: 'Design', description: 'Brand & product design', budget: 40000, headId: null, head: { id: 'u2', name: 'Amir Khan', role: 'EMPLOYEE', avatar: null }, members: 1, activeProjects: 4, okrProgress: 68, utilization: 92, status: 'needs-attention' },
  { id: 'd3', name: 'Sales', description: 'Pipeline + revenue', budget: 35000, headId: null, head: { id: 'u3', name: 'Zara Ahmed', role: 'MANAGER', avatar: null }, members: 1, activeProjects: 0, okrProgress: 55, utilization: 78, status: 'needs-attention' },
  { id: 'd4', name: 'Operations', description: 'Delivery & client success', budget: 50000, headId: null, head: { id: 'u4', name: 'Emily Torres', role: 'MANAGER', avatar: null }, members: 1, activeProjects: 6, okrProgress: 80, utilization: 95, status: 'critical' },
  { id: 'd5', name: 'Company', description: 'Leadership', budget: 60000, headId: null, head: { id: 'u5', name: 'Noman Ali', role: 'CEO', avatar: null }, members: 1, activeProjects: 0, okrProgress: 47, utilization: 70, status: 'needs-attention' },
]

export function useDepartments() {
  const [departments, setDepartments] = useState<DepartmentAggregate[]>(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ departments: DepartmentAggregate[] }>('/departments')
      setDepartments(res.departments)
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

  const createDepartment = useCallback(
    async (payload: { name: string; headId?: string | null; budget?: number; description?: string | null }) => {
      await api.post<unknown>('/departments', payload)
      await load()
    },
    [load],
  )

  const updateDepartment = useCallback(
    async (id: string, patch: { name?: string; headId?: string | null; budget?: number; description?: string | null }) => {
      await api.patch<unknown>(`/departments/${id}`, patch)
      await load()
    },
    [load],
  )

  const deleteDepartment = useCallback(
    async (id: string) => {
      await api.del<unknown>(`/departments/${id}`)
      await load()
    },
    [load],
  )

  return { departments, loading, usingFallback, refresh: load, createDepartment, updateDepartment, deleteDepartment }
}
