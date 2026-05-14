import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  LogIn, LogOut, Coffee, MapPin, Plane, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle,
} from 'lucide-react'
import { Card, Badge, Avatar, Button } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useAttendance } from '@/hooks/useAttendance'
import { useAuthStore } from '@/stores/useAuthStore'
import type { DayStatus, Location, LeaveStatus } from '@/hooks/useAttendance'
import { LeaveRequestModal } from './LeaveRequestModal'

const statusMap: Record<DayStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  present: { label: 'Present', variant: 'success' },
  remote: { label: 'Remote', variant: 'info' },
  late: { label: 'Late', variant: 'warning' },
  'on-leave': { label: 'On Leave', variant: 'info' },
  absent: { label: 'Absent', variant: 'danger' },
}

const leaveStatusMap: Record<LeaveStatus, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  declined: { label: 'Declined', variant: 'danger' },
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type Filter = 'all' | DayStatus
type Tab = 'board' | 'leave'

export function AttendanceBoardPage() {
  const userId = useAuthStore((s) => s.user?.id)
  const role = useAuthStore((s) => s.user?.role)
  const isPrivileged = role === 'CEO' || role === 'MANAGER'

  const { stats, rows, me, leaveRequests, loading, usingFallback, clockIn, clockOut, submitLeave, decideLeave } =
    useAttendance()

  const [tab, setTab] = useState<Tab>('board')
  const [filter, setFilter] = useState<Filter>('all')
  const [clocking, setClocking] = useState(false)
  const [clockError, setClockError] = useState<string | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [chosenLocation, setChosenLocation] = useState<Location>('office')

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter)

  const isClockedIn = !!me?.clockIn && !me?.clockOut

  const handleClockIn = async () => {
    setClockError(null)
    setClocking(true)
    try {
      await clockIn(chosenLocation)
    } catch (err: any) {
      setClockError(err?.message ?? 'Failed to clock in')
    } finally {
      setClocking(false)
    }
  }

  const handleClockOut = async () => {
    setClockError(null)
    setClocking(true)
    try {
      await clockOut()
    } catch (err: any) {
      setClockError(err?.message ?? 'Failed to clock out')
    } finally {
      setClocking(false)
    }
  }

  const handleDecide = async (id: string, status: 'approved' | 'declined') => {
    setDecidingId(id)
    try {
      await decideLeave(id, status)
    } catch (err: any) {
      window.alert(err?.message ?? 'Failed to decide')
    } finally {
      setDecidingId(null)
    }
  }

  const pendingLeaves = leaveRequests.filter((r) => r.status === 'pending').length
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: stats.total },
    { id: 'present', label: 'Present', count: rows.filter((r) => r.status === 'present').length },
    { id: 'remote', label: 'Remote', count: rows.filter((r) => r.status === 'remote').length },
    { id: 'late', label: 'Late', count: rows.filter((r) => r.status === 'late').length },
    { id: 'on-leave', label: 'On Leave', count: stats.onLeave },
    { id: 'absent', label: 'Absent', count: stats.absent },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Attendance</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
            {loading && !usingFallback && (
              <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin text-neutral-400" />
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Plane className="h-3.5 w-3.5" />} onClick={() => setLeaveOpen(true)}>
            Request Leave
          </Button>
          {!isClockedIn ? (
            <div className="flex items-center gap-1">
              <select
                value={chosenLocation}
                onChange={(e) => setChosenLocation(e.target.value as Location)}
                className="h-8 px-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={clocking}
              >
                <option value="office">Office</option>
                <option value="remote">Remote</option>
                <option value="client_site">Client site</option>
              </select>
              <Button
                size="sm"
                icon={clocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                onClick={handleClockIn}
                disabled={clocking}
              >
                {clocking ? 'Clocking in…' : 'Clock in'}
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon={clocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              onClick={handleClockOut}
              disabled={clocking}
            >
              {clocking ? 'Clocking out…' : `Clock out (${formatTime(me?.clockIn ?? null)})`}
            </Button>
          )}
        </div>
      </div>

      {clockError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-50 border border-danger-200 text-xs text-danger-700">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          {clockError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Present</p>
          <p className="text-2xl font-bold text-success-600">{stats.present}</p>
          <p className="text-2xs text-neutral-400 mt-1">of {stats.total}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Absent</p>
          <p className="text-2xl font-bold text-danger-600">{stats.absent}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">On Leave</p>
          <p className="text-2xl font-bold text-info-600">{stats.onLeave}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Avg Hours</p>
          <p className="text-2xl font-bold text-neutral-900">{stats.avgHours}h</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Pending Leaves</p>
          <p className="text-2xl font-bold text-warning-600">{pendingLeaves}</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('board')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
            tab === 'board' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Board
        </button>
        <button
          onClick={() => setTab('leave')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
            tab === 'leave' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Leave Requests
          {pendingLeaves > 0 && (
            <span className="ml-1.5 text-2xs px-1.5 py-0.5 rounded-full bg-warning-500 text-white">{pendingLeaves}</span>
          )}
        </button>
      </div>

      {/* Board */}
      {tab === 'board' && (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  filter === f.id ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100 bg-white border border-neutral-200/60'
                }`}
              >
                {f.label}
                <span className={`text-2xs ${filter === f.id ? 'opacity-80' : 'text-neutral-400'}`}>{f.count}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <Card>
              <p className="text-sm text-neutral-500 text-center py-12">No one matches this filter.</p>
            </Card>
          ) : (
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
              {filtered.map((r) => {
                const status = statusMap[r.status]
                return (
                  <motion.div key={r.userId} variants={staggerItem}>
                    <Card>
                      <div className="flex items-center gap-4">
                        <Avatar
                          name={r.name}
                          size="md"
                          status={
                            r.status === 'present' || r.status === 'remote'
                              ? 'online'
                              : r.status === 'late'
                                ? 'away'
                                : 'offline'
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-neutral-900">{r.name}</h3>
                            <Badge variant={status.variant} dot>{status.label}</Badge>
                            {r.userId === userId && (
                              <span className="text-2xs font-medium text-brand-600 uppercase tracking-wider">You</span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 capitalize">
                            {r.department?.name ?? '—'} · {r.role.toLowerCase()}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          {r.location && (
                            <div className="flex items-center gap-1 text-neutral-500">
                              <MapPin className="h-3 w-3" />
                              <span className="capitalize">{r.location}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-neutral-500 min-w-[5rem]">
                            <Clock className="h-3 w-3" />
                            <span>{r.clockIn ? formatTime(r.clockIn) : '—'}</span>
                            {r.clockOut && <span className="text-neutral-400">→ {formatTime(r.clockOut)}</span>}
                          </div>
                          <div className="font-semibold text-neutral-900 min-w-[3rem] text-right">
                            {r.hoursToday > 0 ? `${r.hoursToday}h` : '—'}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </>
      )}

      {/* Leave Requests */}
      {tab === 'leave' && (
        <>
          {leaveRequests.length === 0 ? (
            <Card>
              <div className="py-12 text-center">
                <Coffee className="h-6 w-6 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-500">No leave requests yet.</p>
              </div>
            </Card>
          ) : (
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
              {leaveRequests.map((r) => {
                const status = leaveStatusMap[r.status]
                const isMine = r.userId === userId
                const canDecide = isPrivileged && r.status === 'pending' && !isMine
                return (
                  <motion.div key={r.id} variants={staggerItem}>
                    <Card>
                      <div className="flex items-start gap-3">
                        <Avatar name={r.user.name} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-sm font-semibold text-neutral-900">{r.user.name}</h3>
                            <Badge variant={status.variant} dot>{status.label}</Badge>
                            <Badge variant="default" className="capitalize">{r.type}</Badge>
                            {isMine && (
                              <span className="text-2xs font-medium text-brand-600 uppercase tracking-wider">You</span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-700">
                            {formatDate(r.startDate)} → {formatDate(r.endDate)} ·{' '}
                            <span className="font-semibold">{r.days} day{r.days === 1 ? '' : 's'}</span>
                          </p>
                          {r.reason && (
                            <p className="text-xs text-neutral-500 mt-1 italic">"{r.reason}"</p>
                          )}
                          {r.approver && (
                            <p className="text-2xs text-neutral-400 mt-1">
                              {r.status === 'approved' ? 'Approved' : 'Declined'} by {r.approver}
                            </p>
                          )}
                        </div>

                        {canDecide && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleDecide(r.id, 'declined')}
                              disabled={decidingId === r.id}
                              icon={<XCircle className="h-3.5 w-3.5" />}
                            >
                              Decline
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDecide(r.id, 'approved')}
                              disabled={decidingId === r.id}
                              icon={
                                decidingId === r.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )
                              }
                            >
                              Approve
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </>
      )}

      <LeaveRequestModal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onSubmit={submitLeave}
      />
    </div>
  )
}
