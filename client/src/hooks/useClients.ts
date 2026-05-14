import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// Maps the server Client model to the UI's lightweight shape.
// Falls back to demo rows when the backend is unreachable so the page
// is always reviewable.

export interface ClientListItem {
  id: string
  name: string
  industry: string
  contactName: string
  contactEmail: string
  contactPhone: string
  status: 'active' | 'onboarding' | 'churned' | 'prospect'
  mrr: number
  healthScore: number
  activeProjects: number
  lastInteraction: string
}

interface ServerClient {
  id: string
  company: string
  contactName: string
  email: string
  phone?: string | null
  vertical?: string | null
  status: string
  contractValue?: number | null
  healthScore?: number | null
  updatedAt?: string
  _count?: { projects: number; invoices: number }
}

const FALLBACK: ClientListItem[] = [
  { id: '1', name: 'Bella Cucina', industry: 'Restaurant & Hospitality', contactName: 'Marco Rossi', contactEmail: 'marco@bellacucina.com', contactPhone: '+1 555-0101', status: 'active', mrr: 6000, healthScore: 92, activeProjects: 2, lastInteraction: '2 hours ago' },
  { id: '2', name: 'CareFirst Health', industry: 'Healthcare', contactName: 'Dr. Sarah Chen', contactEmail: 'sarah@carefirst.com', contactPhone: '+1 555-0102', status: 'active', mrr: 8000, healthScore: 78, activeProjects: 1, lastInteraction: '1 day ago' },
  { id: '3', name: 'Urban Threads', industry: 'Fashion & Retail', contactName: 'Aisha Williams', contactEmail: 'aisha@urbanthreads.co', contactPhone: '+1 555-0103', status: 'onboarding', mrr: 4500, healthScore: 85, activeProjects: 1, lastInteraction: '3 hours ago' },
  { id: '4', name: 'DataFlow Inc', industry: 'SaaS & Technology', contactName: 'Jake Morrison', contactEmail: 'jake@dataflow.io', contactPhone: '+1 555-0104', status: 'active', mrr: 12000, healthScore: 65, activeProjects: 3, lastInteraction: '5 days ago' },
  { id: '5', name: 'FitTrack', industry: 'Health & Fitness', contactName: 'Nina Patel', contactEmail: 'nina@fittrack.app', contactPhone: '+1 555-0105', status: 'prospect', mrr: 0, healthScore: 0, activeProjects: 0, lastInteraction: 'Never' },
  { id: '6', name: 'Swift Logistics', industry: 'Supply Chain', contactName: 'Robert Kim', contactEmail: 'robert@swiftlogistics.com', contactPhone: '+1 555-0106', status: 'active', mrr: 9200, healthScore: 88, activeProjects: 2, lastInteraction: '6 hours ago' },
]

function relativeTime(iso?: string): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function mapStatus(s: string): ClientListItem['status'] {
  const v = s.toLowerCase()
  if (v === 'active' || v === 'onboarding' || v === 'churned' || v === 'prospect') return v
  return 'active'
}

function mapClient(c: ServerClient): ClientListItem {
  return {
    id: c.id,
    name: c.company,
    industry: c.vertical || '—',
    contactName: c.contactName,
    contactEmail: c.email,
    contactPhone: c.phone || '—',
    status: mapStatus(c.status),
    // MRR is not on the base Client model; derive from contractValue / 12 as
    // a rough annualized proxy until a real MRR field exists.
    mrr: c.contractValue ? Math.round(c.contractValue / 12) : 0,
    healthScore: c.healthScore ?? 0,
    activeProjects: c._count?.projects ?? 0,
    lastInteraction: relativeTime(c.updatedAt),
  }
}

export function useClients() {
  const [clients, setClients] = useState<ClientListItem[]>(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get<{ data: ServerClient[] }>('/clients')
        if (cancelled) return
        setClients(res.data.map(mapClient))
        setUsingFallback(false)
      } catch (err) {
        if (!cancelled) setUsingFallback(err instanceof ApiError && err.status === 0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { clients, loading, usingFallback }
}
