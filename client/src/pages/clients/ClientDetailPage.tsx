import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Mail, Phone, Globe, MapPin, Calendar, FileText, MessageSquare } from 'lucide-react'
import { Button, Badge, Card, Avatar, ProgressBar } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { CommentsPanel } from '@/components/comments/CommentsPanel'
import { mockCurrentUser } from '@/lib/mockUsers'
import { api, ApiError } from '@/lib/api'
import { useAuthStore } from '@/stores/useAuthStore'
import { useComments } from '@/hooks/useComments'
import { useUsers } from '@/hooks/useUsers'

// ───────────────────────────────────────────
// Server client shape (see server/src/routes/clients.ts)
// Fields NPS/website/address/interactions don't exist on the
// Client model yet — we display derived/placeholder values to
// preserve the existing page shape until the schema grows.
// ───────────────────────────────────────────

interface ServerProject {
  id: string
  name: string
  health: string
  progress: number
  contractValue: number | null
  goLiveDate: string | null
}

interface ServerInvoice {
  id: string
  invoiceNumber: string
  total: number
  paidAmount: number
  status: string
  dueDate: string
  sentAt: string | null
}

interface ServerClient {
  id: string
  company: string
  contactName: string
  email: string
  phone: string | null
  vertical: string | null
  status: string
  contractValue: number | null
  healthScore: number | null
  createdAt: string
  projects: ServerProject[]
  invoices: ServerInvoice[]
}

const FALLBACK: ServerClient = {
  id: 'demo',
  company: 'Bella Cucina',
  contactName: 'Marco Rossi',
  email: 'marco@bellacucina.com',
  phone: '+1 555-0101',
  vertical: 'Restaurant & Hospitality',
  status: 'active',
  contractValue: 72000,
  healthScore: 92,
  createdAt: '2025-01-15T00:00:00Z',
  projects: [
    { id: 'p1', name: 'Brand Identity Package', health: 'ON_TRACK', progress: 80, contractValue: 25000, goLiveDate: null },
    { id: 'p2', name: 'Social Media Templates', health: 'COMPLETED', progress: 100, contractValue: 5000, goLiveDate: null },
  ],
  invoices: [
    { id: 'i1', invoiceNumber: 'INV-2026-001', total: 6000, paidAmount: 6000, status: 'paid', dueDate: '2026-04-01', sentAt: '2026-04-01' },
    { id: 'i2', invoiceNumber: 'INV-2026-007', total: 3000, paidAmount: 0, status: 'draft', dueDate: '2026-05-05', sentAt: null },
  ],
}

const statusVariant: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  active: 'success', onboarding: 'info', churned: 'danger', prospect: 'default',
  ON_TRACK: 'success', AT_RISK: 'warning', DELAYED: 'danger', COMPLETED: 'info',
  paid: 'success', draft: 'default', sent: 'info', overdue: 'danger', partial: 'warning',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

function getHealthColor(score: number) {
  if (score >= 80) return 'text-success-600'
  if (score >= 60) return 'text-warning-600'
  return 'text-danger-600'
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ClientDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<ServerClient>(FALLBACK)
  const [usingFallback, setUsingFallback] = useState(false)
  const [loading, setLoading] = useState(true)
  const authUser = useAuthStore((s) => s.user)
  const commentsApi = useComments('CLIENT', client.id)
  const { users: mentionableUsers } = useUsers()

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get<{ data: ServerClient }>(`/clients/${id}`)
        if (cancelled) return
        setClient(res.data)
        setUsingFallback(false)
      } catch (err) {
        // Keep FALLBACK if network/server unavailable so the page is reviewable.
        if (!cancelled) setUsingFallback(err instanceof ApiError && err.status === 0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return <div className="text-sm text-neutral-500">Loading client…</div>
  }

  const mrr = client.contractValue ? Math.round(client.contractValue / 12) : 0
  const totalRevenue = client.invoices.reduce((s, i) => s + i.paidAmount, 0)
  const health = client.healthScore ?? 0
  const joinDate = new Date(client.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors mb-4 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Clients
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={client.company} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">{client.company}</h1>
                <Badge variant={statusVariant[client.status] || 'default'} dot>
                  {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                </Badge>
                {usingFallback && (
                  <span className="text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo</span>
                )}
              </div>
              <p className="text-sm text-neutral-500 mt-0.5">{client.vertical || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">Edit Client</Button>
            <Button size="sm" icon={<MessageSquare className="h-3.5 w-3.5" />}>Log Interaction</Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">MRR</p>
          <p className="text-xl font-bold text-neutral-900">{formatCurrency(mrr)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Revenue</p>
          <p className="text-xl font-bold text-neutral-900">{formatCurrency(totalRevenue)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Health Score</p>
          <p className={`text-xl font-bold ${getHealthColor(health)}`}>{health}%</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Active Projects</p>
          <p className="text-xl font-bold text-neutral-900">{client.projects.filter((p) => p.health !== 'COMPLETED').length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Invoices</p>
          <p className="text-xl font-bold text-neutral-900">{client.invoices.length}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Contact + Projects + Invoices */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <Mail className="h-4 w-4 text-neutral-400" />
                <span>{client.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <Phone className="h-4 w-4 text-neutral-400" />
                <span>{client.phone || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <Globe className="h-4 w-4 text-neutral-400" />
                <span className="text-neutral-400">Website not on file</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <MapPin className="h-4 w-4 text-neutral-400" />
                <span className="text-neutral-400">Address not on file</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <Calendar className="h-4 w-4 text-neutral-400" />
                <span>Client since {joinDate}</span>
              </div>
            </div>
          </Card>

          {/* Projects */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Projects</h2>
            {client.projects.length === 0 ? (
              <p className="text-xs text-neutral-400">No projects yet.</p>
            ) : (
              <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
                {client.projects.map((project) => (
                  <motion.div
                    key={project.id}
                    variants={staggerItem}
                    className="border border-neutral-100 rounded-lg p-4 cursor-pointer hover:bg-neutral-25 transition-colors"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-neutral-900">{project.name}</h3>
                        <Badge variant={statusVariant[project.health] || 'default'}>
                          {project.health.replace('_', ' ').toLowerCase()}
                        </Badge>
                      </div>
                      <span className="text-sm font-semibold text-neutral-900">
                        {formatCurrency(project.contractValue || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-neutral-500">Progress</span>
                      <span className="text-xs font-medium text-neutral-700">{project.progress}%</span>
                    </div>
                    <ProgressBar value={project.progress} color={project.progress === 100 ? 'success' : 'brand'} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </Card>

          {/* Invoices */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Invoices</h2>
            {client.invoices.length === 0 ? (
              <p className="text-xs text-neutral-400">No invoices yet.</p>
            ) : (
              <div className="space-y-3">
                {client.invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0 cursor-pointer hover:bg-neutral-25 transition-colors rounded"
                    onClick={() => navigate(`/invoicing/${inv.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-neutral-400" />
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{inv.invoiceNumber}</p>
                        <p className="text-xs text-neutral-500">Due {formatDate(inv.dueDate)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-neutral-900">{formatCurrency(inv.total)}</span>
                      <Badge variant={statusVariant[inv.status] || 'default'}>
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Interaction Timeline */}
        <div>
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Recent Interactions</h2>
            <p className="text-xs text-neutral-400">
              Interaction timeline will pull from lead activities + comments in a follow-up pass.
            </p>
          </Card>
        </div>
      </div>

      {/* Contextual Comments */}
      <Card>
        <CommentsPanel
          entityType="CLIENT"
          entityId={client.id}
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
