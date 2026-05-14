import { useEffect } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket'

// ───────────────────────────────────────────
// Realtime hooks:
//   • useSocketLifecycle  → mount once at app root; manages connect/disconnect
//                            based on auth state.
//   • useSocketEvent      → subscribe a handler to a named server event.
//   • useEntitySubscription → join/leave the entity room for a detail page.
// ───────────────────────────────────────────

/** Mount once at app root. Connects when authenticated, disconnects on logout. */
export function useSocketLifecycle(): void {
  const token = useAuthStore((s) => s.token)
  const isAuthed = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    if (isAuthed && token) {
      connectSocket(token)
    } else {
      disconnectSocket()
    }
    return () => {
      // Don't disconnect on unmount of root — only on auth flip.
    }
  }, [isAuthed, token])
}

/** Subscribe a stable handler to a server event. Re-binds when handler changes. */
export function useSocketEvent(event: string, handler: (...args: unknown[]) => void): void {
  useEffect(() => {
    const s = getSocket()
    if (!s) return
    const onConnect = () => {
      // No-op; just ensures binding once connected.
    }
    s.on('connect', onConnect)
    s.on(event, handler)
    return () => {
      s.off(event, handler)
      s.off('connect', onConnect)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, handler])
}

/** Join an entity room while the calling component is mounted. */
export function useEntitySubscription(entityType: string | undefined, entityId: string | undefined): void {
  useEffect(() => {
    if (!entityType || !entityId) return
    const s = getSocket()
    if (!s) return

    const subscribe = () => s.emit('subscribe:entity', { entityType, entityId })
    if (s.connected) subscribe()
    s.on('connect', subscribe)

    return () => {
      s.emit('unsubscribe:entity', { entityType, entityId })
      s.off('connect', subscribe)
    }
  }, [entityType, entityId])
}
