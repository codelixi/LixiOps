import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Comment, CommentEntity, CommentAuthor } from '@/components/comments/CommentsPanel'
import { useEntitySubscription, useSocketEvent } from './useSocket'

// ───────────────────────────────────────────
// Comments hook — wraps the polymorphic /comments API.
// The server returns comments grouped at the root level with
// replies[] nested one layer deep, which matches exactly what
// CommentsPanel already expects, so the mapping is thin.
// ───────────────────────────────────────────

interface ServerAuthor {
  id: string
  name: string
  email?: string | null
  avatar?: string | null
  role?: string | null
}

interface ServerComment {
  id: string
  body: string
  mentions?: string[] | null
  parentId?: string | null
  editedAt?: string | null
  createdAt: string
  author: ServerAuthor | null
  replies?: ServerComment[]
}

function mapAuthor(a: ServerAuthor | null): CommentAuthor {
  if (!a) return { id: 'unknown', name: 'Unknown user' }
  return {
    id: a.id,
    name: a.name,
    email: a.email ?? undefined,
    avatar: a.avatar ?? undefined,
    role: a.role ?? undefined,
  }
}

function mapComment(c: ServerComment): Comment {
  return {
    id: c.id,
    body: c.body,
    mentions: c.mentions ?? [],
    parentId: c.parentId ?? null,
    editedAt: c.editedAt ?? null,
    createdAt: c.createdAt,
    author: mapAuthor(c.author),
    replies: (c.replies ?? []).map(mapComment),
  }
}

export function useComments(entityType: CommentEntity, entityId: string | undefined) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  const load = useCallback(async () => {
    if (!entityId) return
    try {
      const res = await api.get<{ comments: ServerComment[] }>(
        `/comments?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`,
      )
      // Flatten: CommentsPanel reconstructs its own tree from parentId,
      // so we pass root + replies as a flat list.
      const flat: Comment[] = []
      res.comments.forEach((c) => {
        const mapped = mapComment(c)
        const { replies, ...root } = mapped
        flat.push({ ...root, replies })
        ;(replies ?? []).forEach((r) => flat.push(r))
      })
      setComments(flat)
      setUnavailable(false)
    } catch {
      setComments([])
      setUnavailable(true)
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => {
    load()
  }, [load])

  // Realtime: join the entity room and refresh whenever any client edits the thread.
  useEntitySubscription(entityType, entityId)
  useSocketEvent('comment:new', () => {
    void load()
  })
  useSocketEvent('comment:updated', () => {
    void load()
  })
  useSocketEvent('comment:deleted', () => {
    void load()
  })

  const create = useCallback(
    async (body: string, parentId?: string) => {
      if (!entityId) return
      await api.post<unknown>('/comments', { entityType, entityId, body, parentId })
      await load()
    },
    [entityType, entityId, load],
  )

  const edit = useCallback(
    async (id: string, body: string) => {
      await api.patch<unknown>(`/comments/${id}`, { body })
      await load()
    },
    [load],
  )

  const remove = useCallback(
    async (id: string) => {
      await api.del<unknown>(`/comments/${id}`)
      await load()
    },
    [load],
  )

  return { comments, loading, unavailable, create, edit, remove, refresh: load }
}
