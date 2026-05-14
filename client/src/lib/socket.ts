import { io as createSocket, Socket } from 'socket.io-client'

// ───────────────────────────────────────────
// Socket.io client singleton.
// Connect lifecycle is driven by the auth state via SocketProvider;
// callers should use the `useSocket()` hook instead of this directly.
// ───────────────────────────────────────────

// Derive the socket URL from the API URL. The socket server lives at the
// origin (httpServer), not under /api/v1, so we strip the path suffix.
function deriveSocketUrl(): string {
  const apiUrl = (import.meta as any).env?.VITE_API_URL as string | undefined
  if (!apiUrl) return window.location.origin
  try {
    const u = new URL(apiUrl, window.location.origin)
    return `${u.protocol}//${u.host}`
  } catch {
    return window.location.origin
  }
}

let socket: Socket | null = null

export function getSocket(): Socket | null {
  return socket
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket
  if (socket) socket.disconnect()
  socket = createSocket(deriveSocketUrl(), {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['websocket', 'polling'],
  })
  if ((import.meta as any).env?.DEV) {
    socket.on('connect', () => console.log('[WS] connected', socket?.id))
    socket.on('connect_error', (err) => console.warn('[WS] connect_error', err.message))
    socket.on('disconnect', (reason) => console.log('[WS] disconnect', reason))
  }
  return socket
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
