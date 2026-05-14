import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, AlertTriangle, DollarSign, MessageSquare, AtSign, Calendar, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui'
import { useNotifications, type NotificationItem } from '@/hooks/useNotifications'

// Map Action Engine trigger types → icon + color
const typeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  invoice_overdue: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-danger-500' },
  invoice_due_soon: { icon: <DollarSign className="h-4 w-4" />, color: 'text-warning-500' },
  lead_stale: { icon: <Clock className="h-4 w-4" />, color: 'text-warning-500' },
  project_past_due: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-danger-500' },
  milestone_due_soon: { icon: <Calendar className="h-4 w-4" />, color: 'text-warning-500' },
  mention: { icon: <AtSign className="h-4 w-4" />, color: 'text-brand-500' },
  success: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-success-500' },
}

function iconFor(type: string) {
  return typeConfig[type] ?? { icon: <MessageSquare className="h-4 w-4" />, color: 'text-neutral-500' }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

export function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, unreadCount, loading, usingFallback, markRead, markAllRead, dismiss } = useNotifications()
  const navigate = useNavigate()

  function handleClick(n: NotificationItem) {
    if (!n.isRead) void markRead(n.id)
    if (n.link) {
      navigate(n.link)
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-14 right-0 z-50 w-96 bg-white rounded-xl shadow-2xl border border-neutral-200/60 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-900">Notifications</h3>
                {unreadCount > 0 && <Badge variant="danger">{unreadCount}</Badge>}
                {usingFallback && (
                  <span className="text-[10px] text-neutral-400 italic">demo</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-brand-500 hover:text-brand-600 font-medium cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="h-6 w-6 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-neutral-50">
              {loading && (
                <div className="px-4 py-8 text-center text-xs text-neutral-400">Loading…</div>
              )}
              {!loading && items.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <CheckCircle2 className="h-6 w-6 text-success-400 mx-auto mb-2" />
                  <p className="text-xs text-neutral-500">You're all caught up</p>
                </div>
              )}
              {items.map((n) => {
                const config = iconFor(n.type)
                return (
                  <div
                    key={n.id}
                    className={`group flex items-start gap-3 px-4 py-3 hover:bg-neutral-25 transition-colors ${
                      !n.isRead ? 'bg-brand-50/30' : ''
                    }`}
                  >
                    <div className={`flex-shrink-0 mt-0.5 ${config.color}`}>{config.icon}</div>
                    <button
                      onClick={() => handleClick(n)}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-neutral-900 truncate">{n.title}</p>
                        {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-brand-500 flex-shrink-0" />}
                      </div>
                      {n.message && (
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{n.message}</p>
                      )}
                      <p className="text-[10px] text-neutral-400 mt-1">{formatTime(n.createdAt)}</p>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void dismiss(n.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 rounded flex items-center justify-center text-neutral-300 hover:text-neutral-700 cursor-pointer"
                      title="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
