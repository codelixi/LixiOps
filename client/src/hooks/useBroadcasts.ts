import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { useSocketEvent } from './useSocket'

// ───────────────────────────────────────────
// Broadcasts hook — list / create / pin / read / ack with realtime
// refresh on author acks (so authors see ack rate climb live).
// ───────────────────────────────────────────

export type BroadcastType = 'announcement' | 'urgent' | 'update'
export type RecipientType = 'all' | 'department' | 'individual'

export interface BroadcastAuthor {
  id: string
  name: string
  avatar: string | null
  role: string
}

export interface MyBroadcastReceipt {
  read: boolean
  acknowledged: boolean
  readAt: string | null
  acknowledgedAt: string | null
}

export interface Broadcast {
  id: string
  authorId: string
  author: BroadcastAuthor
  type: BroadcastType
  message: string
  recipientType: RecipientType
  recipientId: string | null
  isPinned: boolean
  requiresAck: boolean
  createdAt: string
  totalRecipients: number
  readCount: number
  ackCount: number
  myReceipt: MyBroadcastReceipt | null
}

const now = () => new Date().toISOString()

const FALLBACK: Broadcast[] = [
  {
    id: 'b1', authorId: 'u1',
    author: { id: 'u1', name: 'Noman Ali', avatar: null, role: 'CEO' },
    type: 'announcement', message: 'Q2 OKR planning session — Monday Apr 14 at 10 AM. Please review last quarter and bring proposed objectives.',
    recipientType: 'all', recipientId: null,
    isPinned: true, requiresAck: true, createdAt: now(),
    totalRecipients: 10, readCount: 8, ackCount: 5,
    myReceipt: { read: true, acknowledged: false, readAt: now(), acknowledgedAt: null },
  },
  {
    id: 'b2', authorId: 'u4',
    author: { id: 'u4', name: 'Emily Torres', avatar: null, role: 'MANAGER' },
    type: 'urgent', message: 'DataFlow Inc SLA at risk — all hands on deck, prioritize any open DataFlow items today.',
    recipientType: 'department', recipientId: 'd-ops',
    isPinned: false, requiresAck: true, createdAt: new Date(Date.now() - 6 * 3600_000).toISOString(),
    totalRecipients: 3, readCount: 3, ackCount: 2,
    myReceipt: { read: true, acknowledged: true, readAt: now(), acknowledgedAt: now() },
  },
  {
    id: 'b3', authorId: 'u9',
    author: { id: 'u9', name: 'Hira Malik', avatar: null, role: 'MANAGER' },
    type: 'update', message: '2026 leave policy updated — remote work days increased to 3/week. Full doc in Knowledge Base.',
    recipientType: 'all', recipientId: null,
    isPinned: false, requiresAck: false, createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    totalRecipients: 10, readCount: 9, ackCount: 0,
    myReceipt: { read: false, acknowledged: false, readAt: null, acknowledgedAt: null },
  },
]

export function useBroadcasts() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ broadcasts: Broadcast[] }>('/broadcasts')
      setBroadcasts(res.broadcasts)
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

  // Real-time refresh when someone acks a broadcast you authored
  useSocketEvent('broadcast:ack', () => {
    void load()
  })

  const createBroadcast = useCallback(
    async (payload: {
      type: BroadcastType
      message: string
      recipientType: RecipientType
      recipientId?: string
      isPinned?: boolean
      requiresAck?: boolean
    }) => {
      await api.post<unknown>('/broadcasts', payload)
      await load()
    },
    [load],
  )

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic
      setBroadcasts((prev) =>
        prev.map((b) =>
          b.id === id && b.myReceipt && !b.myReceipt.read
            ? { ...b, myReceipt: { ...b.myReceipt, read: true, readAt: now() }, readCount: b.readCount + 1 }
            : b,
        ),
      )
      try {
        await api.post<unknown>(`/broadcasts/${id}/read`, {})
      } catch {
        await load()
      }
    },
    [load],
  )

  const acknowledge = useCallback(
    async (id: string) => {
      await api.post<unknown>(`/broadcasts/${id}/ack`, {})
      await load()
    },
    [load],
  )

  const togglePin = useCallback(
    async (id: string, isPinned: boolean) => {
      setBroadcasts((prev) => prev.map((b) => (b.id === id ? { ...b, isPinned } : b)))
      try {
        await api.patch<unknown>(`/broadcasts/${id}`, { isPinned })
        await load()
      } catch {
        await load()
      }
    },
    [load],
  )

  const deleteBroadcast = useCallback(
    async (id: string) => {
      await api.del<unknown>(`/broadcasts/${id}`)
      await load()
    },
    [load],
  )

  return { broadcasts, loading, usingFallback, refresh: load, createBroadcast, markRead, acknowledge, togglePin, deleteBroadcast }
}
