import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, CheckCircle2, Circle } from 'lucide-react'
import { Button, Badge, Card, Avatar, ProgressBar } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { CommentsPanel } from '@/components/comments/CommentsPanel'
import { mockCurrentUser } from '@/lib/mockUsers'
import { api, ApiError } from '@/lib/api'
import { useAuthStore } from '@/stores/useAuthStore'
import { useComments } from '@/hooks/useComments'
import { useUsers } from '@/hooks/useUsers'

// ───────────────────────────────────────────
// Server Project detail — see server/src/routes/projects.ts
// The UI expects: milestones, tasks (split by status), budget,
// and team. Team + spent are not yet in the schema; we surface
// placeholders so the page stays usable until the schema grows.
// ───────────────────────────────────────────

interface ServerMilestone {
  id: string
  title: string
  phase: string | null
  dueDate: string | null
  isComplete: boolean
  completedAt: string | null
  sortOrder: number
}

interface ServerTask {
  id: string
  title: string
  status: string
  updatedAt: string
}

interface ServerProjectDetail {
  id: string
  name: string
  health: string
  progress: number
  contractValue: number | null
  startDate: string | null
  goLiveDate: string | null
  client: { id: string; company: string; email: string; vertical: string | null } | null
  lead: { id: string; company: string; agreedValue: number | null; closedWonAt: string | null } | null
  milestones: ServerMilestone[]
  tasks: ServerTask[]
  invoices: Array<{ id: string; invoiceNumber: string; total: number; status: string }>
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string | null, fallback = 'TBD') {
  if (!iso) return fallback
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShortDate(iso: string | null, fallback = 'TBD') {
  if (!iso) return fallback
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const healthMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' }> = {
  ON_TRACK: { label: 'On Track', variant: 'success' },
  AT_RISK: { label: 'At Risk', variant: 'warning' },
  DELAYED: { label: 'Delayed', variant: 'danger' },
  COMPLETED: { label: 'Completed', variant: 'info' },
}

const FALLBACK: ServerProjectDetail = {
  id: 'demo',
  name: 'Bella Cucina Rebrand',
  health: 'ON_TRACK',
  progress: 72,
  contractValue: 25000,
  startDate: '2026-02-01',
  goLiveDate: '2026-04-30',
  client: { id: 'c1', company: 'Bella Cucina', email: 'marco@bellacucina.com', vertical: 'Restaurant' },
  lead: null,
  milestones: [
    { id: 'm1', title: 'Discovery & Research', phase: 'Discovery', dueDate: '2026-02-15', isComplete: true, completedAt: '2026-02-14', sortOrder: 0 },
    { id: 'm2', title: 'Logo Concepts', phase: 'Design', dueDate: '2026-03-01', isComplete: true, completedAt: '2026-03-01', sortOrder: 1 },
    { id: 'm3', title: 'Brand Guidelines', phase: 'Design', dueDate: '2026-04-01', isComplete: false, completedAt: null, sortOrder: 2 },
    { id: 'm4', title: 'Final Asset Delivery', phase: 'Delivery', dueDate: '2026-04-30', isComplete: false, completedAt: null, sortOrder: 3 },
  ],
  tasks: [],
  invoices: [],
}

export function ProjectDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ServerProjectDetail>(FALLBACK)
  const [usingFallback, setUsingFallback] = useState(false)
  const [loading, setLoading] = useState(true)
  const authUser = useAuthStore((s) => s.user)
  const commentsApi = useComments('PROJECT', project.id)
  const { users: mentionableUsers } = useUsers()

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get<{ project: ServerProjectDetail }>(`/projects/${id}`)
        if (cancelled) return
        setProject(res.project)
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
  }, [id])

  if (loading) return <div className="text-sm text-neutral-500">Loading project…</div>

  const budget = project.contractValue ?? 0
  const spent = Math.round(budget * (project.progress / 100))
  const budgetPct = budget > 0 ? Math.round((spent / budget) * 100) : 0

  // Task breakdown by status
  const tasksCompleted = project.tasks.filter((t) => t.status === 'done' || t.status === 'completed').length
  const tasksInProgress = project.tasks.filter((t) => t.status === 'in_progress' || t.status === 'in-progress').length
  const tasksTodo = project.tasks.filter((t) => t.status === 'todo' || t.status === 'to-do').length
  const tasksTotal = project.tasks.length

  const healthBadge = healthMap[project.health] || healthMap.ON_TRACK

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors mb-4 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">{project.name}</h1>
              <Badge variant={healthBadge.variant} dot>{healthBadge.label}</Badge>
              {usingFallback && (
                <span className="text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-neutral-500">
              {project.client && <span>{project.client.company}</span>}
              {project.client?.vertical && <><span>·</span><span>{project.client.vertical}</span></>}
              <span>·</span>
              <span>{formatDate(project.startDate)} — {formatDate(project.goLiveDate)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">Edit Project</Button>
            <Button size="sm">Add Task</Button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Progress</p>
          <p className="text-xl font-bold text-neutral-900">{project.progress}%</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Budget</p>
          <p className="text-xl font-bold text-neutral-900">{formatCurrency(budget)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Spent</p>
          <p className={`text-xl font-bold ${budgetPct > 85 ? 'text-danger-600' : 'text-neutral-900'}`}>{formatCurrency(spent)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Tasks Done</p>
          <p className="text-xl font-bold text-neutral-900">{tasksCompleted}/{tasksTotal}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Milestones</p>
          <p className="text-xl font-bold text-neutral-900">
            {project.milestones.filter((m) => m.isComplete).length}/{project.milestones.length}
          </p>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-neutral-900">Overall Progress</h2>
          <span className="text-sm font-bold text-neutral-900">{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} size="lg" />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Milestones + Budget + Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Milestones */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Milestones</h2>
            {project.milestones.length === 0 ? (
              <p className="text-xs text-neutral-400">No milestones defined.</p>
            ) : (
              <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
                {project.milestones.map((ms) => {
                  const isComplete = ms.isComplete
                  const isOverdue = !isComplete && ms.dueDate && new Date(ms.dueDate).getTime() < Date.now()
                  const progress = isComplete ? 100 : isOverdue ? 45 : 60
                  return (
                    <motion.div key={ms.id} variants={staggerItem} className="border border-neutral-100 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {isComplete ? (
                            <CheckCircle2 className="h-4 w-4 text-success-500" />
                          ) : isOverdue ? (
                            <Clock className="h-4 w-4 text-danger-500" />
                          ) : (
                            <Circle className="h-4 w-4 text-neutral-300" />
                          )}
                          <h3 className="text-sm font-medium text-neutral-900">{ms.title}</h3>
                          {ms.phase && <Badge variant="default">{ms.phase}</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-500">Due {formatShortDate(ms.dueDate)}</span>
                          <span className="text-xs font-medium text-neutral-700">{progress}%</span>
                        </div>
                      </div>
                      <ProgressBar
                        value={progress}
                        size="sm"
                        color={isComplete ? 'success' : isOverdue ? 'danger' : 'brand'}
                      />
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </Card>

          {/* Budget Breakdown */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Budget</h2>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-500">Spent {formatCurrency(spent)} of {formatCurrency(budget)}</span>
              <span className={`text-xs font-medium ${budgetPct > 85 ? 'text-danger-600' : 'text-neutral-700'}`}>{budgetPct}%</span>
            </div>
            <ProgressBar value={budgetPct} color={budgetPct > 85 ? 'danger' : budgetPct > 70 ? 'warning' : 'brand'} />
            <div className="mt-3 text-xs text-neutral-500">
              Remaining: {formatCurrency(budget - spent)}
            </div>
          </Card>

          {/* Task Summary */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Task Summary</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-neutral-50 rounded-lg">
                <p className="text-lg font-bold text-neutral-900">{tasksTodo}</p>
                <p className="text-xs text-neutral-500">To Do</p>
              </div>
              <div className="text-center p-3 bg-brand-50 rounded-lg">
                <p className="text-lg font-bold text-brand-600">{tasksInProgress}</p>
                <p className="text-xs text-neutral-500">In Progress</p>
              </div>
              <div className="text-center p-3 bg-success-50 rounded-lg">
                <p className="text-lg font-bold text-success-600">{tasksCompleted}</p>
                <p className="text-xs text-neutral-500">Completed</p>
              </div>
            </div>
          </Card>

          {/* Invoices */}
          {project.invoices.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold text-neutral-900 mb-4">Invoices</h2>
              <div className="space-y-2">
                {project.invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-neutral-25 cursor-pointer"
                    onClick={() => navigate(`/invoicing/${inv.id}`)}
                  >
                    <span className="text-sm font-medium text-neutral-900">{inv.invoiceNumber}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-neutral-700">{formatCurrency(inv.total)}</span>
                      <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'overdue' ? 'danger' : 'default'}>{inv.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right: Team + Activity */}
        <div className="space-y-6">
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Team</h2>
            <p className="text-xs text-neutral-400">
              Team assignments will surface here once the project_members relation lands on the schema.
            </p>
            <div className="mt-4 flex -space-x-2">
              <Avatar name="Emily Torres" size="sm" status="online" />
              <Avatar name="Amir Khan" size="sm" status="online" />
              <Avatar name="Sarah Chen" size="sm" status="busy" />
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Recent Activity</h2>
            <p className="text-xs text-neutral-400">
              Activity feed for projects will stream from comments + milestone completion events in a follow-up pass.
            </p>
          </Card>
        </div>
      </div>

      {/* Contextual Comments — polymorphic thread keyed to this project */}
      <Card>
        <CommentsPanel
          entityType="PROJECT"
          entityId={project.id}
          currentUser={authUser ? { id: authUser.id, name: authUser.name, email: authUser.email, avatar: authUser.avatar, role: authUser.role } : mockCurrentUser}
          mentionableUsers={mentionableUsers}
          comments={commentsApi.comments}
          onCreate={commentsApi.create}
          onEdit={commentsApi.edit}
          onDelete={commentsApi.remove}
        />
      </Card>
    </div>
  )
}
