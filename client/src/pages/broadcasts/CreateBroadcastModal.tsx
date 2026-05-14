import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
import type { BroadcastType, RecipientType } from '@/hooks/useBroadcasts'
import type { DepartmentAggregate } from '@/hooks/useDepartments'
import type { CommentAuthor } from '@/components/comments/CommentsPanel'

const TYPE_OPTIONS: { value: BroadcastType; label: string; description: string }[] = [
  { value: 'announcement', label: 'Announcement', description: 'Standard company-wide news' },
  { value: 'update', label: 'Update', description: 'Operational status update' },
  { value: 'urgent', label: 'Urgent', description: 'Time-sensitive — recipients get a louder ping' },
]

interface CreateBroadcastModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (payload: {
    type: BroadcastType
    message: string
    recipientType: RecipientType
    recipientId?: string
    isPinned?: boolean
    requiresAck?: boolean
  }) => Promise<void>
  departments: DepartmentAggregate[]
  users: CommentAuthor[]
}

export function CreateBroadcastModal({ open, onClose, onSubmit, departments, users }: CreateBroadcastModalProps) {
  const [type, setType] = useState<BroadcastType>('announcement')
  const [message, setMessage] = useState('')
  const [recipientType, setRecipientType] = useState<RecipientType>('all')
  const [recipientId, setRecipientId] = useState<string>('')
  const [isPinned, setIsPinned] = useState(false)
  const [requiresAck, setRequiresAck] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setType('announcement')
    setMessage('')
    setRecipientType('all')
    setRecipientId('')
    setIsPinned(false)
    setRequiresAck(false)
    setError(null)
  }, [open])

  const handleClose = () => {
    if (submitting) return
    onClose()
  }

  const handleSubmit = async () => {
    setError(null)
    if (!message.trim()) {
      setError('Message is required')
      return
    }
    if (recipientType !== 'all' && !recipientId) {
      setError(`Pick a ${recipientType}`)
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        type,
        message: message.trim(),
        recipientType,
        recipientId: recipientType === 'all' ? undefined : recipientId,
        isPinned,
        requiresAck,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send broadcast')
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
                  <h2 className="text-base font-semibold text-neutral-900">New broadcast</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Recipients will be notified instantly. Pinned broadcasts stay at the top of the feed.
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

              <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as BroadcastType)}
                    className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-2xs text-neutral-400">
                    {TYPE_OPTIONS.find((t) => t.value === type)?.description}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Audience</label>
                  <div className="flex gap-2">
                    {(['all', 'department', 'individual'] as RecipientType[]).map((rt) => (
                      <button
                        key={rt}
                        type="button"
                        onClick={() => {
                          setRecipientType(rt)
                          setRecipientId('')
                        }}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          recipientType === rt
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        {rt === 'all' ? 'Everyone' : rt === 'department' ? 'Department' : 'One person'}
                      </button>
                    ))}
                  </div>

                  {recipientType === 'department' && (
                    <select
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value)}
                      className="mt-3 w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    >
                      <option value="">— Pick a department —</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name} ({d.members} members)</option>
                      ))}
                    </select>
                  )}
                  {recipientType === 'individual' && (
                    <select
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value)}
                      className="mt-3 w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    >
                      <option value="">— Pick a person —</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What does the team need to know?"
                    rows={5}
                    className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-xs text-neutral-700">Pin to top of feed</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresAck}
                      onChange={(e) => setRequiresAck(e.target.checked)}
                      className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-xs text-neutral-700">Require acknowledgement from each recipient</span>
                  </label>
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
                  {submitting ? 'Sending…' : 'Send broadcast'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
