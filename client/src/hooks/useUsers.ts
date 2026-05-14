import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { CommentAuthor } from '@/components/comments/CommentsPanel'
import { mockUsers } from '@/lib/mockUsers'

// ───────────────────────────────────────────
// Users directory hook — powers @mention autocomplete,
// assignee pickers, and team rosters. Falls back to the
// mock directory when the backend is unreachable so the
// UI stays functional in offline/demo mode.
// ───────────────────────────────────────────

interface ServerUser {
  id: string
  name: string
  email: string | null
  avatar: string | null
  role: string | null
  department: { id: string; name: string } | null
}

function mapUser(u: ServerUser): CommentAuthor {
  return {
    id: u.id,
    name: u.name,
    email: u.email ?? undefined,
    avatar: u.avatar ?? undefined,
    role: u.role ?? undefined,
  }
}

export function useUsers() {
  const [users, setUsers] = useState<CommentAuthor[]>(mockUsers)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get<{ users: ServerUser[] }>('/users')
        if (cancelled) return
        setUsers(res.users.map(mapUser))
        setUsingFallback(false)
      } catch {
        if (!cancelled) setUsingFallback(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { users, loading, usingFallback }
}
