import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Search, RefreshCw, Loader2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, Badge, Avatar, Button } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useAudit } from '@/hooks/useAudit'

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

const ACTION_COLOR: Record<string, string> = {
  create: 'bg-success-50 text-success-700',
  update: 'bg-info-50 text-info-700',
  delete: 'bg-danger-50 text-danger-700',
}

function actionVerb(action: string): string {
  return action.split('.')[1] ?? 'changed'
}

function actionEntity(action: string): string {
  return action.split('.')[0] ?? action
}

export function AuditLogPage() {
  const { logs, stats, nextCursor, filters, loading, usingFallback, forbidden, setFilters, refresh, loadMore } = useAudit()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return logs
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.user?.name.toLowerCase().includes(q) ||
        l.entity.toLowerCase().includes(q) ||
        (l.entityId ?? '').toLowerCase().includes(q),
    )
  }, [logs, search])

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (forbidden) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md text-center">
          <Shield className="h-8 w-8 text-neutral-400 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-neutral-900 mb-1">Audit log is CEO-only</h2>
          <p className="text-sm text-neutral-500">
            Activity tracking is available to the CEO role. If you need access for compliance, ask your admin to grant the role.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-brand-500" />
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Audit Log</h1>
          </div>
          <p className="text-sm text-neutral-500">
            Tamper-evident record of privileged actions
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

      {/* Stats strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Window count</p>
          <p className="text-2xl font-bold text-neutral-900">{stats.windowCount}</p>
          <p className="text-2xs text-neutral-400 mt-1">events in the current view</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Top actors</p>
          <div className="space-y-1.5">
            {stats.topActors.slice(0, 3).map((a) => (
              <div key={a.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Avatar name={a.name} size="xs" />
                  <span className="font-medium text-neutral-700">{a.name}</span>
                </div>
                <span className="font-mono text-neutral-500">{a.count}</span>
              </div>
            ))}
            {stats.topActors.length === 0 && <p className="text-xs text-neutral-400">No activity</p>}
          </div>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Top actions</p>
          <div className="space-y-1.5">
            {stats.topActions.slice(0, 3).map((a) => (
              <div key={a.action} className="flex items-center justify-between text-xs">
                <span className="font-mono text-neutral-700">{a.action}</span>
                <span className="font-mono text-neutral-500">{a.count}</span>
              </div>
            ))}
            {stats.topActions.length === 0 && <p className="text-xs text-neutral-400">No actions</p>}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[20rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by user, action, or entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>
        <select
          value={filters.entity ?? ''}
          onChange={(e) => setFilters({ ...filters, entity: e.target.value || undefined })}
          className="h-9 px-3 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <option value="">All entities</option>
          <option value="DOCUMENT">Document</option>
          <option value="ACTION_RULE">Action Rule</option>
          <option value="ATTACHMENT">Attachment</option>
          <option value="DECISION">Decision</option>
          <option value="USER">User</option>
        </select>
      </div>

      {/* Log entries */}
      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500 text-center py-12">
            {logs.length === 0 ? 'No audit entries yet.' : 'Nothing matches your filters.'}
          </p>
        </Card>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-2"
        >
          {filtered.map((log) => {
            const verb = actionVerb(log.action)
            const entityShort = actionEntity(log.action)
            const isExpanded = expanded.has(log.id)
            const hasMeta = Boolean(log.metadata && typeof log.metadata === 'object' && Object.keys(log.metadata as Record<string, unknown>).length > 0)
            return (
              <motion.div key={log.id} variants={staggerItem}>
                <Card className="!py-3">
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => hasMeta && toggle(log.id)}
                  >
                    {hasMeta ? (
                      isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                      )
                    ) : (
                      <div className="w-3.5 flex-shrink-0" />
                    )}
                    {log.user ? (
                      <Avatar name={log.user.name} size="xs" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-neutral-100 flex items-center justify-center text-2xs text-neutral-400">?</div>
                    )}
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-neutral-900">{log.user?.name ?? 'System'}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-2xs font-mono uppercase tracking-wider ${
                          ACTION_COLOR[verb] ?? 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {verb}
                      </span>
                      <span className="text-xs text-neutral-500">a</span>
                      <Badge variant="default" className="font-mono">{entityShort}</Badge>
                      {log.entityId && (
                        <span className="text-2xs font-mono text-neutral-400 truncate">{log.entityId.slice(0, 12)}</span>
                      )}
                    </div>
                    <div className="text-2xs text-neutral-400 flex-shrink-0" title={formatTime(log.createdAt)}>
                      {formatRelative(log.createdAt)}
                    </div>
                  </div>

                  {isExpanded && hasMeta && (
                    <div className="mt-3 ml-7 p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                      <p className="text-2xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5">Metadata</p>
                      <pre className="text-xs font-mono text-neutral-700 whitespace-pre-wrap break-words">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                      <p className="mt-3 text-2xs text-neutral-400">
                        {formatTime(log.createdAt)}
                        {log.ipAddress && <span> · {log.ipAddress}</span>}
                      </p>
                    </div>
                  )}
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={loadMore}>
            Load older
          </Button>
        </div>
      )}

      {usingFallback && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning-50 border border-warning-200 text-xs text-warning-700">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          Backend unreachable — showing demo data. Real entries will appear once the server is up.
        </div>
      )}
    </div>
  )
}
