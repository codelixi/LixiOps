import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit3, ArrowUpRight, Target, Heart, Zap } from 'lucide-react'
import { Card, Badge, MetricCard, ProgressBar, Button, Avatar } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useReports } from '@/hooks/useReports'
import { useOKRs, okrProgress, okrStatus } from '@/hooks/useOKRs'
import { useClientHealth } from '@/hooks/useClientHealth'
import { useDecisions } from '@/hooks/useDecisions'
import { useAuthStore } from '@/stores/useAuthStore'
import type { Decision, DecisionCategory, DecisionStatus } from '@/hooks/useDecisions'
import { DecisionFormModal } from './DecisionFormModal'

const categoryColor: Record<DecisionCategory, string> = {
  strategic: 'bg-brand-50 text-brand-600',
  operational: 'bg-info-50 text-info-600',
  financial: 'bg-success-50 text-success-600',
  hr: 'bg-warning-50 text-warning-600',
  product: 'bg-info-50 text-info-600',
  legal: 'bg-danger-50 text-danger-600',
}

const statusBadge: Record<DecisionStatus, { label: string; variant: 'warning' | 'success' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  decided: { label: 'Decided', variant: 'success' },
}

function currentQuarter(): { quarter: string; year: number } {
  const d = new Date()
  return { quarter: `Q${Math.floor(d.getMonth() / 3) + 1}`, year: d.getFullYear() }
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ManagementDashboardPage() {
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.user?.role)
  const isPrivileged = role === 'CEO' || role === 'MANAGER'
  const { quarter, year } = currentQuarter()

  const { data: reports } = useReports('30d')
  const { okrs } = useOKRs({ quarter, year })
  const { stats: healthStats, clients: clientList } = useClientHealth()
  const { decisions, createDecision, updateDecision } = useDecisions()

  const [decisionOpen, setDecisionOpen] = useState(false)
  const [editing, setEditing] = useState<Decision | null>(null)

  const revenueKpi = reports.kpiCards.find((k) => k.label === 'Total Revenue')
  const marginKpi = reports.kpiCards.find((k) => k.label === 'Profit Margin')
  const retentionKpi = reports.kpiCards.find((k) => k.label === 'Client Retention')
  const utilizationKpi = reports.kpiCards.find((k) => k.label === 'Team Utilization')

  // Watch list — top at-risk clients by health (asc, capped)
  const watchClients = [...clientList]
    .filter((c) => c.healthScore < 75)
    .slice(0, 4)

  // OKR snapshot — sort by status (at-risk first) then ascending progress
  const okrSnapshot = okrs
    .map((o) => ({ okr: o, progress: okrProgress(o), status: okrStatus(okrProgress(o)) }))
    .sort((a, b) => {
      const order = { 'at-risk': 0, 'on-track': 1, healthy: 2, achieved: 3 } as const
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
      return a.progress - b.progress
    })

  const handleNewDecision = () => {
    setEditing(null)
    setDecisionOpen(true)
  }

  const handleEditDecision = (d: Decision) => {
    setEditing(d)
    setDecisionOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Management</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Strategic overview · {quarter} {year}
          </p>
        </div>
        {isPrivileged && (
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={handleNewDecision}>
            Log Decision
          </Button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        <MetricCard
          label="Revenue (30d)"
          value={revenueKpi?.value ?? '—'}
          change={revenueKpi?.change ?? 0}
        />
        <MetricCard
          label="Profit Margin"
          value={marginKpi?.value ?? '—'}
          change={marginKpi?.change ?? 0}
        />
        <MetricCard
          label="Client Retention"
          value={retentionKpi?.value ?? '—'}
          change={retentionKpi?.change ?? 0}
        />
        <MetricCard
          label="Team Utilization"
          value={utilizationKpi?.value ?? '—'}
          change={utilizationKpi?.change ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* OKRs column — 2/3 width */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-semibold text-neutral-900">{quarter} {year} OKRs</h2>
            </div>
            <button
              onClick={() => navigate('/okrs')}
              className="text-xs text-neutral-500 hover:text-neutral-900 cursor-pointer flex items-center gap-1"
            >
              All OKRs <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>

          {okrSnapshot.length === 0 ? (
            <Card>
              <p className="text-sm text-neutral-500 text-center py-8">
                No objectives for {quarter} {year} yet.
              </p>
            </Card>
          ) : (
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
              {okrSnapshot.map(({ okr, progress, status }) => (
                <motion.div key={okr.id} variants={staggerItem}>
                  <Card>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-neutral-900">{okr.objective}</h3>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {okr.department?.name ?? 'Unassigned'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {status === 'at-risk' && (
                          <Badge variant="danger" dot>At Risk</Badge>
                        )}
                        {status === 'healthy' && (
                          <Badge variant="success" dot>Healthy</Badge>
                        )}
                        <span className="text-sm font-bold text-neutral-900">{progress}%</span>
                      </div>
                    </div>
                    <ProgressBar
                      value={progress}
                      color={progress >= 70 ? 'success' : progress >= 40 ? 'brand' : 'danger'}
                    />
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Watch list */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-danger-500" />
              <h2 className="text-sm font-semibold text-neutral-900">Client Watch List</h2>
            </div>
            <button
              onClick={() => navigate('/client-health')}
              className="text-xs text-neutral-500 hover:text-neutral-900 cursor-pointer flex items-center gap-1"
            >
              All clients <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>

          {watchClients.length === 0 ? (
            <Card>
              <p className="text-sm text-neutral-500 text-center py-6">
                All {healthStats.total} clients are healthy.
              </p>
            </Card>
          ) : (
            <Card>
              <div className="divide-y divide-neutral-100">
                {watchClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/clients/${c.id}`)}
                    className="w-full text-left flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:bg-neutral-50 -mx-2 px-2 rounded-lg cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${
                        c.healthScore >= 60 ? 'bg-warning-50' : 'bg-danger-50'
                      }`}>
                        <span className={`text-sm font-bold ${
                          c.healthScore >= 60 ? 'text-warning-600' : 'text-danger-600'
                        }`}>{c.healthScore}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-900 truncate">{c.company}</p>
                        <p className="text-xs text-neutral-500 truncate">
                          {c.lastInteractionLabel}
                          {c.openIssues > 0 && (
                            <span className="ml-2 text-danger-600">· {c.openIssues} open risk{c.openIssues === 1 ? '' : 's'}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {c.npsScore !== null && (
                      <Badge variant={c.npsScore >= 8 ? 'success' : c.npsScore >= 6 ? 'warning' : 'danger'}>
                        NPS {c.npsScore}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Decision Log column — 1/3 width */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-semibold text-neutral-900">Decision Log</h2>
            </div>
            {isPrivileged && (
              <button
                onClick={handleNewDecision}
                className="text-xs text-brand-600 hover:text-brand-700 cursor-pointer flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> New
              </button>
            )}
          </div>

          {decisions.length === 0 ? (
            <Card>
              <div className="py-8 text-center">
                <p className="text-sm text-neutral-500">No decisions logged yet.</p>
                {isPrivileged && (
                  <p className="text-xs text-neutral-400 mt-1">
                    Capture the call now — fill in outcomes as they resolve.
                  </p>
                )}
              </div>
            </Card>
          ) : (
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
              {decisions.slice(0, 8).map((d) => (
                <motion.div key={d.id} variants={staggerItem}>
                  <Card>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-medium text-neutral-900 flex-1 min-w-0">{d.title}</h4>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Badge variant={statusBadge[d.status].variant}>
                          {statusBadge[d.status].label}
                        </Badge>
                        {isPrivileged && (
                          <button
                            onClick={() => handleEditDecision(d)}
                            className="h-6 w-6 flex items-center justify-center text-neutral-400 hover:text-brand-600 hover:bg-brand-50 rounded cursor-pointer"
                            aria-label="Edit decision"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {d.rationale && (
                      <p className="text-xs text-neutral-600 mb-2 line-clamp-2">{d.rationale}</p>
                    )}
                    {d.outcome && (
                      <div className="mb-2 p-2 rounded bg-success-50/50 border-l-2 border-success-300">
                        <p className="text-2xs font-medium text-success-700 uppercase tracking-wider mb-0.5">Outcome</p>
                        <p className="text-xs text-neutral-700 line-clamp-2">{d.outcome}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap text-2xs">
                      <span className={`px-1.5 py-0.5 rounded font-medium capitalize ${categoryColor[d.category]}`}>
                        {d.category}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded font-medium ${
                        d.impact === 'high' ? 'bg-danger-50 text-danger-600' :
                        d.impact === 'medium' ? 'bg-warning-50 text-warning-600' :
                        'bg-neutral-100 text-neutral-500'
                      }`}>
                        {d.impact} impact
                      </span>
                      {d.author && (
                        <span className="flex items-center gap-1 text-neutral-400 ml-auto">
                          <Avatar name={d.author.name} size="xs" />
                          <span>{d.author.name}</span>
                          <span>·</span>
                          <span>{dateLabel(d.createdAt)}</span>
                        </span>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Decision form */}
      <DecisionFormModal
        open={decisionOpen}
        onClose={() => {
          setDecisionOpen(false)
          setEditing(null)
        }}
        existing={editing}
        onSubmit={async (payload) => {
          if (editing) await updateDecision(editing.id, payload)
          else await createDecision(payload)
        }}
      />
    </div>
  )
}
