import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Megaphone, Pin, Eye, CheckCircle2, AlertCircle, Trash2, Loader2 } from 'lucide-react'
import { Button, Badge, Card, Avatar } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useBroadcasts } from '@/hooks/useBroadcasts'
import { useDepartments } from '@/hooks/useDepartments'
import { useUsers } from '@/hooks/useUsers'
import { useAuthStore } from '@/stores/useAuthStore'
import type { BroadcastType } from '@/hooks/useBroadcasts'
import { CreateBroadcastModal } from './CreateBroadcastModal'

const typeMap: Record<BroadcastType, { label: string; variant: 'info' | 'warning' | 'danger' | 'default' }> = {
  announcement: { label: 'Announcement', variant: 'info' },
  update: { label: 'Update', variant: 'default' },
  urgent: { label: 'Urgent', variant: 'danger' },
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type Filter = 'all' | BroadcastType | 'pinned' | 'unread'

export function BroadcastsPage() {
  const role = useAuthStore((s) => s.user?.role)
  const userId = useAuthStore((s) => s.user?.id)
  const isPrivileged = role === 'CEO' || role === 'MANAGER'
  const isCEO = role === 'CEO'

  const {
    broadcasts, loading, usingFallback, createBroadcast, markRead, acknowledge, togglePin, deleteBroadcast,
  } = useBroadcasts()
  const { departments } = useDepartments()
  const { users } = useUsers()

  const [filter, setFilter] = useState<Filter>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)

  // Auto-mark-as-read on first paint for whatever's currently visible.
  // Only triggers once per broadcast id since markRead is no-op when already read.
  useEffect(() => {
    if (loading) return
    const unread = broadcasts.filter((b) => b.myReceipt && !b.myReceipt.read).slice(0, 5)
    for (const b of unread) {
      void markRead(b.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const filtered = useMemo(() => {
    return broadcasts.filter((b) => {
      if (filter === 'all') return true
      if (filter === 'pinned') return b.isPinned
      if (filter === 'unread') return b.myReceipt && !b.myReceipt.read
      return b.type === filter
    })
  }, [broadcasts, filter])

  const unreadCount = broadcasts.filter((b) => b.myReceipt && !b.myReceipt.read).length
  const pendingAckCount = broadcasts.filter((b) => b.requiresAck && b.myReceipt && !b.myReceipt.acknowledged).length

  const handleAck = async (id: string) => {
    setActingId(id)
    try {
      await acknowledge(id)
    } catch (err: any) {
      window.alert(err?.message ?? 'Failed to acknowledge')
    } finally {
      setActingId(null)
    }
  }

  const handlePin = async (id: string, next: boolean) => {
    try {
      await togglePin(id, next)
    } catch (err: any) {
      window.alert(err?.message ?? 'Failed to update pin')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this broadcast? Recipients will lose visibility.')) return
    setActingId(id)
    try {
      await deleteBroadcast(id)
    } catch (err: any) {
      window.alert(err?.message ?? 'Failed to delete')
    } finally {
      setActingId(null)
    }
  }

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: broadcasts.length },
    { id: 'pinned', label: 'Pinned', count: broadcasts.filter((b) => b.isPinned).length },
    { id: 'unread', label: 'Unread', count: unreadCount },
    { id: 'announcement', label: 'Announcements', count: broadcasts.filter((b) => b.type === 'announcement').length },
    { id: 'urgent', label: 'Urgent', count: broadcasts.filter((b) => b.type === 'urgent').length },
    { id: 'update', label: 'Updates', count: broadcasts.filter((b) => b.type === 'update').length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Megaphone className="h-5 w-5 text-brand-500" />
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Broadcasts</h1>
          </div>
          <p className="text-sm text-neutral-500">
            Company-wide announcements and updates
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
            {loading && !usingFallback && (
              <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin text-neutral-400" />
            )}
          </p>
        </div>
        {isPrivileged && (
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
            New Broadcast
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total</p>
          <p className="text-2xl font-bold text-neutral-900">{broadcasts.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Unread</p>
          <p className="text-2xl font-bold text-brand-500">{unreadCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Awaiting Ack</p>
          <p className="text-2xl font-bold text-warning-600">{pendingAckCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Pinned</p>
          <p className="text-2xl font-bold text-neutral-900">{broadcasts.filter((b) => b.isPinned).length}</p>
        </Card>
      </div>

      {/* Filter chips */}
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

      {/* Feed */}
      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500 text-center py-12">
            {broadcasts.length === 0
              ? 'No broadcasts yet.'
              : `Nothing matches "${filter}".`}
          </p>
        </Card>
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
          {filtered.map((b) => {
            const type = typeMap[b.type]
            const isAuthor = b.authorId === userId
            const readPct = b.totalRecipients > 0 ? Math.round((b.readCount / b.totalRecipients) * 100) : 0
            const ackPct = b.totalRecipients > 0 ? Math.round((b.ackCount / b.totalRecipients) * 100) : 0

            return (
              <motion.div key={b.id} variants={staggerItem}>
                <Card className={b.type === 'urgent' ? 'border-danger-200 bg-danger-50/30' : ''}>
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar name={b.author.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold text-neutral-900">{b.author.name}</span>
                        <span className="text-2xs text-neutral-400 uppercase tracking-wider">{b.author.role}</span>
                        <span className="text-neutral-300">·</span>
                        <span className="text-xs text-neutral-500">{formatRelative(b.createdAt)}</span>
                        <Badge variant={type.variant} dot>{type.label}</Badge>
                        {b.isPinned && (
                          <Badge variant="default">
                            <Pin className="h-3 w-3 inline mr-1" />
                            Pinned
                          </Badge>
                        )}
                        {b.myReceipt && !b.myReceipt.read && (
                          <Badge variant="info">Unread</Badge>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500">
                        {b.recipientType === 'all'
                          ? `Sent to everyone · ${b.totalRecipients} recipient${b.totalRecipients === 1 ? '' : 's'}`
                          : b.recipientType === 'department'
                            ? `Department broadcast · ${b.totalRecipients} recipient${b.totalRecipients === 1 ? '' : 's'}`
                            : 'Direct message'}
                      </p>
                    </div>
                    {(isAuthor || isPrivileged) && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isPrivileged && (
                          <button
                            onClick={() => handlePin(b.id, !b.isPinned)}
                            className={`h-7 w-7 flex items-center justify-center rounded cursor-pointer ${
                              b.isPinned ? 'text-brand-600 bg-brand-50' : 'text-neutral-400 hover:text-brand-600 hover:bg-brand-50'
                            }`}
                            aria-label={b.isPinned ? 'Unpin' : 'Pin'}
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isCEO && (
                          <button
                            onClick={() => handleDelete(b.id)}
                            disabled={actingId === b.id}
                            className="h-7 w-7 flex items-center justify-center text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded cursor-pointer disabled:opacity-50"
                            aria-label="Delete"
                          >
                            {actingId === b.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap mb-3">{b.message}</p>

                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4 text-xs text-neutral-500">
                      <span className="flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 text-neutral-400" />
                        {b.readCount}/{b.totalRecipients} read ({readPct}%)
                      </span>
                      {b.requiresAck && (
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-neutral-400" />
                          {b.ackCount}/{b.totalRecipients} acked ({ackPct}%)
                        </span>
                      )}
                    </div>
                    {b.requiresAck && b.myReceipt && !b.myReceipt.acknowledged && !isAuthor && (
                      <Button
                        size="sm"
                        onClick={() => handleAck(b.id)}
                        disabled={actingId === b.id}
                        icon={
                          actingId === b.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5" />
                          )
                        }
                      >
                        Acknowledge
                      </Button>
                    )}
                    {b.requiresAck && b.myReceipt?.acknowledged && (
                      <span className="text-2xs text-success-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        You acked {formatRelative(b.myReceipt.acknowledgedAt ?? b.createdAt)}
                      </span>
                    )}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      <CreateBroadcastModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={createBroadcast}
        departments={departments}
        users={users}
      />
    </div>
  )
}
