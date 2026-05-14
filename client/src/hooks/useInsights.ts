import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// AI Engine — Layer-2 Insights hook. Pulls heuristic synthesis from
// the server, with FALLBACK demo content so the page is reviewable
// offline. The server caches results for 5 minutes; pass `refresh=true`
// to force a regeneration.
// ───────────────────────────────────────────

export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low'
export type InsightType =
  | 'churn_risk'
  | 'stuck_lead'
  | 'cashflow_window'
  | 'at_risk_okr'
  | 'rule_suggestion'
  | 'capacity_warning'
  | 'velocity_change'

export interface InsightEvidence {
  entityType: string
  entityId: string
  label: string
}

export interface SuggestedAction {
  label: string
  route?: string
  action?: { kind: 'create_rule'; trigger: string; actionType: string; config: Record<string, unknown> }
}

export interface Insight {
  id: string
  type: InsightType
  severity: InsightSeverity
  title: string
  message: string
  metric?: { value: string; trend?: number }
  evidence?: InsightEvidence[]
  suggestedAction?: SuggestedAction
  confidence: number
  generatedAt: string
}

const FALLBACK: Insight[] = [
  {
    id: 'churn:c6',
    type: 'churn_risk',
    severity: 'critical',
    title: 'DataFlow Inc shows churn signals',
    message: 'health 58 · NPS 5 · 5d quiet · 3 open risks. Worth a proactive check-in this week.',
    evidence: [{ entityType: 'client', entityId: 'c6', label: 'DataFlow Inc' }],
    suggestedAction: { label: 'Open client', route: '/clients/c6' },
    confidence: 1,
    generatedAt: new Date().toISOString(),
  },
  {
    id: 'cashflow:overdue',
    type: 'cashflow_window',
    severity: 'high',
    title: '$22,500 sitting overdue',
    message: '3 invoices past due. Reminders + payment-link nudges recover ~70% of this within 14 days.',
    metric: { value: '$22,500' },
    suggestedAction: { label: 'View invoices', route: '/invoicing' },
    confidence: 0.85,
    generatedAt: new Date().toISOString(),
  },
  {
    id: 'stuck:l9',
    type: 'stuck_lead',
    severity: 'high',
    title: 'GreenTech Solutions stuck in negotiation for 32d',
    message: 'Suggested next move: close or qualify out.',
    metric: { value: '$28,000' },
    evidence: [{ entityType: 'lead', entityId: 'l9', label: 'GreenTech Solutions · Sam Reed' }],
    suggestedAction: { label: 'Open pipeline', route: '/sales' },
    confidence: 0.85,
    generatedAt: new Date().toISOString(),
  },
  {
    id: 'okr:o1',
    type: 'at_risk_okr',
    severity: 'medium',
    title: 'Scale revenue to $100K MRR is 22pts behind pace',
    message: 'Quarter is 67% through, objective is at 45%. Company owns it.',
    metric: { value: '45%', trend: -22 },
    evidence: [{ entityType: 'okr', entityId: 'o1', label: 'Scale revenue to $100K MRR' }],
    suggestedAction: { label: 'Review OKRs', route: '/okrs' },
    confidence: 0.7,
    generatedAt: new Date().toISOString(),
  },
  {
    id: 'suggest:invoice_escalate',
    type: 'rule_suggestion',
    severity: 'medium',
    title: 'Suggested rule: escalate stuck invoices to CEO',
    message: '4 invoices were overdue ~21d before payment. An ESCALATE rule at day 7 would have flagged them earlier.',
    confidence: 0.8,
    suggestedAction: {
      label: 'Create rule',
      route: '/ai-engine',
      action: { kind: 'create_rule', trigger: 'INVOICE_OVERDUE', actionType: 'ESCALATE', config: { escalateTo: 'CEO', thresholdDays: 7 } },
    },
    generatedAt: new Date().toISOString(),
  },
  {
    id: 'cashflow:30d',
    type: 'cashflow_window',
    severity: 'low',
    title: 'Cashflow window — next 30 days',
    message: '$47,200 expected from 6 invoices maturing.',
    metric: { value: '$47,200' },
    confidence: 0.9,
    suggestedAction: { label: 'View invoices', route: '/invoicing' },
    generatedAt: new Date().toISOString(),
  },
]

interface Payload {
  insights: Insight[]
  generatedAt: string
  cached: boolean
}

export function useInsights() {
  const [insights, setInsights] = useState<Insight[]>(FALLBACK)
  const [generatedAt, setGeneratedAt] = useState<string>(new Date().toISOString())
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const load = useCallback(async (force = false) => {
    setLoading(true)
    try {
      const res = await api.get<Payload>(`/ai-engine/insights${force ? '?refresh=true' : ''}`)
      setInsights(res.insights)
      setGeneratedAt(res.generatedAt)
      setUsingFallback(false)
    } catch (err) {
      setUsingFallback(err instanceof ApiError && err.status === 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(false)
  }, [load])

  return { insights, generatedAt, loading, usingFallback, refresh: () => load(true) }
}
