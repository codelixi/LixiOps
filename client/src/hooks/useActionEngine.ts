import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Action Engine hook — pulls rules + recent fires + stats from
// the in-process automation scanner. Exposes toggle + manual run.
// ───────────────────────────────────────────

export type ActionTrigger =
  | 'INVOICE_OVERDUE'
  | 'INVOICE_DUE_SOON'
  | 'LEAD_STALE'
  | 'LEAD_IN_STAGE_TOO_LONG'
  | 'PROJECT_PAST_DUE'
  | 'PROJECT_NO_UPDATE'
  | 'MILESTONE_DUE_SOON'
  | 'TASK_OVERDUE'
  | 'CONTRACT_EXPIRING'
  | 'SLA_BREACH'
  | 'NPS_LOW'

export type ActionType =
  | 'NOTIFY_USER'
  | 'NOTIFY_ROLE'
  | 'EMAIL'
  | 'CREATE_TASK'
  | 'ESCALATE'
  | 'WEBHOOK'

export interface ActionRule {
  id: string
  name: string
  trigger: ActionTrigger
  actionType: ActionType
  config: Record<string, unknown>
  isActive: boolean
  lastRunAt: string | null
  runCount: number
  createdAt: string
  updatedAt: string
  _count?: { scheduled: number }
}

export interface ScheduledAction {
  id: string
  ruleId: string
  ruleName: string
  trigger: ActionTrigger
  actionType: ActionType
  entityType: string
  entityId: string
  entityTitle: string | null
  status: string
  attempts: number
  result: unknown
  scheduledFor: string
  executedAt: string | null
  createdAt: string
}

export interface EngineStats {
  activeRules: number
  totalRules: number
  fired24h: number
  fired7d: number
  lastRunAt: string | null
  byTrigger: Array<{ trigger: ActionTrigger; count: number }>
}

const FALLBACK_RULES: ActionRule[] = [
  { id: 'r1', name: 'Default: INVOICE_OVERDUE', trigger: 'INVOICE_OVERDUE', actionType: 'NOTIFY_USER', config: {}, isActive: true, lastRunAt: new Date().toISOString(), runCount: 12, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { scheduled: 12 } },
  { id: 'r2', name: 'Default: INVOICE_DUE_SOON', trigger: 'INVOICE_DUE_SOON', actionType: 'NOTIFY_USER', config: {}, isActive: true, lastRunAt: new Date().toISOString(), runCount: 4, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { scheduled: 4 } },
  { id: 'r3', name: 'Default: LEAD_STALE', trigger: 'LEAD_STALE', actionType: 'NOTIFY_USER', config: {}, isActive: true, lastRunAt: new Date().toISOString(), runCount: 8, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { scheduled: 8 } },
  { id: 'r4', name: 'Default: PROJECT_PAST_DUE', trigger: 'PROJECT_PAST_DUE', actionType: 'NOTIFY_USER', config: {}, isActive: true, lastRunAt: new Date().toISOString(), runCount: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { scheduled: 2 } },
  { id: 'r5', name: 'Default: MILESTONE_DUE_SOON', trigger: 'MILESTONE_DUE_SOON', actionType: 'NOTIFY_USER', config: {}, isActive: false, lastRunAt: null, runCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { scheduled: 0 } },
]

const FALLBACK_SCHEDULED: ScheduledAction[] = [
  { id: 's1', ruleId: 'r1', ruleName: 'Default: INVOICE_OVERDUE', trigger: 'INVOICE_OVERDUE', actionType: 'NOTIFY_USER', entityType: 'invoice', entityId: 'inv-3', entityTitle: 'INV-2026-003 · Urban Threads', status: 'executed', attempts: 1, result: { ok: true }, scheduledFor: new Date(Date.now() - 30 * 60_000).toISOString(), executedAt: new Date(Date.now() - 30 * 60_000).toISOString(), createdAt: new Date(Date.now() - 30 * 60_000).toISOString() },
  { id: 's2', ruleId: 'r3', ruleName: 'Default: LEAD_STALE', trigger: 'LEAD_STALE', actionType: 'NOTIFY_USER', entityType: 'lead', entityId: 'l-9', entityTitle: 'GreenTech Solutions', status: 'executed', attempts: 1, result: { ok: true }, scheduledFor: new Date(Date.now() - 2 * 3600_000).toISOString(), executedAt: new Date(Date.now() - 2 * 3600_000).toISOString(), createdAt: new Date(Date.now() - 2 * 3600_000).toISOString() },
  { id: 's3', ruleId: 'r4', ruleName: 'Default: PROJECT_PAST_DUE', trigger: 'PROJECT_PAST_DUE', actionType: 'NOTIFY_USER', entityType: 'project', entityId: 'p-4', entityTitle: 'CareFirst Patient Portal · CareFirst Health', status: 'executed', attempts: 1, result: { ok: true }, scheduledFor: new Date(Date.now() - 5 * 3600_000).toISOString(), executedAt: new Date(Date.now() - 5 * 3600_000).toISOString(), createdAt: new Date(Date.now() - 5 * 3600_000).toISOString() },
]

const FALLBACK_STATS: EngineStats = {
  activeRules: 4,
  totalRules: 5,
  fired24h: 6,
  fired7d: 26,
  lastRunAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  byTrigger: [
    { trigger: 'INVOICE_OVERDUE', count: 12 },
    { trigger: 'LEAD_STALE', count: 8 },
    { trigger: 'INVOICE_DUE_SOON', count: 4 },
    { trigger: 'PROJECT_PAST_DUE', count: 2 },
  ],
}

export function useActionEngine() {
  const [rules, setRules] = useState<ActionRule[]>(FALLBACK_RULES)
  const [scheduled, setScheduled] = useState<ScheduledAction[]>(FALLBACK_SCHEDULED)
  const [stats, setStats] = useState<EngineStats>(FALLBACK_STATS)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [rulesRes, schedRes, statsRes] = await Promise.all([
        api.get<{ rules: ActionRule[] }>('/action-engine/rules'),
        api.get<{ scheduled: ScheduledAction[] }>('/action-engine/scheduled?limit=50'),
        api.get<EngineStats>('/action-engine/stats'),
      ])
      setRules(rulesRes.rules)
      setScheduled(schedRes.scheduled)
      setStats(statsRes)
      setUsingFallback(false)
    } catch (err) {
      setUsingFallback(err instanceof ApiError && err.status === 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const toggleRule = useCallback(
    async (id: string, isActive: boolean) => {
      // Optimistic update
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, isActive } : r)))
      try {
        await api.patch<{ rule: ActionRule }>(`/action-engine/rules/${id}`, { isActive })
      } catch (err) {
        // Revert on failure
        setRules((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: !isActive } : r)))
        throw err
      }
    },
    [],
  )

  const createRule = useCallback(
    async (payload: {
      name: string
      trigger: ActionTrigger
      actionType: ActionType
      config?: Record<string, unknown>
      isActive?: boolean
    }) => {
      const res = await api.post<{ rule: ActionRule }>('/action-engine/rules', payload)
      setRules((prev) => [res.rule, ...prev])
      return res.rule
    },
    [],
  )

  const deleteRule = useCallback(async (id: string) => {
    await api.del<unknown>(`/action-engine/rules/${id}`)
    setRules((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const runNow = useCallback(async () => {
    setRunning(true)
    setRunError(null)
    try {
      const res = await api.post<{ fired: number; ts: string }>('/action-engine/run', {})
      // Refresh after manual run
      await loadAll()
      return res
    } catch (err: any) {
      setRunError(err?.message ?? 'Manual run failed')
      throw err
    } finally {
      setRunning(false)
    }
  }, [loadAll])

  return {
    rules,
    scheduled,
    stats,
    loading,
    usingFallback,
    running,
    runError,
    refresh: loadAll,
    toggleRule,
    createRule,
    deleteRule,
    runNow,
  }
}
