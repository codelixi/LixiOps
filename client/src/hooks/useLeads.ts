import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import type { Lead, LeadStage } from '@/pages/sales/SalesPipelinePage'

// ───────────────────────────────────────────
// Leads hook — fetches the pipeline from /api/v1/leads
// Maps the server shape into the flat `Lead` shape the pipeline
// page already expects. Provides `refresh()` for use after
// mutations (create lead, convert deal, etc).
// ───────────────────────────────────────────

interface ServerLead {
  id: string
  company: string
  contactName: string
  email: string | null
  phone: string | null
  stage: LeadStage
  value: number
  agreedValue: number | null
  aiScore?: number | null
  convertedProjectId: string | null
  convertedClientId: string | null
  closedLostReason: string | null
  lastActivityAt: string | null
  rep: { id: string; name: string; email: string; avatar: string | null } | null
}

const FALLBACK: Lead[] = [
  { id: '1', company: 'TechStart Inc', contactName: 'John Miller', email: 'john@techstart.io', stage: 'PROSPECT', value: 8000, aiScore: 45, rep: { id: 'u1', name: 'Maria Garcia' }, lastActivityAt: '2d ago' },
  { id: '2', company: 'GreenLeaf Co', contactName: 'Emma Davis', email: 'emma@greenleaf.co', stage: 'PROSPECT', value: 12000, aiScore: 32, rep: { id: 'u1', name: 'Maria Garcia' }, lastActivityAt: '5d ago' },
  { id: '3', company: 'Swift Logistics', contactName: 'Tom Chen', email: 'tom@swift.com', stage: 'CONTACTED', value: 15000, aiScore: 58, rep: { id: 'u2', name: 'Sarah Chen' }, lastActivityAt: '1d ago' },
  { id: '4', company: 'Bella Cucina', contactName: 'Marco Rossi', email: 'marco@bellacucina.com', stage: 'PROPOSAL_SENT', value: 24000, aiScore: 78, rep: { id: 'u1', name: 'Maria Garcia' }, lastActivityAt: '3h ago' },
  { id: '5', company: 'CareFirst', contactName: 'Dr. Lisa Park', email: 'lisa@carefirst.org', stage: 'PROPOSAL_SENT', value: 32000, aiScore: 82, rep: { id: 'u2', name: 'Sarah Chen' }, lastActivityAt: '1d ago' },
  { id: '6', company: 'Urban Threads', contactName: 'Alex Kim', email: 'alex@urbanthreads.co', stage: 'NEGOTIATION', value: 18000, aiScore: 88, rep: { id: 'u1', name: 'Maria Garcia' }, lastActivityAt: '4h ago' },
  { id: '7', company: 'DataFlow Inc', contactName: 'Sarah Lin', email: 'sarah@dataflow.io', stage: 'CLOSED_WON', value: 32000, agreedValue: 32000, aiScore: 100, rep: { id: 'u2', name: 'Sarah Chen' }, lastActivityAt: '1h ago' },
  { id: '8', company: 'Quick Retail', contactName: 'Mike Patel', email: 'mike@quickretail.com', stage: 'CLOSED_LOST', value: 22000, aiScore: 40, rep: { id: 'u1', name: 'Maria Garcia' }, lastActivityAt: '3d ago', closedLostReason: 'Budget mismatch' },
]

function timeAgo(iso: string | null): string {
  if (!iso) return 'recently'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function mapLead(l: ServerLead): Lead {
  return {
    id: l.id,
    company: l.company,
    contactName: l.contactName,
    email: l.email ?? undefined,
    phone: l.phone ?? undefined,
    stage: l.stage,
    value: l.value,
    agreedValue: l.agreedValue ?? undefined,
    aiScore: l.aiScore ?? undefined,
    rep: l.rep ? { id: l.rep.id, name: l.rep.name } : undefined,
    lastActivityAt: timeAgo(l.lastActivityAt),
    convertedProjectId: l.convertedProjectId ?? undefined,
    convertedClientId: l.convertedClientId ?? undefined,
    closedLostReason: l.closedLostReason ?? undefined,
  }
}

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ leads: ServerLead[] }>('/leads')
      setLeads(res.leads.map(mapLead))
      setUsingFallback(false)
    } catch (err) {
      setUsingFallback(err instanceof ApiError && err.status === 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { leads, loading, usingFallback, refresh: load }
}
