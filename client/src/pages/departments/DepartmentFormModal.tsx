import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
import type { CommentAuthor } from '@/components/comments/CommentsPanel'
import type { DepartmentAggregate } from '@/hooks/useDepartments'

// ───────────────────────────────────────────
// Create / Edit Department modal — covers name, head, budget,
// description. Head picker is a flat select over all users; we'll
// switch to a search-as-you-type input when the directory grows.
// ───────────────────────────────────────────

interface FormPayload {
  name: string
  headId?: string | null
  budget?: number
  description?: string | null
}

interface DepartmentFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (payload: FormPayload) => Promise<void>
  existing: DepartmentAggregate | null
  users: CommentAuthor[]
}

export function DepartmentFormModal({ open, onClose, onSubmit, existing, users }: DepartmentFormModalProps) {
  const [name, setName] = useState('')
  const [headId, setHeadId] = useState<string>('')
  const [budget, setBudget] = useState<string>('0')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hydrate form when opening for edit, or reset when opening for create.
  useEffect(() => {
    if (!open) return
    if (existing) {
      setName(existing.name)
      setHeadId(existing.headId ?? '')
      setBudget(String(existing.budget))
      setDescription(existing.description ?? '')
    } else {
      setName('')
      setHeadId('')
      setBudget('0')
      setDescription('')
    }
    setError(null)
  }, [open, existing])

  const handleClose = () => {
    if (submitting) return
    onClose()
  }

  const handleSubmit = async () => {
    setError(null)
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    const budgetNum = Number(budget)
    if (!Number.isFinite(budgetNum) || budgetNum < 0) {
      setError('Budget must be a non-negative number')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        headId: headId || null,
        budget: budgetNum,
        description: description.trim() || null,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save department')
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
            className="fixed inset-0 z-50 flex items-start justify-center pt-16 pb-10 px-4 overflow-y-auto"
          >
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-neutral-200/60 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">
                    {existing ? `Edit ${existing.name}` : 'New department'}
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {existing ? 'Update department details.' : 'Group people, tasks, and OKRs under a team.'}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Engineering"
                    className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Head</label>
                  <select
                    value={headId}
                    onChange={(e) => setHeadId(e.target.value)}
                    className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    <option value="">— None —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                        {u.role ? ` · ${u.role}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-2xs text-neutral-400">Department lead — used for OKR ownership and notifications.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Quarterly budget (USD)</label>
                  <input
                    type="number"
                    min={0}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full h-9 px-3 text-sm font-mono bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What this team does"
                    rows={3}
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

              {/* Footer */}
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
                  {submitting ? 'Saving…' : existing ? 'Save changes' : 'Create department'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
