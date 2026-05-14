import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles, AlertTriangle, AlertCircle, TrendingDown, DollarSign, Zap, Users, Target, RefreshCw, Loader2,
} from 'lucide-react'
import { Card, Badge, Button } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import type { Insight, InsightSeverity, InsightType, SuggestedAction } from '@/hooks/useInsights'

const severityStyles: Record<InsightSeverity, { bar: string; bg: string; text: string }> = {
  critical: { bar: 'bg-danger-500', bg: 'bg-danger-50', text: 'text-danger-700' },
  high: { bar: 'bg-warning-500', bg: 'bg-warning-50', text: 'text-warning-700' },
  medium: { bar: 'bg-info-500', bg: 'bg-info-50', text: 'text-info-700' },
  low: { bar: 'bg-neutral-300', bg: 'bg-neutral-50', text: 'text-neutral-600' },
}

const typeIcon: Record<InsightType, React.ReactNode> = {
  churn_risk: <AlertTriangle className="h-4 w-4" />,
  stuck_lead: <TrendingDown className="h-4 w-4" />,
  cashflow_window: <DollarSign className="h-4 w-4" />,
  at_risk_okr: <Target className="h-4 w-4" />,
  rule_suggestion: <Zap className="h-4 w-4" />,
  capacity_warning: <Users className="h-4 w-4" />,
  velocity_change: <AlertCircle className="h-4 w-4" />,
}

const typeLabel: Record<InsightType, string> = {
  churn_risk: 'Churn risk',
  stuck_lead: 'Stuck lead',
  cashflow_window: 'Cashflow',
  at_risk_okr: 'At-risk OKR',
  rule_suggestion: 'Suggested rule',
  capacity_warning: 'Capacity',
  velocity_change: 'Velocity shift',
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  return `${hr}h ago`
}

interface InsightsPanelProps {
  insights: Insight[]
  generatedAt: string
  loading: boolean
  refresh: () => void
  onCreateRule: (preset: { trigger: string; actionType: string; config: Record<string, unknown>; name: string }) => void
}

export function InsightsPanel({ insights, generatedAt, loading, refresh, onCreateRule }: InsightsPanelProps) {
  const navigate = useNavigate()
  const critical = insights.filter((i) => i.severity === 'critical')
  const high = insights.filter((i) => i.severity === 'high')
  const medium = insights.filter((i) => i.severity === 'medium')
  const low = insights.filter((i) => i.severity === 'low')

  const handleAction = (insight: Insight, action: SuggestedAction) => {
    if (action.action?.kind === 'create_rule') {
      onCreateRule({
        trigger: action.action.trigger,
        actionType: action.action.actionType,
        config: action.action.config,
        name: insight.title.replace(/^Suggested rule: ?/i, ''),
      })
      return
    }
    if (action.route) navigate(action.route)
  }

  const renderGroup = (group: Insight[], label: string, severity: InsightSeverity) => {
    if (group.length === 0) return null
    const sty = severityStyles[severity]
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${sty.bar}`} />
          <h3 className="text-2xs font-semibold text-neutral-600 uppercase tracking-wider">
            {label}
          </h3>
          <span className="text-2xs text-neutral-400">{group.length}</span>
        </div>
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
          {group.map((insight) => (
            <motion.div key={insight.id} variants={staggerItem}>
              <Card>
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${sty.bg} ${sty.text}`}>
                    {typeIcon[insight.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-sm font-semibold text-neutral-900">{insight.title}</h4>
                      <Badge variant="default">{typeLabel[insight.type]}</Badge>
                      <span className="text-2xs text-neutral-400">
                        confidence {Math.round(insight.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600">{insight.message}</p>
                    {insight.metric && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-base font-bold text-neutral-900">{insight.metric.value}</span>
                        {insight.metric.trend !== undefined && insight.metric.trend !== 0 && (
                          <span className={`text-2xs font-medium ${insight.metric.trend > 0 ? 'text-success-600' : 'text-danger-600'}`}>
                            {insight.metric.trend > 0 ? '+' : ''}
                            {insight.metric.trend}pts
                          </span>
                        )}
                      </div>
                    )}
                    {insight.evidence && insight.evidence.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {insight.evidence.map((e, i) => (
                          <span
                            key={i}
                            className="text-2xs px-2 py-0.5 bg-neutral-100 rounded-md font-mono text-neutral-600"
                          >
                            {e.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {insight.suggestedAction && (
                    <div className="flex-shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAction(insight, insight.suggestedAction!)}
                      >
                        {insight.suggestedAction.label}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Sparkles className="h-3.5 w-3.5 text-brand-500" />
          Heuristic synthesis over your live data ·{' '}
          <span className="font-medium text-neutral-700">{insights.length} insight{insights.length === 1 ? '' : 's'}</span>
          <span className="text-neutral-300">·</span>
          updated {formatRelative(generatedAt)}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={refresh}
          disabled={loading}
          icon={loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        >
          {loading ? 'Generating…' : 'Regenerate'}
        </Button>
      </div>

      {insights.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <Sparkles className="h-6 w-6 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">No insights right now — your business looks healthy.</p>
          </div>
        </Card>
      ) : (
        <>
          {renderGroup(critical, 'Critical', 'critical')}
          {renderGroup(high, 'High', 'high')}
          {renderGroup(medium, 'Medium', 'medium')}
          {renderGroup(low, 'For your awareness', 'low')}
        </>
      )}
    </div>
  )
}
