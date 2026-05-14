import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Calendar, Clock, AlertCircle, CheckCircle2, Timer, RefreshCw, Loader2, Receipt,
} from 'lucide-react'
import { Card, Badge, Avatar, ProgressBar, Button } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useDeliveries } from '@/hooks/useDeliveries'
import { useAuthStore } from '@/stores/useAuthStore'
import type { DeliveryStatus, Delivery } from '@/hooks/useDeliveries'

const statusMap: Record<DeliveryStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info'; icon: React.ReactNode }> = {
  'on-track': { label: 'On Track', variant: 'success', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  'at-risk': { label: 'At Risk', variant: 'warning', icon: <AlertCircle className="h-3.5 w-3.5" /> },
  overdue: { label: 'Overdue', variant: 'danger', icon: <Clock className="h-3.5 w-3.5" /> },
  completed: { label: 'Completed', variant: 'info', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
}

function formatDueDate(iso: string | null): string {
  if (!iso) return 'No due date'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysLabel(days: number | null): string {
  if (days === null) return ''
  if (days === 0) return 'due today'
  if (days < 0) return `${Math.abs(days)}d overdue`
  return `${days}d remaining`
}

type Filter = 'all' | DeliveryStatus

export function DeliveryTrackerPage() {
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.user?.role)
  const isPrivileged = role === 'CEO' || role === 'MANAGER'
  const { stats, deliveries, loading, usingFallback, refresh, setComplete } = useDeliveries()
  const [filter, setFilter] = useState<Filter>('all')
  const [savingId, setSavingId] = useState<string | null>(null)

  const filtered = useMemo(
    () => (filter === 'all' ? deliveries : deliveries.filter((d) => d.status === filter)),
    [deliveries, filter],
  )

  const handleToggleComplete = async (e: React.MouseEvent, d: Delivery) => {
    e.stopPropagation()
    setSavingId(d.id)
    try {
      await setComplete(d.id, !(d.status === 'completed'))
    } catch (err: any) {
      window.alert(err?.message ?? 'Failed to update milestone')
    } finally {
      setSavingId(null)
    }
  }

  const filters: { id: Filter; label: string; count: number; color: string }[] = [
    { id: 'all', label: 'All', count: stats.total, color: 'bg-neutral-900 text-white' },
    { id: 'overdue', label: 'Overdue', count: stats.overdue, color: 'bg-danger-500 text-white' },
    { id: 'at-risk', label: 'At Risk', count: stats.atRisk, color: 'bg-warning-500 text-white' },
    { id: 'on-track', label: 'On Track', count: stats.onTrack, color: 'bg-success-500 text-white' },
    { id: 'completed', label: 'Completed', count: stats.completed, color: 'bg-info-500 text-white' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Timer className="h-5 w-5 text-brand-500" />
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Delivery Tracker</h1>
          </div>
          <p className="text-sm text-neutral-500">
            Monitor milestone progress and deadlines across all projects
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
            {loading && !usingFallback && (
              <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin text-neutral-400" />
            )}
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={refresh}>
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Active Milestones</p>
          <p className="text-2xl font-bold text-neutral-900">{stats.active}</p>
          <p className="text-2xs text-neutral-400 mt-1">of {stats.total} total</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">On Track</p>
          <p className="text-2xl font-bold text-success-600">{stats.onTrack}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">At Risk</p>
          <p className="text-2xl font-bold text-warning-600">{stats.atRisk}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Overdue</p>
          <p className="text-2xl font-bold text-danger-600">{stats.overdue}</p>
        </Card>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === f.id ? f.color : 'text-neutral-600 hover:bg-neutral-100 bg-white border border-neutral-200/60'
            }`}
          >
            {f.label}
            <span className={`text-2xs ${filter === f.id ? 'opacity-80' : 'text-neutral-400'}`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500 text-center py-12">
            {deliveries.length === 0
              ? 'No milestones tracked yet. Create one from a project detail page.'
              : `No ${filter === 'all' ? '' : filter + ' '}milestones right now.`}
          </p>
        </Card>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          {filtered.map((d) => {
            const status = statusMap[d.status]
            return (
              <motion.div key={d.id} variants={staggerItem}>
                <Card hover className="cursor-pointer" onClick={() => navigate(`/projects/${d.projectId}`)}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-semibold text-neutral-900">{d.milestone}</h3>
                        <Badge variant={status.variant} dot>
                          {status.icon}
                          <span className="ml-1">{status.label}</span>
                        </Badge>
                        {d.invoiceTriggered && (
                          <Badge variant="info">
                            <Receipt className="h-3 w-3 mr-1 inline" />
                            Invoiced
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-500 flex-wrap">
                        <span className="font-medium text-neutral-700">{d.project}</span>
                        <span className="text-neutral-300">·</span>
                        <span>{d.client}</span>
                        {d.phase && (
                          <>
                            <span className="text-neutral-300">·</span>
                            <span className="capitalize">{d.phase}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {isPrivileged && d.status !== 'completed' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => handleToggleComplete(e, d)}
                        disabled={savingId === d.id}
                        icon={
                          savingId === d.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )
                        }
                      >
                        Mark complete
                      </Button>
                    )}
                    {isPrivileged && d.status === 'completed' && (
                      <button
                        onClick={(e) => handleToggleComplete(e, d)}
                        className="text-2xs text-neutral-400 hover:text-neutral-700 cursor-pointer"
                      >
                        Re-open
                      </button>
                    )}
                  </div>

                  <ProgressBar
                    value={d.progress}
                    color={
                      d.status === 'completed' ? 'success' :
                      d.status === 'overdue' ? 'danger' :
                      d.status === 'at-risk' ? 'warning' :
                      'brand'
                    }
                  />

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDueDate(d.dueDate)}
                      </span>
                      {d.daysRemaining !== null && d.status !== 'completed' && (
                        <span className={`flex items-center gap-1 ${d.daysRemaining < 0 ? 'text-danger-600 font-medium' : d.daysRemaining <= 3 ? 'text-warning-600' : ''}`}>
                          <Clock className="h-3 w-3" />
                          {daysLabel(d.daysRemaining)}
                        </span>
                      )}
                      {d.blockers > 0 && (
                        <span className="text-danger-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {d.blockers} blocker{d.blockers === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    {d.assignee && (
                      <div className="flex items-center gap-1.5 text-neutral-500">
                        <Avatar name={d.assignee} size="xs" />
                        <span className="text-xs">{d.assignee}</span>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
