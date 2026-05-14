import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Employees overview hook — read-only aggregated team data
// powering the Team Directory page.
// ───────────────────────────────────────────

export type EmployeeStatus = 'active' | 'away' | 'on-leave' | 'inactive'

export interface Employee {
  id: string
  name: string
  email: string
  role: string
  avatar: string | null
  phone: string | null
  department: { id: string; name: string } | null
  status: EmployeeStatus
  joinDate: string
  hoursThisWeek: number
  currentTask: string | null
  lastLoginAt: string | null
}

export interface EmployeeStats {
  total: number
  active: number
  away: number
  onLeave: number
  avgHoursThisWeek: number
}

export interface DeptCount {
  id: string
  name: string
  count: number
}

interface OverviewPayload {
  stats: EmployeeStats
  departments: DeptCount[]
  employees: Employee[]
}

const FALLBACK: OverviewPayload = {
  stats: { total: 10, active: 7, away: 1, onLeave: 1, avgHoursThisWeek: 37 },
  departments: [
    { id: 'd-dev', name: 'Development', count: 4 },
    { id: 'd-design', name: 'Design', count: 1 },
    { id: 'd-ops', name: 'Operations', count: 1 },
    { id: 'd-sales', name: 'Sales', count: 1 },
    { id: 'd-mgmt', name: 'Management', count: 1 },
    { id: 'd-people', name: 'People', count: 1 },
  ],
  employees: [
    { id: 'u1', name: 'Noman Ali', email: 'noman@codelixi.com', role: 'CEO', avatar: null, phone: null, department: { id: 'd-mgmt', name: 'Management' }, status: 'active', joinDate: new Date('2024-01-15').toISOString(), hoursThisWeek: 42, currentTask: 'Strategic planning', lastLoginAt: new Date().toISOString() },
    { id: 'u2', name: 'Sarah Chen', email: 'sarah@codelixi.com', role: 'MANAGER', avatar: null, phone: null, department: { id: 'd-dev', name: 'Development' }, status: 'active', joinDate: new Date('2024-03-01').toISOString(), hoursThisWeek: 38, currentTask: 'LixiOps API integration', lastLoginAt: new Date(Date.now() - 2 * 3600_000).toISOString() },
    { id: 'u3', name: 'Amir Khan', email: 'amir@codelixi.com', role: 'EMPLOYEE', avatar: null, phone: null, department: { id: 'd-design', name: 'Design' }, status: 'active', joinDate: new Date('2024-04-15').toISOString(), hoursThisWeek: 36, currentTask: 'Client portal wireframes', lastLoginAt: new Date(Date.now() - 4 * 3600_000).toISOString() },
    { id: 'u4', name: 'Emily Torres', email: 'emily@codelixi.com', role: 'MANAGER', avatar: null, phone: null, department: { id: 'd-ops', name: 'Operations' }, status: 'active', joinDate: new Date('2024-02-10').toISOString(), hoursThisWeek: 40, currentTask: 'Sprint retrospective prep', lastLoginAt: new Date(Date.now() - 30 * 60_000).toISOString() },
    { id: 'u5', name: 'Raj Patel', email: 'raj@codelixi.com', role: 'EMPLOYEE', avatar: null, phone: null, department: { id: 'd-dev', name: 'Development' }, status: 'away', joinDate: new Date('2024-05-20').toISOString(), hoursThisWeek: 35, currentTask: 'Payment gateway integration', lastLoginAt: new Date(Date.now() - 2 * 86_400_000).toISOString() },
    { id: 'u6', name: 'Fatima Zahra', email: 'fatima@codelixi.com', role: 'EMPLOYEE', avatar: null, phone: null, department: { id: 'd-dev', name: 'Development' }, status: 'on-leave', joinDate: new Date('2024-06-15').toISOString(), hoursThisWeek: 0, currentTask: null, lastLoginAt: new Date(Date.now() - 10 * 86_400_000).toISOString() },
    { id: 'u7', name: 'David Park', email: 'david@codelixi.com', role: 'EMPLOYEE', avatar: null, phone: null, department: { id: 'd-dev', name: 'Development' }, status: 'active', joinDate: new Date('2024-07-01').toISOString(), hoursThisWeek: 39, currentTask: 'CI/CD pipeline optimization', lastLoginAt: new Date(Date.now() - 1 * 3600_000).toISOString() },
    { id: 'u8', name: 'Zara Ahmed', email: 'zara@codelixi.com', role: 'MANAGER', avatar: null, phone: null, department: { id: 'd-sales', name: 'Sales' }, status: 'active', joinDate: new Date('2024-08-05').toISOString(), hoursThisWeek: 37, currentTask: 'Q2 pipeline review', lastLoginAt: new Date(Date.now() - 3 * 3600_000).toISOString() },
    { id: 'u9', name: 'Hira Malik', email: 'hira@codelixi.com', role: 'MANAGER', avatar: null, phone: null, department: { id: 'd-people', name: 'People' }, status: 'active', joinDate: new Date('2024-01-30').toISOString(), hoursThisWeek: 40, currentTask: 'Performance review cycle', lastLoginAt: new Date(Date.now() - 6 * 3600_000).toISOString() },
  ],
}

export function useEmployees() {
  const [stats, setStats] = useState<EmployeeStats>(FALLBACK.stats)
  const [departments, setDepartments] = useState<DeptCount[]>(FALLBACK.departments)
  const [employees, setEmployees] = useState<Employee[]>(FALLBACK.employees)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<OverviewPayload>('/employees/overview')
      setStats(res.stats)
      setDepartments(res.departments)
      setEmployees(res.employees)
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

  return { stats, departments, employees, loading, usingFallback, refresh: load }
}
