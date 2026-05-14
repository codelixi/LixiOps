import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { useSocketEvent } from './useSocket'

// ───────────────────────────────────────────
// Attendance hook — daily board + clock in/out + leave requests.
// Subscribes to attendance:changed so other people's clock-ins
// update the board in real time.
// ───────────────────────────────────────────

export type DayStatus = 'present' | 'remote' | 'late' | 'on-leave' | 'absent'
export type Location = 'office' | 'remote' | 'client_site'
export type LeaveStatus = 'pending' | 'approved' | 'declined'
export type LeaveType = 'annual' | 'sick' | 'personal' | 'unpaid'

export interface AttendanceRow {
  userId: string
  name: string
  avatar: string | null
  department: { id: string; name: string } | null
  role: string
  status: DayStatus
  clockIn: string | null
  clockOut: string | null
  hoursToday: number
  location: string | null
  sessionId: string | null
}

export interface AttendanceStats {
  total: number
  present: number
  absent: number
  onLeave: number
  avgHours: number
}

export interface LeaveRequest {
  id: string
  userId: string
  type: LeaveType
  startDate: string
  endDate: string
  reason: string | null
  status: LeaveStatus
  approvedBy: string | null
  approver: string | null
  days: number
  createdAt: string
  user: { id: string; name: string; avatar: string | null; role: string }
}

const today = new Date()
today.setHours(9, 0, 0, 0)

const FALLBACK_ROWS: AttendanceRow[] = [
  { userId: 'u1', name: 'Noman Ali', avatar: null, department: { id: 'd1', name: 'Management' }, role: 'CEO', status: 'present', clockIn: today.toISOString(), clockOut: null, hoursToday: 4.5, location: 'office', sessionId: 's1' },
  { userId: 'u2', name: 'Sarah Chen', avatar: null, department: { id: 'd2', name: 'Development' }, role: 'MANAGER', status: 'remote', clockIn: today.toISOString(), clockOut: null, hoursToday: 4.2, location: 'remote', sessionId: 's2' },
  { userId: 'u3', name: 'Amir Khan', avatar: null, department: { id: 'd3', name: 'Design' }, role: 'EMPLOYEE', status: 'present', clockIn: today.toISOString(), clockOut: null, hoursToday: 4.0, location: 'office', sessionId: 's3' },
  { userId: 'u4', name: 'Emily Torres', avatar: null, department: { id: 'd4', name: 'Operations' }, role: 'MANAGER', status: 'remote', clockIn: today.toISOString(), clockOut: null, hoursToday: 4.8, location: 'remote', sessionId: 's4' },
  { userId: 'u5', name: 'Raj Patel', avatar: null, department: { id: 'd2', name: 'Development' }, role: 'EMPLOYEE', status: 'late', clockIn: new Date(today.getTime() + 90 * 60_000).toISOString(), clockOut: null, hoursToday: 2.8, location: 'office', sessionId: 's5' },
  { userId: 'u6', name: 'Fatima Zahra', avatar: null, department: { id: 'd2', name: 'Development' }, role: 'EMPLOYEE', status: 'on-leave', clockIn: null, clockOut: null, hoursToday: 0, location: null, sessionId: null },
  { userId: 'u7', name: 'David Park', avatar: null, department: { id: 'd2', name: 'Development' }, role: 'EMPLOYEE', status: 'remote', clockIn: today.toISOString(), clockOut: null, hoursToday: 4.1, location: 'remote', sessionId: 's7' },
  { userId: 'u8', name: 'Zara Ahmed', avatar: null, department: { id: 'd5', name: 'Sales' }, role: 'MANAGER', status: 'present', clockIn: today.toISOString(), clockOut: null, hoursToday: 4.4, location: 'office', sessionId: 's8' },
  { userId: 'u9', name: 'Hira Malik', avatar: null, department: { id: 'd6', name: 'People' }, role: 'MANAGER', status: 'absent', clockIn: null, clockOut: null, hoursToday: 0, location: null, sessionId: null },
]

const FALLBACK_STATS: AttendanceStats = {
  total: FALLBACK_ROWS.length,
  present: FALLBACK_ROWS.filter((r) => r.status === 'present' || r.status === 'remote' || r.status === 'late').length,
  absent: FALLBACK_ROWS.filter((r) => r.status === 'absent').length,
  onLeave: FALLBACK_ROWS.filter((r) => r.status === 'on-leave').length,
  avgHours: 4.1,
}

const FALLBACK_LEAVES: LeaveRequest[] = [
  { id: 'l1', userId: 'u6', type: 'annual', startDate: new Date(Date.now() - 86_400_000).toISOString(), endDate: new Date(Date.now() + 6 * 86_400_000).toISOString(), reason: 'Family wedding', status: 'approved', approvedBy: 'u1', approver: 'Noman Ali', days: 7, createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString(), user: { id: 'u6', name: 'Fatima Zahra', avatar: null, role: 'EMPLOYEE' } },
  { id: 'l2', userId: 'u5', type: 'sick', startDate: new Date(Date.now() + 2 * 86_400_000).toISOString(), endDate: new Date(Date.now() + 3 * 86_400_000).toISOString(), reason: 'Medical appointment', status: 'pending', approvedBy: null, approver: null, days: 2, createdAt: new Date(Date.now() - 4 * 3600_000).toISOString(), user: { id: 'u5', name: 'Raj Patel', avatar: null, role: 'EMPLOYEE' } },
]

interface BoardPayload {
  stats: AttendanceStats
  attendance: AttendanceRow[]
  me: AttendanceRow | null
}

export function useAttendance() {
  const [stats, setStats] = useState<AttendanceStats>(FALLBACK_STATS)
  const [rows, setRows] = useState<AttendanceRow[]>(FALLBACK_ROWS)
  const [me, setMe] = useState<AttendanceRow | null>(FALLBACK_ROWS[0])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(FALLBACK_LEAVES)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const loadBoard = useCallback(async () => {
    try {
      const res = await api.get<BoardPayload>('/attendance/today')
      setStats(res.stats)
      setRows(res.attendance)
      setMe(res.me)
      setUsingFallback(false)
    } catch (err) {
      setUsingFallback(err instanceof ApiError && err.status === 0)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLeaves = useCallback(async () => {
    try {
      const res = await api.get<{ requests: LeaveRequest[] }>('/attendance/leave-requests')
      setLeaveRequests(res.requests)
    } catch {
      // keep fallback
    }
  }, [])

  useEffect(() => {
    void loadBoard()
    void loadLeaves()
  }, [loadBoard, loadLeaves])

  useSocketEvent('attendance:changed', () => {
    void loadBoard()
  })

  const clockIn = useCallback(
    async (location: Location) => {
      await api.post<unknown>('/attendance/clock-in', { location })
      await loadBoard()
    },
    [loadBoard],
  )

  const clockOut = useCallback(async () => {
    await api.post<unknown>('/attendance/clock-out', {})
    await loadBoard()
  }, [loadBoard])

  const submitLeave = useCallback(
    async (payload: { type: LeaveType; startDate: string; endDate: string; reason?: string }) => {
      await api.post<unknown>('/attendance/leave-requests', payload)
      await loadLeaves()
    },
    [loadLeaves],
  )

  const decideLeave = useCallback(
    async (id: string, status: 'approved' | 'declined') => {
      await api.patch<unknown>(`/attendance/leave-requests/${id}`, { status })
      await Promise.all([loadLeaves(), loadBoard()])
    },
    [loadLeaves, loadBoard],
  )

  return {
    stats, rows, me, leaveRequests, loading, usingFallback,
    refresh: loadBoard, clockIn, clockOut, submitLeave, decideLeave,
  }
}
