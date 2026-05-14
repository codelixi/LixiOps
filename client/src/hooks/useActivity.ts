import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Activity feed hook — pulls the unified server stream
// (lead activities + comments + task transitions + invoices)
// and exposes a refresh helper. Falls back to demo data offline.
// ───────────────────────────────────────────

export type ActivityCategory = 'lead' | 'comment' | 'task' | 'invoice' | 'project'

export interface ActivityEvent {
  id: string
  category: ActivityCategory
  user: string | null
  userId: string | null
  action: string
  target: string
  detail?: string
  entityType?: string
  entityId?: string
  timestamp: string
}

const FALLBACK: ActivityEvent[] = [
  { id: 'a1', category: 'task', user: 'Sarah Chen', userId: null, action: 'completed task', target: 'Implement payment gateway', detail: 'CareFirst Patient Portal', timestamp: new Date(Date.now() - 5 * 60_000).toISOString() },
  { id: 'a2', category: 'comment', user: 'Emily Torres', userId: null, action: 'commented on', target: 'PROJECT', detail: 'Let\'s prioritize the auth module this week', timestamp: new Date(Date.now() - 45 * 60_000).toISOString() },
  { id: 'a3', category: 'invoice', user: 'Noman Ali', userId: null, action: 'sent invoice', target: 'INV-2026-002', detail: 'CareFirst Health — $8,000', timestamp: new Date(Date.now() - 90 * 60_000).toISOString() },
  { id: 'a4', category: 'lead', user: 'Zara Ahmed', userId: null, action: 'logged call', target: 'GreenTech Solutions', detail: 'Discovery call — interested in custom build', timestamp: new Date(Date.now() - 4 * 3600_000).toISOString() },
  { id: 'a5', category: 'task', user: 'Alex Kim', userId: null, action: 'created task', target: 'Database migration scripts', detail: 'E-Commerce v3', timestamp: new Date(Date.now() - 6 * 3600_000).toISOString() },
]

export function useActivity() {
  const [events, setEvents] = useState<ActivityEvent[]>(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ activity: ActivityEvent[] }>('/activity')
      setEvents(res.activity)
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

  return { events, loading, usingFallback, refresh: load }
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (isNaN(then)) return ''
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
