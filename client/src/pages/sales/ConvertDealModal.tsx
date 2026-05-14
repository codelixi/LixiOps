import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, Building2, FolderKanban, Calendar, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui'
import { api } from '@/lib/api'
import type { Lead } from './SalesPipelinePage'

interface ConvertDealModalProps {
  lead: Lead | null
  onClose: () => void
  onConverted: (projectId: string) => void
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function ConvertDealModal({ lead, onClose, onConverted }: ConvertDealModalProps) {
  const [projectName, setProjectName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [goLiveDate, setGoLiveDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Seed defaults whenever the lead changes
  useEffect(() => {
    if (lead) {
      setProjectName(`${lead.company} — Delivery`)
      setStartDate(new Date().toISOString().slice(0, 10))
      setGoLiveDate('')
      setError(null)
    }
  }, [lead])

  const open = !!lead
  const agreedValue = lead?.agreedValue ?? lead?.value ?? 0
  const canSubmit = projectName.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit || !lead) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await api.post<{ project: { id: string } }>(`/leads/${lead.id}/convert`, {
        projectName: projectName.trim(),
        startDate: startDate || undefined,
        goLiveDate: goLiveDate || undefined,
      })
      onConverted(res.project.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to convert deal')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && lead && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl pointer-events-auto overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 border-b border-neutral-100">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-6 w-6 rounded-md bg-brand-500 flex items-center justify-center">
                        <ArrowRight className="h-3.5 w-3.5 text-white" />
                      </div>
                      <h2 className="text-lg font-semibold text-neutral-900">Convert Deal to Project</h2>
                    </div>
                    <p className="text-xs text-neutral-500 ml-8">One atomic step — creates Client + Project, locks the deal</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Summary Card */}
              <div className="px-6 py-4 bg-gradient-to-br from-brand-50/50 to-white border-b border-neutral-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-0.5">Closed Won Deal</p>
                    <p className="text-sm font-semibold text-neutral-900">{lead.company}</p>
                    <p className="text-xs text-neutral-500">{lead.contactName} · {lead.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-0.5">Agreed Value</p>
                    <p className="text-lg font-bold text-brand-600">{formatCurrency(agreedValue)}</p>
                  </div>
                </div>
              </div>

              {/* What will happen */}
              <div className="px-6 py-4 bg-neutral-50/50 border-b border-neutral-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">What this does</p>
                <div className="space-y-1.5">
                  <StepLine icon={<Building2 className="h-3 w-3" />} text={`Creates Client record for ${lead.company}`} />
                  <StepLine icon={<FolderKanban className="h-3 w-3" />} text={`Creates Project linked to this deal (leadId: ${lead.id.slice(0, 6)}…)`} />
                  <StepLine icon={<CheckCircle2 className="h-3 w-3" />} text="Locks deal to prevent double-conversion" />
                </div>
              </div>

              {/* Form */}
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 mb-1.5">
                    <FolderKanban className="h-3.5 w-3.5 text-neutral-400" />
                    Project Name
                    <span className="text-brand-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 mb-1.5">
                      <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 mb-1.5">
                      <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                      Go-Live Date
                    </label>
                    <input
                      type="date"
                      value={goLiveDate}
                      onChange={(e) => setGoLiveDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm outline-none transition"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-warning-50/40 border border-warning-100">
                  <DollarSign className="h-3.5 w-3.5 text-warning-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-warning-800 leading-relaxed">
                    Contract value of <strong>{formatCurrency(agreedValue)}</strong> will be inherited by the new Project and Client record.
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-danger-50/50 border border-danger-100">
                    <AlertCircle className="h-3.5 w-3.5 text-danger-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-danger-800 leading-relaxed">{error}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
                <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || submitting} icon={<ArrowRight className="h-3.5 w-3.5" />}>
                  {submitting ? 'Converting...' : 'Convert Deal'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function StepLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-5 w-5 rounded-md bg-white border border-neutral-200 flex items-center justify-center text-brand-500">
        {icon}
      </div>
      <p className="text-xs text-neutral-700">{text}</p>
    </div>
  )
}
