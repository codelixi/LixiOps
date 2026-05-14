import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Filter, Phone, Mail, Calendar, ArrowRight, CheckCircle2, XCircle, AlertTriangle, DollarSign, TrendingUp, Clock } from 'lucide-react'
import { Button, Badge, Avatar, Card } from '@/components/ui'
import { staggerContainer, staggerItem, fadeInUp } from '@/lib/motion'
import { CreateLeadSlideOver } from './CreateLeadSlideOver'
import { ConvertDealModal } from './ConvertDealModal'
import { useLeads } from '@/hooks/useLeads'

// Backend-aligned stages (matches Prisma LeadStage enum)
export type LeadStage = 'PROSPECT' | 'CONTACTED' | 'PROPOSAL_SENT' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST'

export interface Lead {
  id: string
  company: string
  contactName: string
  email?: string
  phone?: string
  stage: LeadStage
  value: number
  agreedValue?: number
  aiScore?: number
  rep?: { id: string; name: string }
  lastActivityAt: string
  convertedProjectId?: string
  convertedClientId?: string
  closedLostReason?: string
}

const stageConfig: Record<LeadStage, { title: string; dot: string; bg: string }> = {
  PROSPECT:      { title: 'Prospect',      dot: 'bg-neutral-400', bg: 'bg-neutral-50' },
  CONTACTED:     { title: 'Contacted',     dot: 'bg-info-500',    bg: 'bg-info-50/30' },
  PROPOSAL_SENT: { title: 'Proposal Sent', dot: 'bg-brand-500',   bg: 'bg-brand-50/30' },
  NEGOTIATION:   { title: 'Negotiation',   dot: 'bg-warning-500', bg: 'bg-warning-50/30' },
  CLOSED_WON:    { title: 'Closed Won',    dot: 'bg-success-500', bg: 'bg-success-50/30' },
  CLOSED_LOST:   { title: 'Closed Lost',   dot: 'bg-danger-500',  bg: 'bg-danger-50/20' },
}

const stageOrder: LeadStage[] = ['PROSPECT', 'CONTACTED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function ScoreBadge({ score }: { score?: number }) {
  if (!score) return null
  const variant = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'default'
  return <Badge variant={variant}>{score}</Badge>
}

function LeadCard({
  lead,
  onConvert,
  onOpen,
}: {
  lead: Lead
  onConvert: (l: Lead) => void
  onOpen: (l: Lead) => void
}) {
  const isWon = lead.stage === 'CLOSED_WON'
  const isLost = lead.stage === 'CLOSED_LOST'
  const alreadyConverted = !!lead.convertedProjectId

  return (
    <motion.div
      layout
      variants={staggerItem}
      whileHover={{ y: -2 }}
      onClick={() => onOpen(lead)}
      className="bg-white rounded-lg border border-neutral-200/60 p-3.5 shadow-xs hover:shadow-sm transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900 truncate">{lead.company}</p>
          <p className="text-xs text-neutral-500 truncate">{lead.contactName}</p>
        </div>
        <ScoreBadge score={lead.aiScore} />
      </div>

      <p className="text-base font-bold text-neutral-900 mb-2.5">
        {formatCurrency(lead.agreedValue ?? lead.value)}
      </p>

      {isLost && lead.closedLostReason && (
        <div className="flex items-start gap-1.5 mb-2.5 px-2 py-1.5 rounded-md bg-danger-50/50 border border-danger-100">
          <XCircle className="h-3 w-3 text-danger-500 mt-0.5 shrink-0" />
          <p className="text-[10px] text-danger-700 leading-tight">{lead.closedLostReason}</p>
        </div>
      )}

      {isWon && !alreadyConverted && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onConvert(lead)
          }}
          className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 mb-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-colors"
        >
          <ArrowRight className="h-3 w-3" />
          Convert to Project
        </button>
      )}
      {isWon && alreadyConverted && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-md bg-success-50 border border-success-100">
          <CheckCircle2 className="h-3 w-3 text-success-600" />
          <span className="text-[10px] font-medium text-success-700">Converted to Project</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          {lead.rep && (
            <>
              <Avatar name={lead.rep.name} size="xs" />
              <span className="text-xs text-neutral-500 truncate">{lead.rep.name}</span>
            </>
          )}
        </div>
        {!isWon && !isLost && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={(e) => e.stopPropagation()} className="h-6 w-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-colors">
              <Phone className="h-3 w-3" />
            </button>
            <button onClick={(e) => e.stopPropagation()} className="h-6 w-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-colors">
              <Mail className="h-3 w-3" />
            </button>
            <button onClick={(e) => e.stopPropagation()} className="h-6 w-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-colors">
              <Calendar className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      <p className="text-[10px] text-neutral-400 mt-2 flex items-center gap-1">
        <Clock className="h-2.5 w-2.5" />
        {lead.lastActivityAt}
      </p>
    </motion.div>
  )
}

export function SalesPipelinePage() {
  const navigate = useNavigate()
  const { leads, usingFallback, refresh } = useLeads()
  const [createOpen, setCreateOpen] = useState(false)
  const [convertLead, setConvertLead] = useState<Lead | null>(null)

  // Metrics
  const activeLeads = leads.filter((l) => l.stage !== 'CLOSED_LOST' && l.stage !== 'CLOSED_WON')
  const pipelineValue = activeLeads.reduce((s, l) => s + (l.agreedValue ?? l.value), 0)
  const wonThisPeriod = leads.filter((l) => l.stage === 'CLOSED_WON').reduce((s, l) => s + (l.agreedValue ?? l.value), 0)
  const wonCount = leads.filter((l) => l.stage === 'CLOSED_WON').length
  const lostCount = leads.filter((l) => l.stage === 'CLOSED_LOST').length
  const winRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0
  const unconverted = leads.filter((l) => l.stage === 'CLOSED_WON' && !l.convertedProjectId).length

  const handleOpenLead = (_lead: Lead) => {
    // TODO: navigate to lead detail once built
  }

  const handleConvert = (lead: Lead) => {
    setConvertLead(lead)
  }

  const handleConvertComplete = (projectId: string) => {
    refresh()
    navigate(`/projects/${projectId}`)
  }

  const handleLeadCreated = () => {
    refresh()
    setCreateOpen(false)
  }

  return (
    <motion.div className="space-y-6" {...fadeInUp}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Sales Pipeline</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Every deal starts here. Only Closed Won deals become projects.
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Filter className="h-3.5 w-3.5" />}>Filter</Button>
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
            Add Lead
          </Button>
        </div>
      </div>

      {/* Decision-based KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="!p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-neutral-500">Pipeline Value</span>
            <DollarSign className="h-3.5 w-3.5 text-neutral-400" />
          </div>
          <p className="text-xl font-bold text-neutral-900">{formatCurrency(pipelineValue)}</p>
          <p className="text-[11px] text-neutral-500 mt-1">{activeLeads.length} active deals</p>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-neutral-500">Won (Period)</span>
            <TrendingUp className="h-3.5 w-3.5 text-success-500" />
          </div>
          <p className="text-xl font-bold text-neutral-900">{formatCurrency(wonThisPeriod)}</p>
          <p className="text-[11px] text-success-600 mt-1">{winRate}% win rate</p>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-neutral-500">Stuck Deals</span>
            <AlertTriangle className="h-3.5 w-3.5 text-warning-500" />
          </div>
          <p className="text-xl font-bold text-neutral-900">0</p>
          <p className="text-[11px] text-neutral-500 mt-1">No activity &gt; 7 days</p>
        </Card>
        {unconverted > 0 ? (
          <Card className="!p-4 border-brand-200 bg-brand-50/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-brand-700">Action Needed</span>
              <ArrowRight className="h-3.5 w-3.5 text-brand-500" />
            </div>
            <p className="text-xl font-bold text-brand-700">{unconverted}</p>
            <p className="text-[11px] text-brand-600 mt-1">Won deals → create projects</p>
          </Card>
        ) : (
          <Card className="!p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-neutral-500">Conversion</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-success-500" />
            </div>
            <p className="text-xl font-bold text-neutral-900">All clear</p>
            <p className="text-[11px] text-neutral-500 mt-1">No pending conversions</p>
          </Card>
        )}
      </div>

      {/* Pipeline kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
        {stageOrder.map((stage) => {
          const cfg = stageConfig[stage]
          const columnLeads = leads.filter((l) => l.stage === stage)
          const columnValue = columnLeads.reduce((s, l) => s + (l.agreedValue ?? l.value), 0)
          return (
            <div key={stage} className={`flex-shrink-0 w-72 rounded-xl ${cfg.bg} border border-neutral-200/50 p-3`}>
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                  <h3 className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">{cfg.title}</h3>
                  <span className="text-[10px] font-medium text-neutral-500 bg-white/70 rounded-full px-1.5 py-0.5">
                    {columnLeads.length}
                  </span>
                </div>
                {columnValue > 0 && (
                  <span className="text-[10px] font-semibold text-neutral-600">{formatCurrency(columnValue)}</span>
                )}
              </div>

              {/* Cards */}
              <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
                {columnLeads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} onConvert={handleConvert} onOpen={handleOpenLead} />
                ))}
                {columnLeads.length === 0 && (
                  <div className="text-center py-6 text-[11px] text-neutral-400 border border-dashed border-neutral-200 rounded-lg">
                    No deals in this stage
                  </div>
                )}
              </motion.div>
            </div>
          )
        })}
      </div>

      {/* Slide-overs & modals */}
      <CreateLeadSlideOver open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleLeadCreated} />
      <ConvertDealModal
        lead={convertLead}
        onClose={() => setConvertLead(null)}
        onConverted={handleConvertComplete}
      />
    </motion.div>
  )
}
