import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
import type { ArticleFull } from '@/hooks/useKnowledge'

interface ArticleEditorProps {
  open: boolean
  onClose: () => void
  existing: ArticleFull | null
  knownCategories: string[]
  onSubmit: (payload: { title: string; content: string; category: string }) => Promise<void>
}

export function ArticleEditor({ open, onClose, existing, knownCategories, onSubmit }: ArticleEditorProps) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (existing) {
      setTitle(existing.title)
      setCategory(existing.category)
      setContent(existing.content)
    } else {
      setTitle('')
      setCategory(knownCategories[0] ?? 'Operations')
      setContent('')
    }
    setError(null)
  }, [open, existing, knownCategories])

  const handleClose = () => {
    if (submitting) return
    onClose()
  }

  const handleSubmit = async () => {
    setError(null)
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!content.trim()) {
      setError('Content is required')
      return
    }
    if (!category.trim()) {
      setError('Category is required')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({ title: title.trim(), content, category: category.trim() })
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save')
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
            className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10 px-4 overflow-y-auto"
          >
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-neutral-200/60 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">
                    {existing ? 'Edit article' : 'New article'}
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Capture what's currently in someone's head. Markdown supported (plain text rendered as-is).
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

              <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Client Onboarding Checklist"
                    className="w-full h-10 px-3 text-base font-medium bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    list="kb-categories"
                    placeholder="e.g. Operations, Development, Sales"
                    className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                  <datalist id="kb-categories">
                    {knownCategories.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Content</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write the article…"
                    rows={14}
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-y"
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
                  {submitting ? 'Saving…' : existing ? 'Save changes' : 'Publish'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
