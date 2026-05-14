import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { api } from '@/lib/api'

interface LineItem {
  id: string
  description: string
  scope: string
  investment: number
}

// Server response shape for the projects picker. Invoices must be linked
// to a Project (not a Client) — see server/src/routes/invoices.ts.
interface ProjectOption {
  id: string
  name: string
  client: { id: string; company: string; email: string } | null
}

const FALLBACK_PROJECTS: ProjectOption[] = [
  { id: 'demo-1', name: 'Brand Identity Package', client: { id: 'c1', company: 'Bella Cucina', email: 'marco@bellacucina.com' } },
  { id: 'demo-2', name: 'E-Commerce v3', client: { id: 'c2', company: 'Urban Threads', email: 'aisha@urbanthreads.co' } },
  { id: 'demo-3', name: 'SaaS Dashboard', client: { id: 'c3', company: 'DataFlow Inc', email: 'jake@dataflow.io' } },
]

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

export function CreateInvoicePage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectOption[]>(FALLBACK_PROJECTS)
  const [projectId, setProjectId] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('Thank you for partnering with CodeLixi. We are committed to delivering innovative solutions that transform your business.')
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), description: '', scope: 'Full', investment: 0 },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get<{ projects: ProjectOption[] }>('/projects')
        if (cancelled) return
        if (res.projects?.length) setProjects(res.projects)
      } catch {
        // Keep FALLBACK_PROJECTS when backend is unreachable
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const addLineItem = () => {
    setLineItems([...lineItems, { id: generateId(), description: '', scope: 'Full', investment: 0 }])
  }

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id))
    }
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(lineItems.map((item) => item.id === id ? { ...item, [field]: value } : item))
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.investment, 0)
  const total = subtotal

  const selectedProject = projects.find((p) => p.id === projectId)

  const inputClass = 'w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all'
  const labelClass = 'block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5'

  const handleSaveDraft = async () => {
    setError(null)
    if (!projectId) {
      setError('Pick a project first — invoices must be linked to a project.')
      return
    }
    if (!dueDate) {
      setError('Due date is required.')
      return
    }
    const validItems = lineItems.filter((i) => i.description.trim() && i.investment > 0)
    if (validItems.length === 0) {
      setError('Add at least one line item with a description and amount.')
      return
    }

    setSaving(true)
    try {
      const res = await api.post<{ data: { id: string } }>('/invoices', {
        projectId,
        dueDate,
        notes,
        lineItems: validItems.map((i) => ({
          description: i.description,
          scope: i.scope,
          quantity: 1,
          unitPrice: i.investment,
        })),
      })
      navigate(`/invoicing/${res.data.id}`)
    } catch (err: any) {
      setError((err?.message || 'Failed to save invoice').replace(/^\[\d+\]\s*/, ''))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/invoicing')}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors mb-4 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Create Invoice</h1>
            <p className="text-sm text-neutral-500 mt-1">Fill in the details below to generate a CodeLixi invoice</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate('/invoicing')} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveDraft} loading={saving}>
              Save as Draft
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-danger-50 border border-danger-200 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project & Dates */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Invoice Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>Project</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.client ? ` — ${p.client.company}` : ''}
                    </option>
                  ))}
                </select>
                {selectedProject?.client && (
                  <div className="mt-1.5 text-xs text-neutral-400 space-y-0.5">
                    <p>{selectedProject.client.company}</p>
                    <p>{selectedProject.client.email}</p>
                  </div>
                )}
              </div>
              <div>
                <label className={labelClass}>Issue Date</label>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Due Date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
              </div>
            </div>
          </Card>

          {/* Line Items */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Line Items</h2>

            <div className="grid grid-cols-12 gap-3 mb-2">
              <div className="col-span-6">
                <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Solution Overview</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Scope</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Investment</span>
              </div>
              <div className="col-span-1 text-right">
                <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Total</span>
              </div>
              <div className="col-span-1" />
            </div>

            <div className="space-y-3">
              {lineItems.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-6">
                    <input
                      type="text"
                      placeholder="e.g. Brand Identity Design"
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="col-span-2">
                    <select
                      value={item.scope}
                      onChange={(e) => updateLineItem(item.id, 'scope', e.target.value)}
                      className={inputClass}
                    >
                      <option value="Full">Full</option>
                      <option value="Phase 1">Phase 1</option>
                      <option value="Phase 2">Phase 2</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Hourly">Hourly</option>
                      <option value="One-time">One-time</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={item.investment || ''}
                      onChange={(e) => updateLineItem(item.id, 'investment', parseFloat(e.target.value) || 0)}
                      className={inputClass}
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    <p className="text-sm font-medium text-neutral-900">{formatCurrency(item.investment)}</p>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => removeLineItem(item.id)}
                      disabled={lineItems.length === 1}
                      className="h-8 w-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-danger-500 hover:bg-danger-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addLineItem}
              className="mt-4 flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Line Item
            </button>
          </Card>

          {/* Notes */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Thank You Note</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </Card>
        </div>

        {/* Right: Live Preview */}
        <div className="space-y-6">
          <Card padding="none">
            <div className="p-4 border-b border-neutral-100">
              <h2 className="text-sm font-semibold text-neutral-900">Invoice Preview</h2>
              <p className="text-xs text-neutral-400">Matches CodeLixi template</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <img src="/invoice-assets/logo.png" alt="CodeLixi" className="h-6" />
                <span className="text-lg font-bold text-neutral-900" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>INVOICE</span>
              </div>

              {selectedProject?.client ? (
                <div className="bg-neutral-900 text-white rounded-md px-3 py-2">
                  <p className="text-xs font-medium">{selectedProject.client.company}</p>
                  <p className="text-[10px] text-neutral-400">{selectedProject.client.email}</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">Project: {selectedProject.name}</p>
                </div>
              ) : (
                <div className="bg-neutral-100 rounded-md px-3 py-2">
                  <p className="text-xs text-neutral-400">No project selected</p>
                </div>
              )}

              <div>
                <div className="bg-[#ff5b01] rounded-t-md px-2 py-1.5 grid grid-cols-2">
                  <span className="text-[9px] font-bold text-white">Solution</span>
                  <span className="text-[9px] font-bold text-white text-right">Total</span>
                </div>
                <div className="border border-t-0 border-neutral-100 rounded-b-md divide-y divide-neutral-50">
                  {lineItems.filter((i) => i.description).map((item) => (
                    <div key={item.id} className="px-2 py-1.5 grid grid-cols-2">
                      <span className="text-[10px] text-neutral-600 truncate pr-2">{item.description}</span>
                      <span className="text-[10px] font-medium text-neutral-900 text-right">{formatCurrency(item.investment)}</span>
                    </div>
                  ))}
                  {lineItems.filter((i) => i.description).length === 0 && (
                    <div className="px-2 py-1.5">
                      <span className="text-[10px] text-neutral-400">No items added yet</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-b border-neutral-900 py-2 flex justify-between items-center">
                <span className="text-xs font-bold text-[#ff5b01]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>TOTAL INVESTMENT</span>
                <span className="text-sm font-bold text-[#ff5b01]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(total)}</span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <img src="/invoice-assets/signature.png" alt="Signature" className="h-6 opacity-60" />
                <img src="/invoice-assets/seal.png" alt="Seal" className="h-12 opacity-40" />
              </div>
            </div>
          </Card>

          <Card className="bg-brand-50/50 border-brand-200/40">
            <p className="text-xs text-neutral-600 leading-relaxed">
              Invoice will be saved as <span className="font-semibold">Draft</span> and generated using the CodeLixi branded template. You can review, edit, and send it from the invoice detail page.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
