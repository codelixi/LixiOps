import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useSocketEvent } from './useSocket'

export interface NotificationItem {
  id: string
  userId: string
  type: string // 'invoice_overdue' | 'lead_stale' | 'mention' | ...
  title: string
  message: string | null
  link: string | null
  isRead: boolean
  channel: string
  createdAt: string
}

interface NotificationsResponse {
  notifications: NotificationItem[]
  unreadCount: number
}

const FALLBACK: NotificationItem[] = [
  { id: 'demo-1', userId: 'me', type: 'invoice_overdue', title: 'Invoice INV-2026-001 is 3d overdue', message: 'Bella Cucina — send a reminder or call.', link: '/invoices/1', isRead: false, channel: 'in_app', createdAt: new Date(Date.now() - 5 * 60_000).toISOString() },
  { id: 'demo-2', userId: 'me', type: 'lead_stale', title: 'DataFlow Inc has been quiet for 9d', message: 'Stage: NEGOTIATION. Move it forward or mark Closed Lost.', link: '/sales', isRead: false, channel: 'in_app', createdAt: new Date(Date.now() - 30 * 60_000).toISOString() },
  { id: 'demo-3', userId: 'me', type: 'mention', title: 'Emily Torres mentioned you', message: 'Can you review the scope before EOD?', link: '/projects/1', isRead: true, channel: 'in_app', createdAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString() },
]

export function useNotifications(pollMs = 45_000) {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<NotificationsResponse>('/notifications?limit=50')
      setItems(res.notifications)
      setUnreadCount(res.unreadCount)
      setUsingFallback(false)
    } catch {
      // Backend not wired or unreachable — use local demo data so UI works.
      setItems(FALLBACK)
      setUnreadCount(FALLBACK.filter((n) => !n.isRead).length)
      setUsingFallback(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    if (pollMs > 0) {
      const h = setInterval(() => void load(), pollMs)
      return () => clearInterval(h)
    }
  }, [load, pollMs])

  // Realtime push — refetch immediately on server-pushed notification.
  // Falls back to the 45s polling above when the socket is disconnected.
  useSocketEvent('notification:new', () => {
    void load()
  })

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    if (!usingFallback) {
      try {
        await api.post(`/notifications/${id}/read`)
      } catch {
        /* optimistic already applied */
      }
    }
  }, [usingFallback])

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
    if (!usingFallback) {
      try {
        await api.post('/notifications/read-all')
      } catch {
        /* ignore */
      }
    }
  }, [usingFallback])

  const dismiss = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id))
    if (!usingFallback) {
      try {
        await api.del(`/notifications/${id}`)
      } catch {
        /* ignore */
      }
    }
  }, [usingFallback])

  return { items, unreadCount, loading, usingFallback, markRead, markAllRead, dismiss, refresh: load }
}
