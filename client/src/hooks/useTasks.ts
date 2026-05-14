import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Tasks hook — powers the Sprint Board and per-project task lists.
// Maps the server Task shape (status: todo/in_progress/in_review/done)
// into the flat UI shape and exposes mutation helpers.
// ───────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low'

export interface TaskItem {
  id: string
  title: string
  description?: string
  project: string
  projectId: string | null
  assignee: string
  assigneeId: string | null
  priority: TaskPriority
  status: TaskStatus
  hours: { estimated: number; actual: number }
  dueDate: string
  blocked: boolean
}

interface ServerTask {
  id: string
  title: string
  description: string | null
  projectId: string | null
  assigneeId: string | null
  priority: string
  status: string
  estimatedHours: number | null
  actualHours: number | null
  dueDate: string | null
  blockedBy: string | null
  completedAt: string | null
  createdAt: string
  assignee: { id: string; name: string; avatar: string | null; email: string } | null
  creator: { id: string; name: string; avatar: string | null } | null
  project: { id: string; name: string } | null
}

export interface TasksFilters {
  projectId?: string
  assigneeId?: string
  status?: TaskStatus
  sprintId?: string
  mine?: boolean
}

const FALLBACK: TaskItem[] = [
  { id: 't1', title: 'Implement payment webhook handler', description: '', project: 'RestaurantOS', projectId: null, assignee: 'Alex Kim', assigneeId: null, priority: 'high', status: 'todo', hours: { estimated: 6, actual: 0 }, dueDate: 'Apr 10', blocked: false },
  { id: 't3', title: 'API rate limiting middleware', description: '', project: 'E-Commerce v3', projectId: null, assignee: 'Sarah Chen', assigneeId: null, priority: 'high', status: 'in_progress', hours: { estimated: 8, actual: 5 }, dueDate: 'Apr 9', blocked: false },
  { id: 't5', title: 'Fix invoice PDF generation', description: '', project: 'RestaurantOS', projectId: null, assignee: 'David Park', assigneeId: null, priority: 'critical', status: 'in_progress', hours: { estimated: 4, actual: 6 }, dueDate: 'Apr 8', blocked: true },
  { id: 't6', title: 'User authentication flow', description: '', project: 'BookingApp', projectId: null, assignee: 'Sarah Chen', assigneeId: null, priority: 'high', status: 'in_review', hours: { estimated: 10, actual: 9 }, dueDate: 'Apr 7', blocked: false },
  { id: 't7', title: 'Database migration scripts', description: '', project: 'E-Commerce v3', projectId: null, assignee: 'Alex Kim', assigneeId: null, priority: 'medium', status: 'done', hours: { estimated: 5, actual: 4 }, dueDate: 'Apr 6', blocked: false },
]

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function asPriority(p: string): TaskPriority {
  if (p === 'critical' || p === 'high' || p === 'medium' || p === 'low') return p
  return 'medium'
}

function asStatus(s: string): TaskStatus {
  if (s === 'todo' || s === 'in_progress' || s === 'in_review' || s === 'done') return s
  return 'todo'
}

function mapTask(t: ServerTask): TaskItem {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? '',
    project: t.project?.name ?? 'Unassigned',
    projectId: t.projectId,
    assignee: t.assignee?.name ?? 'Unassigned',
    assigneeId: t.assigneeId,
    priority: asPriority(t.priority),
    status: asStatus(t.status),
    hours: {
      estimated: t.estimatedHours ?? 0,
      actual: t.actualHours ?? 0,
    },
    dueDate: formatDate(t.dueDate),
    blocked: !!t.blockedBy,
  }
}

function toQuery(f: TasksFilters): string {
  const params = new URLSearchParams()
  if (f.projectId) params.set('projectId', f.projectId)
  if (f.assigneeId) params.set('assigneeId', f.assigneeId)
  if (f.status) params.set('status', f.status)
  if (f.sprintId) params.set('sprintId', f.sprintId)
  if (f.mine) params.set('mine', 'true')
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function useTasks(filters: TasksFilters = {}) {
  const [tasks, setTasks] = useState<TaskItem[]>(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  // serialize the filter bag so the effect only re-runs when values change
  const key = toQuery(filters)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ tasks: ServerTask[] }>(`/tasks${key}`)
      setTasks(res.tasks.map(mapTask))
      setUsingFallback(false)
    } catch (err) {
      setUsingFallback(err instanceof ApiError && err.status === 0)
    } finally {
      setLoading(false)
    }
  }, [key])

  useEffect(() => {
    load()
  }, [load])

  const updateStatus = useCallback(
    async (id: string, status: TaskStatus) => {
      await api.patch<unknown>(`/tasks/${id}`, { status })
      await load()
    },
    [load],
  )

  return { tasks, loading, usingFallback, refresh: load, updateStatus }
}
