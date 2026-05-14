import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
import type { CommentAuthor } from '@/components/comments/CommentsPanel'

interface ClientLite {
  id: string
  company: string
}

interface CreateBriefModalProps {
  open: boolean
  onClose: () => void
  clients: ClientLite[]
  designers: CommentAuthor[]
  onSubmit: (payload: {
    objective: string
    deliverable: string
    clientId?: string | null
    designerId?: string | null
    estimatedHours?: number | null
    dueDate?: string | null
    brandRefs?: string | null
  }) => Promise<void>
}

export function CreateBriefModal({ open, onClose, clients, designers, onSubmit }: CreateBriefModalProps) {
  const [objective, setObjective] = useState('')
  const [deliverable, setDeliverable] = useState('')
  const [clientId, setClientId] = useState('')
  const [designerId, setDesignerId] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [brandRefs, setBrandRefs] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setObjective('')
    setDeliverable('')
    setClientId('')
    setDesignerId('')
    setEstimatedHours('')
    setDueDate('')
    setBrandRefs('')
    setError(null)
  }, [open])

  const handleClose = () => {
    if (submitting) return
    onClose()
  }

  const handleSubmit = async () => {
    setError(null)
    if (!objective.trim()) {
      setError('Objective is required')
      return
    }
    if (!deliverable.trim()) {
      setError('Deliverable is required')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        objective: objective.trim(),
        deliverable: deliverable.trim(),
        clientId: clientId || null,
        designerId: designerId || null,
        estimatedHours: estimatedHours ? Number(estimatedHours) : null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        brandRefs: brandRefs.trim() || null,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create brief')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-10 px-4 overflow-y-auto"
          >
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-neutral-200/60 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">New design brief</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">Clarify the objective and deliverable up front.</p>
                </div>
                <button
                  onClick={handleClose}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Objective</label>
                  <input
                    type="text"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="e.g. Brand Identity Package"
                    className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Deliverable</label>
                  <textarea
                    value={deliverable}
                    onChange={(e) => setDeliverable(e.target.value)}
                    placeholder="What exactly is being delivered?"
                    rows={3}
                    className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Client</label>
                    <select
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    >
                      <option value="">— Internal —</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.company}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Designer</label>
                    <select
                      value={designerId}
                      onChange={(e) => setDesignerId(e.target.value)}
                      className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    >
                      <option value="">— Unassigned —</option>
                      {designers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Estimated hours</label>
                    <input
                      type="number"
                      min={0}
                      value={estimatedHours}
                      onChange={(e) => setEstimatedHours(e.target.value)}
                      placeholder="e.g. 20"
                      className="w-full h-9 px-3 text-sm font-mono bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Due date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Brand references / inspiration</label>
                  <textarea
                    value={brandRefs}
                    onChange={(e) => setBrandRefs(e.target.value)}
                    placeholder="Links, moodboard notes, do/don't"
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-50 border border-danger-200 text-xs text-danger-700">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    {error}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-100 bg-neutral-50/50">
                <Button variant="secondary" size="sm" onClick={handleClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={submitting}
                  icon={submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
                >
                  {submitting ? 'Creating…' : 'Create brief'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
