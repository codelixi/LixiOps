import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, Clock, RefreshCw, Loader2, CheckCircle2, Send, ChevronDown } from 'lucide-react'
import { Button, Badge, Card, Avatar, ProgressBar } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useDesignBriefs } from '@/hooks/useDesignBriefs'
import { useClients } from '@/hooks/useClients'
import { useUsers } from '@/hooks/useUsers'
import { useAuthStore } from '@/stores/useAuthStore'
import type { BriefStatus } from '@/hooks/useDesignBriefs'
import { CreateBriefModal } from './CreateBriefModal'

const statusMap: Record<BriefStatus, { label: string; variant: 'default' | 'info' | 'warning' | 'danger' | 'success' }> = {
  briefing: { label: 'Briefing', variant: 'default' },
  in_progress: { label: 'In Progress', variant: 'info' },
  review: { label: 'In Review', variant: 'warning' },
  revisions: { label: 'Revisions', variant: 'danger' },
  approved: { label: 'Approved', variant: 'success' },
  open: { label: 'Open', variant: 'default' },
}

const STATUS_ORDER: BriefStatus[] = ['briefing', 'in_progress', 'review', 'revisions', 'approved']

function formatDueDate(iso: string | null): string {
  if (!iso) return 'No due date'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type Filter = 'all' | BriefStatus

export function DesignBriefsPage() {
  const role = useAuthStore((s) => s.user?.role)
  const isPrivileged = role === 'CEO' || role === 'MANAGER'
  const { stats, briefs, loading, usingFallback, refresh, createBrief, updateStatus, recordApproval } =
    useDesignBriefs()
  const { clients } = useClients()
  const { users } = useUsers()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)

  const designers = useMemo(
    () => users.filter((u) => /design|creative/i.test(u.role ?? '') || !u.role).concat(users.filter((u) => !/design|creative/i.test(u.role ?? '') && u.role)),
    [users],
  )
  const lightClients = useMemo(() => clients.map((c) => ({ id: c.id, company: c.name })), [clients])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return briefs.filter((b) => {
      const matchesStatus = filter === 'all' || b.status === filter
      const matchesQ =
        !q ||
        b.objective.toLowerCase().includes(q) ||
        b.client?.company.toLowerCase().includes(q) ||
        b.deliverable.toLowerCase().includes(q)
      return matchesStatus && matchesQ
    })
  }, [briefs, filter, search])

  const handleStatusChange = async (briefId: string, next: BriefStatus) => {
    setActingId(briefId)
    try {
      await updateStatus(briefId, next)
    } catch (err: any) {
      window.alert(err?.message ?? 'Failed to update brief')
    } finally {
      setActingId(null)
    }
  }

  const handleApproval = async (briefId: string, action: 'approved' | 'sent_back') => {
    const stage = role === 'CEO' ? 'ceo' : role === 'MANAGER' ? 'manager' : 'designer'
    const comment = action === 'sent_back' ? window.prompt('Note for the designer (optional)') ?? undefined : undefined
    setActingId(briefId)
    try {
      await recordApproval(briefId, { stage, action, comment })
    } catch (err: any) {
      window.alert(err?.message ?? 'Failed to record approval')
    } finally {
      setActingId(null)
    }
  }

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: stats.total },
    { id: 'in_progress', label: 'In Progress', count: briefs.filter((b) => b.status === 'in_progress').length },
    { id: 'review', label: 'In Review', count: stats.inReview },
    { id: 'revisions', label: 'Revisions', count: stats.revisions },
    { id: 'approved', label: 'Approved', count: stats.approved },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Design Briefs</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Track creative projects and approvals
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
            {loading && !usingFallback && (
              <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin text-neutral-400" />
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={refresh}>
            Refresh
          </Button>
          {isPrivileged && (
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
              New Brief
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Active Briefs</p>
          <p className="text-2xl font-bold text-neutral-900">{stats.active}</p>
          <p className="text-2xs text-neutral-400 mt-1">of {stats.total} total</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">In Review</p>
          <p className="text-2xl font-bold text-warning-600">{stats.inReview}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Need Revisions</p>
          <p className="text-2xl font-bold text-danger-600">{stats.revisions}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Approved</p>
          <p className="text-2xl font-bold text-success-600">{stats.approved}</p>
        </Card>
      </div>

      {/* Filter + search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
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
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search briefs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-64 transition-all"
          />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500 text-center py-12">
            {briefs.length === 0
              ? 'No briefs yet. Start one for the next deliverable.'
              : 'No briefs match this filter.'}
          </p>
        </Card>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 lg:grid-cols-2 gap-5"
        >
          {filtered.map((b) => {
            const status = statusMap[b.status]
            const canMoveStatus = isPrivileged
            return (
              <motion.div key={b.id} variants={staggerItem}>
                <Card hover>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-semibold text-neutral-900">{b.objective}</h3>
                        <Badge variant={status.variant} dot>
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-500 line-clamp-2">{b.deliverable}</p>
                    </div>
                    {canMoveStatus && (
                      <div className="relative flex-shrink-0">
                        <select
                          value={b.status}
                          onChange={(e) => handleStatusChange(b.id, e.target.value as BriefStatus)}
                          disabled={actingId === b.id}
                          className="appearance-none text-2xs px-2 pr-6 py-1 border border-neutral-200 rounded-md bg-white cursor-pointer hover:border-neutral-300 disabled:opacity-50"
                        >
                          {STATUS_ORDER.map((s) => (
                            <option key={s} value={s}>{statusMap[s].label}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none text-neutral-400" />
                      </div>
                    )}
                  </div>

                  <ProgressBar
                    value={b.progress}
                    color={b.status === 'approved' ? 'success' : b.status === 'revisions' ? 'danger' : b.status === 'review' ? 'warning' : 'brand'}
                  />

                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-2xs text-neutral-400 uppercase tracking-wider mb-0.5">Client</p>
                      <p className="font-medium text-neutral-700 truncate">{b.client?.company ?? 'Internal'}</p>
                    </div>
                    <div>
                      <p className="text-2xs text-neutral-400 uppercase tracking-wider mb-0.5">Designer</p>
                      <div className="flex items-center gap-1.5">
                        {b.designer ? (
                          <>
                            <Avatar name={b.designer.name} size="xs" />
                            <span className="font-medium text-neutral-700 truncate">{b.designer.name}</span>
                          </>
                        ) : (
                          <span className="text-neutral-400">Unassigned</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-2xs text-neutral-400 uppercase tracking-wider mb-0.5">Due</p>
                      <p className="font-medium text-neutral-700 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-neutral-400" />
                        {formatDueDate(b.dueDate)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-2xs text-neutral-500">
                      {b.revisionCount > 0 && (
                        <span className="text-danger-600 font-medium">{b.revisionCount} revision{b.revisionCount === 1 ? '' : 's'}</span>
                      )}
                      {b.estimatedHours !== null && b.estimatedHours > 0 && (
                        <span>{b.estimatedHours}h budget</span>
                      )}
                    </div>
                    {b.status === 'review' && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleApproval(b.id, 'sent_back')}
                          disabled={actingId === b.id}
                        >
                          Send back
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApproval(b.id, 'approved')}
                          disabled={actingId === b.id}
                          icon={
                            actingId === b.id ? (
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
                    {b.status === 'in_progress' && isPrivileged && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleStatusChange(b.id, 'review')}
                        disabled={actingId === b.id}
                        icon={<Send className="h-3.5 w-3.5" />}
                      >
                        Submit for review
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      <CreateBriefModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        clients={lightClients}
        designers={designers}
        onSubmit={createBrief}
      />
    </div>
  )
}
