import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
import type { DocumentFull, DocumentStatus, DocumentType } from '@/hooks/useDocuments'

const TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'contract', label: 'Contract' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'template', label: 'Template' },
  { value: 'report', label: 'Report' },
  { value: 'policy', label: 'Policy' },
  { value: 'other', label: 'Other' },
]

const STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'signed', label: 'Signed' },
  { value: 'expired', label: 'Expired' },
]

interface ClientLite {
  id: string
  company: string
}

interface DocumentEditorProps {
  open: boolean
  onClose: () => void
  existing: DocumentFull | null
  clients: ClientLite[]
  onSubmit: (payload: {
    title: string
    type: DocumentType
    content?: string
    clientId?: string | null
    status?: DocumentStatus
  }) => Promise<void>
}

export function DocumentEditor({ open, onClose, existing, clients, onSubmit }: DocumentEditorProps) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<DocumentType>('contract')
  const [status, setStatus] = useState<DocumentStatus>('draft')
  const [clientId, setClientId] = useState<string>('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (existing) {
      setTitle(existing.title)
      setType(existing.type)
      setStatus(existing.status)
      setClientId(existing.clientId ?? '')
      setContent(existing.content ?? '')
    } else {
      setTitle('')
      setType('contract')
      setStatus('draft')
      setClientId('')
      setContent('')
    }
    setError(null)
  }, [open, existing])

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
    setSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        type,
        status,
        clientId: clientId || null,
        content: content,
      })
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
            className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto"
          >
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-neutral-200/60 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">
                    {existing ? `Edit · v${existing.version}` : 'New document'}
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {existing ? 'Editing bumps the version on content change.' : 'Capture contracts, proposals, and policies inline.'}
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
                    placeholder="e.g. Service Agreement — Bella Cucina"
                    className="w-full h-10 px-3 text-base font-medium bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Type</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as DocumentType)}
                      className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    >
                      {TYPE_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as DocumentStatus)}
                      className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
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
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Content</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write the document body…"
                    rows={18}
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
                  {submitting ? 'Saving…' : existing ? 'Save changes' : 'Create document'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
