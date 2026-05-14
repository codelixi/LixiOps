import type { Server as SocketServer } from 'socket.io'

// ───────────────────────────────────────────
// Realtime — thin wrapper around Socket.io for broadcasting
// cache-invalidation events. Senders don't ship payloads; clients
// just refetch on the matching event. Keeps the surface small.
//
// Rooms:
//   user:<userId>                — per-user notification stream
//   entity:<ENTITY_TYPE>:<id>    — comment/activity stream per entity
//   dashboard                    — global dashboard subscribers
// ───────────────────────────────────────────

let io: SocketServer | null = null

export function setRealtime(server: SocketServer): void {
  io = server
}

export function getRealtime(): SocketServer | null {
  return io
}

export function emitToUser(userId: string | null | undefined, event: string, payload?: unknown): void {
  if (!io || !userId) return
  io.to(`user:${userId}`).emit(event, payload ?? {})
}

export function emitToUsers(userIds: Array<string | null | undefined>, event: string, payload?: unknown): void {
  if (!io) return
  const rooms = userIds.filter((id): id is string => !!id).map((id) => `user:${id}`)
  if (rooms.length === 0) return
  io.to(rooms).emit(event, payload ?? {})
}

export function emitToEntity(entityType: string, entityId: string, event: string, payload?: unknown): void {
  if (!io || !entityType || !entityId) return
  io.to(`entity:${entityType}:${entityId}`).emit(event, payload ?? {})
}

export function broadcastDashboard(event: string, payload?: unknown): void {
  if (!io) return
  io.to('dashboard').emit(event, payload ?? {})
}
