import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Audit log hook — CEO-only viewer with cursor pagination.
// ───────────────────────────────────────────

export interface AuditUser {
  id: string
  name: string
  avatar: string | null
  role: string
}

export interface AuditEntry {
  id: string
  action: string
  entity: string
  entityId: string | null
  metadata: unknown
  ipAddress: string | null
  createdAt: string
  user: AuditUser | null
}

export interface AuditStats {
  windowCount: number
  topActors: Array<{ id: string; name: string; count: number }>
  topActions: Array<{ action: string; count: number }>
}

export interface AuditFilters {
  action?: string
  entity?: string
  userId?: string
}

interface Payload {
  logs: AuditEntry[]
  nextCursor: string | null
  stats: AuditStats
}

const FALLBACK_PAYLOAD: Payload = {
  logs: [
    { id: 'al1', action: 'document.create', entity: 'DOCUMENT', entityId: 'd1', metadata: { title: 'Bella Cucina Service Agreement', type: 'contract' }, ipAddress: null, createdAt: new Date(Date.now() - 30 * 60_000).toISOString(), user: { id: 'u1', name: 'Noman Ali', avatar: null, role: 'CEO' } },
    { id: 'al2', action: 'action_rule.create', entity: 'ACTION_RULE', entityId: 'r-new', metadata: { name: 'Escalate overdue invoices', trigger: 'INVOICE_OVERDUE', actionType: 'ESCALATE' }, ipAddress: null, createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(), user: { id: 'u1', name: 'Noman Ali', avatar: null, role: 'CEO' } },
    { id: 'al3', action: 'attachment.create', entity: 'DOCUMENT', entityId: 'd1', metadata: { fileName: 'signed-contract.pdf', fileSize: 245_000 }, ipAddress: null, createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(), user: { id: 'u1', name: 'Noman Ali', avatar: null, role: 'CEO' } },
    { id: 'al4', action: 'document.update', entity: 'DOCUMENT', entityId: 'd3', metadata: { changed: ['status'], newStatus: 'sent' }, ipAddress: null, createdAt: new Date(Date.now() - 6 * 3600_000).toISOString(), user: { id: 'u8', name: 'Zara Ahmed', avatar: null, role: 'MANAGER' } },
    { id: 'al5', action: 'action_rule.update', entity: 'ACTION_RULE', entityId: 'r-overdue', metadata: { changed: ['isActive'] }, ipAddress: null, createdAt: new Date(Date.now() - 24 * 3600_000).toISOString(), user: { id: 'u1', name: 'Noman Ali', avatar: null, role: 'CEO' } },
  ],
  nextCursor: null,
  stats: {
    windowCount: 5,
    topActors: [
      { id: 'u1', name: 'Noman Ali', count: 4 },
      { id: 'u8', name: 'Zara Ahmed', count: 1 },
    ],
    topActions: [
      { action: 'document.create', count: 1 },
      { action: 'document.update', count: 1 },
      { action: 'action_rule.create', count: 1 },
      { action: 'action_rule.update', count: 1 },
      { action: 'attachment.create', count: 1 },
    ],
  },
}

export function useAudit(initial: AuditFilters = {}) {
  const [logs, setLogs] = useState<AuditEntry[]>(FALLBACK_PAYLOAD.logs)
  const [stats, setStats] = useState<AuditStats>(FALLBACK_PAYLOAD.stats)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [filters, setFilters] = useState<AuditFilters>(initial)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const queryKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.action) params.set('action', filters.action)
    if (filters.entity) params.set('entity', filters.entity)
    if (filters.userId) params.set('userId', filters.userId)
    const qs = params.toString() ? `?${params.toString()}` : ''
    try {
      const res = await api.get<Payload>(`/audit${qs}`)
      setLogs(res.logs)
      setStats(res.stats)
      setNextCursor(res.nextCursor)
      setUsingFallback(false)
      setForbidden(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true)
      } else if (err instanceof ApiError && err.status === 0) {
        setUsingFallback(true)
      }
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey])

  useEffect(() => {
    void load()
  }, [load])

  const loadMore = useCallback(async () => {
    if (!nextCursor) return
    const params = new URLSearchParams()
    if (filters.action) params.set('action', filters.action)
    if (filters.entity) params.set('entity', filters.entity)
    if (filters.userId) params.set('userId', filters.userId)
    params.set('before', nextCursor)
    try {
      const res = await api.get<Payload>(`/audit?${params.toString()}`)
      setLogs((prev) => [...prev, ...res.logs])
      setNextCursor(res.nextCursor)
    } catch {
      /* swallow */
    }
  }, [filters, nextCursor])

  return {
    logs, stats, nextCursor, filters, loading, usingFallback, forbidden,
    setFilters, refresh: load, loadMore,
  }
}
