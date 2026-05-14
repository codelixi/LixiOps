import { motion } from 'framer-motion'
import {
  CheckCircle2, MessageSquare, DollarSign, Zap, FileText, Activity as ActivityIcon,
} from 'lucide-react'
import { Card } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useActivity, formatRelative } from '@/hooks/useActivity'
import type { ActivityCategory } from '@/hooks/useActivity'

const categoryIcon: Record<ActivityCategory, { icon: React.ReactNode; color: string }> = {
  task: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-success-50 text-success-600' },
  comment: { icon: <MessageSquare className="h-4 w-4" />, color: 'bg-info-50 text-info-600' },
  invoice: { icon: <DollarSign className="h-4 w-4" />, color: 'bg-success-50 text-success-600' },
  lead: { icon: <Zap className="h-4 w-4" />, color: 'bg-brand-50 text-brand-500' },
  project: { icon: <FileText className="h-4 w-4" />, color: 'bg-info-50 text-info-600' },
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isYesterday(iso: string): boolean {
  const d = new Date(iso)
  const y = new Date()
  y.setDate(y.getDate() - 1)
  return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()
}

export function ActivityFeedPage() {
  const { events, usingFallback } = useActivity()

  // Stats — derived from the live stream
  const tasksCompletedToday = events.filter((e) => e.category === 'task' && e.action.startsWith('completed') && isToday(e.timestamp)).length
  const commentsToday = events.filter((e) => e.category === 'comment' && isToday(e.timestamp)).length
  const invoicesToday = events.filter((e) => e.category === 'invoice' && isToday(e.timestamp)).length
  const leadActivityToday = events.filter((e) => e.category === 'lead' && isToday(e.timestamp)).length

  // Group by Today / Yesterday / Earlier
  const today: typeof events = []
  const yesterday: typeof events = []
  const earlier: typeof events = []
  for (const e of events) {
    if (isToday(e.timestamp)) today.push(e)
    else if (isYesterday(e.timestamp)) yesterday.push(e)
    else earlier.push(e)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ActivityIcon className="h-5 w-5 text-brand-500" />
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Activity Feed</h1>
        </div>
        <p className="text-sm text-neutral-500">
          Real-time updates across your organization
          {usingFallback && (
            <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Tasks Completed Today</p>
          <p className="text-2xl font-bold text-neutral-900">{tasksCompletedToday}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Comments Today</p>
          <p className="text-2xl font-bold text-info-600">{commentsToday}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Invoice Events Today</p>
          <p className="text-2xl font-bold text-success-600">{invoicesToday}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Sales Activity Today</p>
          <p className="text-2xl font-bold text-brand-500">{leadActivityToday}</p>
        </Card>
      </div>

      {/* Empty state */}
      {events.length === 0 && (
        <Card>
          <p className="text-sm text-neutral-500 text-center py-12">No activity yet — events will appear here as your team works.</p>
        </Card>
      )}

      {/* Sections */}
      {[
        { title: 'Today', items: today },
        { title: 'Yesterday', items: yesterday },
        { title: 'Earlier', items: earlier },
      ]
        .filter((s) => s.items.length > 0)
        .map((section) => (
          <Card key={section.title}>
            <h2 className="text-sm font-semibold text-neutral-900 mb-6">{section.title}</h2>
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="relative"
            >
              {/* Vertical line */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-neutral-100" />

              {section.items.map((event) => {
                const cat = categoryIcon[event.category]
                return (
                  <motion.div
                    key={event.id}
                    variants={staggerItem}
                    className="relative flex items-start gap-4 pb-6 last:pb-0"
                  >
                    {/* Icon */}
                    <div className={`relative z-10 flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${cat.color}`}>
                      {cat.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-neutral-900">{event.user ?? 'System'}</span>
                        <span className="text-sm text-neutral-500">{event.action}</span>
                        <span className="text-sm font-medium text-neutral-700">{event.target}</span>
                      </div>
                      {event.detail && (
                        <p className="text-xs text-neutral-500 mt-0.5 truncate">{event.detail}</p>
                      )}
                    </div>

                    {/* Time */}
                    <span className="flex-shrink-0 text-xs text-neutral-400 pt-1">{formatRelative(event.timestamp)}</span>
                  </motion.div>
                )
              })}
            </motion.div>
          </Card>
        ))}
    </div>
  )
}
