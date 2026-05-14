import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Risk register hook — maps server risks (projectId + likelihood/impact)
// into the flat UI shape the RiskRegisterPage already renders.
// The UI has its own "severity" label that we derive from riskScore:
//   riskScore 1–2 → low · 3–4 → medium · 6 → high · 9 → critical
// Server uses `likelihood` as low/medium/high; the existing UI
// enum (very-likely/likely/possible/unlikely) is mapped 1:1 onto
// that tri-state when we convert.
// ───────────────────────────────────────────

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low'
export type RiskLikelihoodUi = 'very-likely' | 'likely' | 'possible' | 'unlikely'
export type RiskStatusUi = 'open' | 'mitigating' | 'resolved' | 'accepted'

export interface RiskItem {
  id: string
  title: string
  description: string
  category: string
  severity: RiskSeverity
  likelihood: RiskLikelihoodUi
  status: RiskStatusUi
  owner: string
  mitigation: string
  dateIdentified: string
  projectId: string
  projectName: string
}

interface ServerRisk {
  id: string
  projectId: string
  title: string
  category: string
  likelihood: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  riskScore: number
  mitigation: string | null
  ownerId: string | null
  status: 'open' | 'mitigated' | 'accepted' | 'closed'
  createdAt: string
  owner: { id: string; name: string; avatar: string | null } | null
  project: { id: string; name: string } | null
}

const FALLBACK: RiskItem[] = [
  { id: 'r1', title: 'Key developer single point of failure', description: 'Sarah Chen is the sole expert on CareFirst portal architecture.', category: 'operational', severity: 'high', likelihood: 'possible', status: 'mitigating', owner: 'Noman Ali', mitigation: 'Knowledge transfer sessions scheduled. Documenting architecture.', dateIdentified: 'Mar 15, 2026', projectId: '1', projectName: 'CareFirst Portal' },
  { id: 'r2', title: 'DataFlow contract renewal uncertainty', description: 'Largest client showing declining engagement. Contract expires June 2026.', category: 'financial', severity: 'critical', likelihood: 'likely', status: 'open', owner: 'Zara Ahmed', mitigation: 'Schedule executive check-in. Prepare retention package.', dateIdentified: 'Apr 1, 2026', projectId: '3', projectName: 'DataFlow Dashboard' },
  { id: 'r3', title: 'Design team capacity bottleneck', description: 'Single designer handling all projects. Pipeline shows 120% utilization.', category: 'operational', severity: 'high', likelihood: 'very-likely', status: 'mitigating', owner: 'Hira Malik', mitigation: 'Hiring freelance designer. Prioritizing briefs.', dateIdentified: 'Mar 20, 2026', projectId: '2', projectName: 'Bella Cucina Rebrand' },
]

function mapSeverity(score: number): RiskSeverity {
  if (score >= 9) return 'critical'
  if (score >= 6) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}

function mapLikelihood(l: string, score: number): RiskLikelihoodUi {
  // Blend likelihood w/ score to project onto the 4-level UI enum.
  if (l === 'high' && score >= 6) return 'very-likely'
  if (l === 'high') return 'likely'
  if (l === 'medium') return 'possible'
  return 'unlikely'
}

function mapStatus(s: string): RiskStatusUi {
  if (s === 'mitigated') return 'resolved'
  if (s === 'closed') return 'resolved'
  if (s === 'accepted') return 'accepted'
  // 'open' — but we also split "open" into mitigating if there's a plan.
  return 'open'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function mapRisk(r: ServerRisk): RiskItem {
  return {
    id: r.id,
    title: r.title,
    description: r.mitigation ? '' : '', // schema has no description; we surface mitigation in its own block
    category: r.category,
    severity: mapSeverity(r.riskScore),
    likelihood: mapLikelihood(r.likelihood, r.riskScore),
    status: r.mitigation && r.status === 'open' ? 'mitigating' : mapStatus(r.status),
    owner: r.owner?.name ?? '—',
    mitigation: r.mitigation ?? 'No mitigation plan documented',
    dateIdentified: formatDate(r.createdAt),
    projectId: r.projectId,
    projectName: r.project?.name ?? 'Unknown project',
  }
}

export function useRisks(projectId?: string) {
  const [risks, setRisks] = useState<RiskItem[]>(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const load = useCallback(async () => {
    try {
      const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
      const res = await api.get<{ risks: ServerRisk[] }>(`/risks${q}`)
      setRisks(res.risks.map(mapRisk))
      setUsingFallback(false)
    } catch (err) {
      setUsingFallback(err instanceof ApiError && err.status === 0)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  return { risks, loading, usingFallback, refresh: load }
}
