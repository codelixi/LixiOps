import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, CheckCircle2, AlertTriangle, ArrowRight, DollarSign, AlertCircle } from 'lucide-react'
import { Button, Card, Avatar } from '@/components/ui'
import { api } from '@/lib/api'

// Only Closed Won deals without a converted project are eligible.
// These come from GET /api/v1/leads (we filter CLOSED_WON + unconverted
// in the component since the server doesn't support the query params yet).
interface EligibleDeal {
  id: string
  company: string
  contactName: string
  agreedValue: number
  closedWonAt: string
}

interface ServerLead {
  id: string
  company: string
  contactName: string
  stage: string
  value: number
  agreedValue: number | null
  closedWonAt: string | null
  convertedProjectId: string | null
  convertedClientId: string | null
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'recently'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins || 1}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const projectTypes = [
  'Branding',
  'Web App',
  'Website',
  'E-Commerce',
  'Mobile App',
  'SaaS',
  'UI/UX Design',
  'Marketing',
  'Consulting',
  'Other',
]

const teamMembers = [
  { id: '1', name: 'Sarah Chen', role: 'Lead Designer' },
  { id: '2', name: 'Raj Patel', role: 'Full-Stack Dev' },
  { id: '3', name: 'Amir Khan', role: 'UI Designer' },
  { id: '4', name: 'David Park', role: 'Backend Dev' },
  { id: '5', name: 'Fatima Zahra', role: 'QA Engineer' },
  { id: '6', name: 'Emily Torres', role: 'Project Manager' },
  { id: '7', name: 'Carlos Mendez', role: 'Frontend Dev' },
]

interface Milestone {
  id: string
  title: string
  dueDate: string
}

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

const inputClass = 'w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all'
const labelClass = 'block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5'

export function CreateProjectPage() {
  const navigate = useNavigate()
  const [dealId, setDealId] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [budget, setBudget] = useState<number>(0)
  const [selectedTeam, setSelectedTeam] = useState<string[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: generateId(), title: '', dueDate: '' },
  ])
  const [eligibleDeals, setEligibleDeals] = useState<EligibleDeal[]>([])
  const [loadingDeals, setLoadingDeals] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get<{ leads: ServerLead[] }>('/leads')
        if (cancelled) return
        const mapped = res.leads
          .filter((l) => l.stage?.toUpperCase() === 'CLOSED_WON' && !l.convertedProjectId)
          .map<EligibleDeal>((l) => ({
            id: l.id,
            company: l.company,
            contactName: l.contactName,
            agreedValue: l.agreedValue ?? l.value ?? 0,
            closedWonAt: timeAgo(l.closedWonAt),
          }))
        setEligibleDeals(mapped)
      } catch {
        // Silent fallback — empty list will trigger the warning banner
        if (!cancelled) setEligibleDeals([])
      } finally {
        if (!cancelled) setLoadingDeals(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleCreate = async () => {
    if (!name.trim() || !dealId) return
    setSubmitting(true)
    setError(null)
    try {
      const validMilestones = milestones
        .filter((m) => m.title.trim() && m.dueDate)
        .map((m) => ({ title: m.title.trim(), dueDate: m.dueDate }))
      const res = await api.post<{ project: { id: string } }>('/projects', {
        leadId: dealId,
        name: name.trim(),
        startDate: startDate || undefined,
        goLiveDate: dueDate || undefined,
        milestones: validMilestones,
      })
      navigate(`/projects/${res.project.id}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create project'
      setError(msg)
      setSubmitting(false)
    }
  }

  const toggleTeamMember = (id: string) => {
    setSelectedTeam((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  const addMilestone = () => {
    setMilestones([...milestones, { id: generateId(), title: '', dueDate: '' }])
  }

  const removeMilestone = (id: string) => {
    if (milestones.length > 1) setMilestones(milestones.filter((m) => m.id !== id))
  }

  const updateMilestone = (id: string, field: keyof Milestone, value: string) => {
    setMilestones(milestones.map((m) => m.id === id ? { ...m, [field]: value } : m))
  }

  const selectedDeal = eligibleDeals.find((d) => d.id === dealId)
  const selectedClient = selectedDeal ? { id: selectedDeal.id, name: selectedDeal.company } : null
  const hasEligibleDeals = eligibleDeals.length > 0

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

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">New Project</h1>
            <p className="text-sm text-neutral-500 mt-1">Projects can only be created from a Closed Won deal</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate('/projects')}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!name.trim() || !dealId || submitting}
              onClick={handleCreate}
            >
              {submitting ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </div>
      </div>

      {/* Error state (from failed POST) */}
      {error && (
        <Card className="border-danger-200 bg-danger-50/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-danger-900">Could not create project</h3>
              <p className="text-xs text-danger-800 mt-1">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Enforcement banner / empty state */}
      {loadingDeals ? (
        <Card>
          <p className="text-xs text-neutral-500">Loading eligible deals...</p>
        </Card>
      ) : !hasEligibleDeals ? (
        <Card className="border-warning-200 bg-warning-50/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-warning-900">No Closed Won deals available</h3>
              <p className="text-xs text-warning-800 mt-1 leading-relaxed">
                Projects must originate from a won deal. There are currently no Closed Won deals without an associated project. Head to the Sales Pipeline, move a deal to <strong>Closed Won</strong>, and convert it.
              </p>
              <Button
                size="sm"
                className="mt-3"
                icon={<ArrowRight className="h-3.5 w-3.5" />}
                onClick={() => navigate('/sales')}
              >
                Go to Sales Pipeline
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-brand-200 bg-brand-50/30">
          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-brand-900">
                {eligibleDeals.length} eligible {eligibleDeals.length === 1 ? 'deal' : 'deals'} ready to convert
              </p>
              <p className="text-[11px] text-brand-700 mt-0.5">
                Select a Closed Won deal below — the client record and contract value will be inherited automatically.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Project Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Project Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Brand Identity Redesign"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Closed Won Deal *</label>
                  <select
                    value={dealId}
                    onChange={(e) => setDealId(e.target.value)}
                    className={inputClass}
                    disabled={!hasEligibleDeals}
                  >
                    <option value="">{hasEligibleDeals ? 'Select a won deal...' : 'No eligible deals'}</option>
                    {eligibleDeals.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.company} — {formatCurrency(d.agreedValue)}
                      </option>
                    ))}
                  </select>
                  {selectedDeal && (
                    <p className="mt-1 text-[11px] text-success-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Client <strong>{selectedDeal.company}</strong> will be linked automatically
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Project Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                    <option value="">Select type...</option>
                    {projectTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  placeholder="Brief description of the project scope and goals..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>
          </Card>

          {/* Timeline & Budget */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Timeline & Budget</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Due Date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Budget (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  placeholder="0"
                  value={budget || ''}
                  onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
            </div>
          </Card>

          {/* Milestones */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Milestones</h2>
            <div className="space-y-3">
              {milestones.map((ms) => (
                <div key={ms.id} className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="e.g. Discovery Phase Complete"
                    value={ms.title}
                    onChange={(e) => updateMilestone(ms.id, 'title', e.target.value)}
                    className={`${inputClass} flex-1`}
                  />
                  <input
                    type="date"
                    value={ms.dueDate}
                    onChange={(e) => updateMilestone(ms.id, 'dueDate', e.target.value)}
                    className={`${inputClass} w-40`}
                  />
                  <button
                    onClick={() => removeMilestone(ms.id)}
                    disabled={milestones.length === 1}
                    className="h-8 w-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-danger-500 hover:bg-danger-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addMilestone}
              className="mt-4 flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Milestone
            </button>
          </Card>

          {/* Team */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Team Members</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {teamMembers.map((member) => {
                const selected = selectedTeam.includes(member.id)
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleTeamMember(member.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer text-left ${
                      selected
                        ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/20'
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <Avatar name={member.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">{member.name}</p>
                      <p className="text-xs text-neutral-500">{member.role}</p>
                    </div>
                    <div className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                      selected ? 'bg-brand-500 border-brand-500' : 'border-neutral-300'
                    }`}>
                      {selected && (
                        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Right: Summary */}
        <div className="space-y-6">
          <Card>
            <div className="border-b border-neutral-100 pb-3 mb-4">
              <h2 className="text-sm font-semibold text-neutral-900">Project Summary</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Project</span>
                <span className="font-medium text-neutral-900 text-right max-w-[60%] truncate">
                  {name || '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Client</span>
                <span className="font-medium text-neutral-900">{selectedClient?.name || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Type</span>
                <span className="font-medium text-neutral-900">{type || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Timeline</span>
                <span className="font-medium text-neutral-900">
                  {startDate && dueDate ? `${startDate} → ${dueDate}` : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Budget</span>
                <span className="font-medium text-neutral-900">{budget > 0 ? formatCurrency(budget) : '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Milestones</span>
                <span className="font-medium text-neutral-900">{milestones.filter((m) => m.title.trim()).length}</span>
              </div>
              <div className="border-t border-neutral-100 pt-3 flex justify-between text-sm">
                <span className="text-neutral-500">Team</span>
                <div className="flex -space-x-1.5">
                  {selectedTeam.length > 0 ? (
                    selectedTeam.slice(0, 5).map((id) => {
                      const m = teamMembers.find((t) => t.id === id)
                      return m ? <Avatar key={id} name={m.name} size="xs" /> : null
                    })
                  ) : (
                    <span className="text-neutral-400 text-sm">—</span>
                  )}
                  {selectedTeam.length > 5 && (
                    <div className="h-6 w-6 rounded-full bg-neutral-200 flex items-center justify-center text-[10px] font-medium text-neutral-600 ring-2 ring-white">
                      +{selectedTeam.length - 5}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-brand-50/50 border-brand-200/40">
            <p className="text-xs text-neutral-600 leading-relaxed">
              Project will be created in <span className="font-semibold">Planning</span> status. You can assign tasks, set sprints, and start tracking once the project is confirmed.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
