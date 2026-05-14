import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Building2, Mail, Phone, Info, ArrowRight } from 'lucide-react'
import { Button, Badge, Card, Avatar } from '@/components/ui'
import { CreateClientSlideOver } from './CreateClientSlideOver'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useClients } from '@/hooks/useClients'

const statusMap = {
  active: { label: 'Active', variant: 'success' as const },
  onboarding: { label: 'Onboarding', variant: 'info' as const },
  churned: { label: 'Churned', variant: 'danger' as const },
  prospect: { label: 'Prospect', variant: 'default' as const },
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

function getHealthColor(score: number) {
  if (score >= 80) return 'text-success-600'
  if (score >= 60) return 'text-warning-600'
  if (score > 0) return 'text-danger-600'
  return 'text-neutral-400'
}

export function ClientListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const { clients, usingFallback } = useClients()

  const filtered = clients
    .filter((c) => filter === 'all' || c.status === filter)
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.contactName.toLowerCase().includes(search.toLowerCase()))

  const totalMRR = clients.filter((c) => c.status === 'active').reduce((s, c) => s + c.mrr, 0)
  const activeCount = clients.filter((c) => c.status === 'active').length
  const avgHealth = Math.round(clients.filter((c) => c.healthScore > 0).reduce((s, c) => s + c.healthScore, 0) / clients.filter((c) => c.healthScore > 0).length)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Clients</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Clients are created automatically when a Deal is Closed Won
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowRight className="h-3.5 w-3.5" />}
            onClick={() => navigate('/sales')}
          >
            Go to Pipeline
          </Button>
          <div className="group relative">
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setCreateOpen(true)}
            >
              Add Manually
            </Button>
            <div className="absolute right-0 top-full mt-2 w-64 px-3 py-2 rounded-lg bg-neutral-900 text-white text-[11px] leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
              <div className="flex items-start gap-1.5">
                <Info className="h-3 w-3 shrink-0 mt-0.5 text-warning-400" />
                <span>Best practice: create clients via Deal conversion in the Sales Pipeline. Manual creation is a fallback.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-brand-50/40 border border-brand-100">
        <Info className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-brand-900">Workflow: Lead &rarr; Deal &rarr; Closed Won &rarr; Client + Project</p>
          <p className="text-[11px] text-brand-700 mt-0.5">Every client below was once a deal. To add a new client, move a deal to <strong>Closed Won</strong> in the Sales Pipeline and click Convert.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total MRR</p>
          <p className="text-2xl font-bold text-neutral-900">{formatCurrency(totalMRR)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Active Clients</p>
          <p className="text-2xl font-bold text-neutral-900">{activeCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Avg Health Score</p>
          <p className={`text-2xl font-bold ${getHealthColor(avgHealth)}`}>{avgHealth}%</p>
        </Card>
      </div>

      {/* Filters + Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {['all', 'active', 'onboarding', 'prospect', 'churned'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                filter === f ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-64 transition-all"
          />
        </div>
      </div>

      {/* Client Grid */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
      >
        {filtered.map((client) => (
          <motion.div key={client.id} variants={staggerItem} onClick={() => navigate(`/clients/${client.id}`)}>
            <Card hover className="cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar name={client.name} size="md" />
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">{client.name}</h3>
                    <p className="text-xs text-neutral-500">{client.industry}</p>
                  </div>
                </div>
                <Badge variant={statusMap[client.status].variant} dot>
                  {statusMap[client.status].label}
                </Badge>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-xs text-neutral-600">
                  <Building2 className="h-3.5 w-3.5 text-neutral-400" />
                  <span>{client.contactName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-600">
                  <Mail className="h-3.5 w-3.5 text-neutral-400" />
                  <span>{client.contactEmail}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-600">
                  <Phone className="h-3.5 w-3.5 text-neutral-400" />
                  <span>{client.contactPhone}</span>
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {client.mrr > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-neutral-400 uppercase">MRR</p>
                      <p className="text-sm font-semibold text-neutral-900">{formatCurrency(client.mrr)}</p>
                    </div>
                  )}
                  {client.activeProjects > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-neutral-400 uppercase">Projects</p>
                      <p className="text-sm font-semibold text-neutral-900">{client.activeProjects}</p>
                    </div>
                  )}
                  {client.healthScore > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-neutral-400 uppercase">Health</p>
                      <p className={`text-sm font-semibold ${getHealthColor(client.healthScore)}`}>{client.healthScore}%</p>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-neutral-400">{client.lastInteraction}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <CreateClientSlideOver open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
