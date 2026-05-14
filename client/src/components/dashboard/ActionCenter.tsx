import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, Clock, DollarSign, ArrowRight, Zap, CheckCircle2, RefreshCw } from 'lucide-react'
import { useNotifications, type NotificationItem } from '@/hooks/useNotifications'
import { staggerContainer, staggerItem } from '@/lib/motion'

// Action tiles map notification types → decision CTAs.
// The rule: every metric you see must answer "what should I do next?"
const ACTION_DEFS: Array<{
  key: string
  types: string[]
  label: string
  cta: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
  accentBg: string
  route: string
}> = [
  {
    key: 'overdue-invoices',
    types: ['invoice_overdue'],
    label: 'Invoices overdue',
    cta: 'Send reminders',
    icon: DollarSign,
    accent: 'text-danger-600',
    accentBg: 'bg-danger-50 border-danger-100',
    route: '/invoicing',
  },
  {
    key: 'stale-leads',
    types: ['lead_stale'],
    label: 'Stale leads',
    cta: 'Nudge or mark Lost',
    icon: Clock,
    accent: 'text-warning-700',
    accentBg: 'bg-warning-50 border-warning-100',
    route: '/sales',
  },
  {
    key: 'past-due-projects',
    types: ['project_past_due'],
    label: 'Projects past due',
    cta: 'Update status',
    icon: AlertTriangle,
    accent: 'text-danger-600',
    accentBg: 'bg-danger-50 border-danger-100',
    route: '/projects',
  },
  {
    key: 'due-soon',
    types: ['milestone_due_soon', 'invoice_due_soon'],
    label: 'Due in 3 days',
    cta: 'Review & plan',
    icon: Zap,
    accent: 'text-brand-600',
    accentBg: 'bg-brand-50 border-brand-100',
    route: '/projects',
  },
]

function countByTypes(items: NotificationItem[], types: string[]): number {
  return items.filter((n) => types.includes(n.type) && !n.isRead).length
}

export function ActionCenter() {
  const { items, loading, refresh, usingFallback } = useNotifications()
  const navigate = useNavigate()

  const tiles = useMemo(
    () =>
      ACTION_DEFS.map((def) => ({
        ...def,
        count: countByTypes(items, def.types),
      })),
    [items],
  )

  const totalActions = tiles.reduce((sum, t) => sum + t.count, 0)
  const clear = !loading && totalActions === 0

  return (
    <motion.section
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-neutral-900 text-white p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-brand-400" />
            <h2 className="text-sm font-semibold tracking-tight">Today's Action Center</h2>
            {usingFallback && <span className="text-[10px] text-neutral-500 italic">demo</span>}
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            {clear
              ? 'Nothing needs a decision right now.'
              : `${totalActions} item${totalActions === 1 ? '' : 's'} waiting on your call.`}
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          className="text-xs text-neutral-400 hover:text-white cursor-pointer flex items-center gap-1.5 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {clear ? (
        <div className="flex items-center gap-2 text-xs text-success-400 py-4">
          <CheckCircle2 className="h-4 w-4" />
          You're clear. Ship something.
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {tiles.map((tile) => {
            const Icon = tile.icon
            const disabled = tile.count === 0
            return (
              <motion.button
                key={tile.key}
                variants={staggerItem}
                disabled={disabled}
                onClick={() => navigate(tile.route)}
                className={`group text-left rounded-lg border p-4 transition-all ${
                  disabled
                    ? 'bg-neutral-800 border-neutral-800 text-neutral-600 cursor-not-allowed'
                    : `${tile.accentBg} border-opacity-60 hover:border-opacity-100 cursor-pointer hover:-translate-y-0.5`
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${disabled ? 'text-neutral-600' : tile.accent}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className={`text-2xl font-bold ${disabled ? 'text-neutral-600' : 'text-neutral-900'}`}>{tile.count}</span>
                </div>
                <p className={`text-xs font-medium mt-3 ${disabled ? 'text-neutral-600' : 'text-neutral-800'}`}>{tile.label}</p>
                <div className={`mt-2 flex items-center justify-between text-[11px] font-medium ${disabled ? 'text-neutral-700' : tile.accent}`}>
                  <span>{tile.cta}</span>
                  {!disabled && <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />}
                </div>
              </motion.button>
            )
          })}
        </motion.div>
      )}
    </motion.section>
  )
}
