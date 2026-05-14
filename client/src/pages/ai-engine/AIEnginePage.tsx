import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Brain, Zap, Play, Loader2, CheckCircle2, AlertTriangle, FileText, Users, FolderKanban, Target, Clock, Plus, Trash2,
} from 'lucide-react'
import { Card, Badge, Button } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useActionEngine } from '@/hooks/useActionEngine'
import type { ActionTrigger, ScheduledAction } from '@/hooks/useActionEngine'
import { useInsights } from '@/hooks/useInsights'
import { CreateRuleModal } from './CreateRuleModal'
import type { RulePreset } from './CreateRuleModal'
import { InsightsPanel } from './InsightsPanel'

// ───────────────────────────────────────────
// Operator-facing surface for the in-process Action Engine.
// Three views: Recent fires (default), Rules, and Triggers (stats).
// ───────────────────────────────────────────

const triggerLabels: Record<ActionTrigger, string> = {
  INVOICE_OVERDUE: 'Invoice overdue',
  INVOICE_DUE_SOON: 'Invoice due soon',
  LEAD_STALE: 'Lead stale',
  LEAD_IN_STAGE_TOO_LONG: 'Lead stuck in stage',
  PROJECT_PAST_DUE: 'Project past due',
  PROJECT_NO_UPDATE: 'Project no update',
  MILESTONE_DUE_SOON: 'Milestone due soon',
  TASK_OVERDUE: 'Task overdue',
  CONTRACT_EXPIRING: 'Contract expiring',
  SLA_BREACH: 'SLA breach',
  NPS_LOW: 'NPS low',
}

const triggerColor: Record<ActionTrigger, string> = {
  INVOICE_OVERDUE: 'bg-danger-50 text-danger-600',
  INVOICE_DUE_SOON: 'bg-warning-50 text-warning-600',
  LEAD_STALE: 'bg-warning-50 text-warning-600',
  LEAD_IN_STAGE_TOO_LONG: 'bg-warning-50 text-warning-600',
  PROJECT_PAST_DUE: 'bg-danger-50 text-danger-600',
  PROJECT_NO_UPDATE: 'bg-info-50 text-info-600',
  MILESTONE_DUE_SOON: 'bg-info-50 text-info-600',
  TASK_OVERDUE: 'bg-danger-50 text-danger-600',
  CONTRACT_EXPIRING: 'bg-warning-50 text-warning-600',
  SLA_BREACH: 'bg-danger-50 text-danger-600',
  NPS_LOW: 'bg-warning-50 text-warning-600',
}

const entityIcon: Record<string, React.ReactNode> = {
  invoice: <FileText className="h-3.5 w-3.5" />,
  lead: <Users className="h-3.5 w-3.5" />,
  project: <FolderKanban className="h-3.5 w-3.5" />,
  milestone: <Target className="h-3.5 w-3.5" />,
  task: <CheckCircle2 className="h-3.5 w-3.5" />,
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'never'
  const t = new Date(iso).getTime()
  if (isNaN(t)) return 'never'
  const diff = Math.max(0, Date.now() - t)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
  if (status === 'executed') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'failed') return 'danger'
  return 'default'
}

type Tab = 'insights' | 'recent' | 'rules' | 'triggers'

export function AIEnginePage() {
  const {
    rules, scheduled, stats, usingFallback, running, runError, runNow, toggleRule, createRule, deleteRule, refresh,
  } = useActionEngine()
  const {
    insights, generatedAt, loading: insightsLoading, refresh: refreshInsights,
  } = useInsights()
  const [tab, setTab] = useState<Tab>('insights')
  const [ruleError, setRuleError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [rulePreset, setRulePreset] = useState<RulePreset | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleToggle = async (id: string, next: boolean) => {
    setRuleError(null)
    try {
      await toggleRule(id, next)
    } catch (err: any) {
      setRuleError(err?.message ?? 'Failed to update rule')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This will remove the rule and its fire history.`)) return
    setRuleError(null)
    setDeletingId(id)
    try {
      await deleteRule(id)
    } catch (err: any) {
      setRuleError(err?.message ?? 'Failed to delete rule')
    } finally {
      setDeletingId(null)
    }
  }

  const handleRunNow = async () => {
    try {
      await runNow()
    } catch {
      // surfaced via runError
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-6 w-6 text-brand-500" />
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Action Engine</h1>
          </div>
          <p className="text-sm text-neutral-500">
            Rule-driven automation that scans your business and notifies the right person
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
          </p>
        </div>
        <Button
          size="sm"
          icon={running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          onClick={handleRunNow}
          disabled={running}
        >
          {running ? 'Scanning…' : 'Run scan now'}
        </Button>
      </div>

      {runError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-50 border border-danger-200 text-xs text-danger-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          {runError}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Active Rules</p>
          <p className="text-2xl font-bold text-neutral-900">{stats.activeRules}</p>
          <p className="text-2xs text-neutral-400 mt-1">of {stats.totalRules} total</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Fired (24h)</p>
          <p className="text-2xl font-bold text-brand-500">{stats.fired24h}</p>
          <p className="text-2xs text-neutral-400 mt-1">{stats.fired7d} this week</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Last Scan</p>
          <p className="text-2xl font-bold text-neutral-900">{formatRelative(stats.lastRunAt)}</p>
          <p className="text-2xs text-neutral-400 mt-1">scans every 5 minutes</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Top Trigger</p>
          <p className="text-sm font-semibold text-neutral-900 leading-tight">
            {stats.byTrigger[0] ? triggerLabels[stats.byTrigger[0].trigger] : '—'}
          </p>
          <p className="text-2xs text-neutral-400 mt-1">{stats.byTrigger[0]?.count ?? 0} fires all-time</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
        {([
          { id: 'insights' as const, label: 'Insights' },
          { id: 'recent' as const, label: 'Recent Activity' },
          { id: 'rules' as const, label: 'Rules' },
          { id: 'triggers' as const, label: 'Trigger Stats' },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              tab === t.id ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Insights */}
      {tab === 'insights' && (
        <InsightsPanel
          insights={insights}
          generatedAt={generatedAt}
          loading={insightsLoading}
          refresh={refreshInsights}
          onCreateRule={(preset) => {
            setRulePreset({
              name: preset.name,
              trigger: preset.trigger as RulePreset['trigger'],
              actionType: preset.actionType as RulePreset['actionType'],
              config: preset.config,
            })
            setCreateOpen(true)
          }}
        />
      )}

      {/* Recent activity */}
      {tab === 'recent' && (
        <Card>
          {scheduled.length === 0 ? (
            <div className="py-10 text-center">
              <Zap className="h-6 w-6 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500">No automation has fired yet.</p>
              <p className="text-xs text-neutral-400 mt-1">Try "Run scan now" to trigger an immediate sweep.</p>
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="divide-y divide-neutral-100"
            >
              {scheduled.map((s: ScheduledAction) => (
                <motion.div
                  key={s.id}
                  variants={staggerItem}
                  className="flex items-start gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className={`flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${triggerColor[s.trigger] ?? 'bg-neutral-50 text-neutral-500'}`}>
                    <Zap className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-neutral-900">{triggerLabels[s.trigger] ?? s.trigger}</span>
                      <Badge variant={statusVariant(s.status)} dot>{s.status}</Badge>
                      <span className="text-2xs text-neutral-400">· {s.actionType.replace('_', ' ').toLowerCase()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-neutral-500">
                      <span className="text-neutral-400">{entityIcon[s.entityType]}</span>
                      <span className="capitalize">{s.entityType}</span>
                      {s.entityTitle && (
                        <>
                          <span className="text-neutral-300">·</span>
                          <span className="text-neutral-700 truncate">{s.entityTitle}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-xs text-neutral-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelative(s.executedAt ?? s.createdAt)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </Card>
      )}

      {/* Rules */}
      {tab === 'rules' && (
        <>
          {ruleError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-50 border border-danger-200 text-xs text-danger-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {ruleError}
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500">{rules.length} rule{rules.length === 1 ? '' : 's'} configured</p>
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
              New Rule
            </Button>
          </div>
          <Card>
            {rules.length === 0 ? (
              <div className="py-10 text-center">
                <Zap className="h-6 w-6 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-500">No rules configured.</p>
                <p className="text-xs text-neutral-400 mt-1">Create one to start automating responses to business events.</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {rules.map((rule) => (
                  <div key={rule.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                    <div className={`flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${triggerColor[rule.trigger] ?? 'bg-neutral-50 text-neutral-500'}`}>
                      <Zap className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-neutral-900">{rule.name}</span>
                        <Badge variant="default">{triggerLabels[rule.trigger] ?? rule.trigger}</Badge>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Action: <span className="font-mono text-neutral-700">{rule.actionType}</span>
                        <span className="mx-2 text-neutral-300">·</span>
                        Fired {rule.runCount} time{rule.runCount === 1 ? '' : 's'}
                        <span className="mx-2 text-neutral-300">·</span>
                        Last: {formatRelative(rule.lastRunAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggle(rule.id, !rule.isActive)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                        rule.isActive ? 'bg-brand-500' : 'bg-neutral-200'
                      }`}
                      aria-label={rule.isActive ? 'Disable rule' : 'Enable rule'}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                          rule.isActive ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id, rule.name)}
                      disabled={deletingId === rule.id}
                      className="h-8 w-8 flex items-center justify-center text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Delete rule"
                    >
                      {deletingId === rule.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </>
      )}

      {/* Trigger stats */}
      {tab === 'triggers' && (
        <Card>
          {stats.byTrigger.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">No fires recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.byTrigger.map((b) => {
                const max = stats.byTrigger[0]?.count || 1
                const pct = Math.round((b.count / max) * 100)
                return (
                  <div key={b.trigger}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${triggerColor[b.trigger] ?? 'bg-neutral-100 text-neutral-600'}`}>
                          {triggerLabels[b.trigger] ?? b.trigger}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-medium text-neutral-700">{b.count}</span>
                    </div>
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full bg-brand-500 rounded-full"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* Rule editor — shared between Rules tab "New Rule" button and Insights "Create rule" suggestions */}
      <CreateRuleModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setRulePreset(null)
        }}
        onCreated={() => {
          refresh()
          // If we created from an insight, jump to Rules tab so the user sees the new rule.
          if (rulePreset) setTab('rules')
        }}
        createRule={createRule}
        preset={rulePreset}
      />
    </div>
  )
}
