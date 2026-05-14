import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  DollarSign,
  FolderKanban,
  Receipt,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  MoreHorizontal,
  Megaphone,
} from 'lucide-react'
import { Card, Badge, Avatar, ProgressBar, Button } from '@/components/ui'
import { staggerContainer, fadeInUp } from '@/lib/motion'
import { ActionCenter } from '@/components/dashboard/ActionCenter'
import { useDashboard } from '@/hooks/useDashboard'
import { useAuthStore } from '@/stores/useAuthStore'

const healthMap = {
  'on-track': { label: 'On Track', variant: 'success' as const },
  'at-risk': { label: 'At Risk', variant: 'warning' as const },
  'delayed': { label: 'Delayed', variant: 'danger' as const },
}

// Cash formatter — compact for pipeline-sized totals, plain for invoices.
function money(n: number, compact = false) {
  if (compact && n >= 1000) {
    return '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K'
  }
  return '$' + n.toLocaleString()
}

function timeOfDayGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { metrics, projects, pulse, team, usingFallback } = useDashboard()
  const user = useAuthStore((s) => s.user)
  const firstName = user?.name?.split(' ')[0] || 'there'

  // Derived counts — drives the "3 overdue" / "2 new" sublines.
  const atRiskProjects = projects.filter((p) => p.health !== 'on-track').length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-neutral-900 tracking-tight"
          >
            {timeOfDayGreeting()}, {firstName}
          </motion.h1>
          <p className="text-sm text-neutral-500 mt-1">
            Here's what's happening across your business today.
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
          </p>
        </div>
        <Button variant="secondary" icon={<Megaphone className="h-4 w-4" />} onClick={() => navigate('/broadcasts')}>
          New Broadcast
        </Button>
      </div>

      {/* Action Center — every KPI answers "what now?" first */}
      <ActionCenter />

      {/* Metric Cards — each pairs a number with a Next Action */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        <Card hover className="cursor-pointer" onClick={() => navigate('/invoicing')}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Monthly Revenue</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{money(metrics.mrr)}</p>
              <p className={`text-xs mt-1 ${metrics.mrrChange >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {metrics.mrrChange >= 0 ? '+' : ''}{metrics.mrrChange}% vs last month
              </p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-500">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
            <span className="text-neutral-500">Next: review MRR mix</span>
            <span className="text-brand-500 font-medium flex items-center gap-1">Open <ArrowUpRight className="h-3 w-3" /></span>
          </div>
        </Card>

        <Card hover className="cursor-pointer" onClick={() => navigate('/projects')}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Active Projects</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{metrics.activeProjects}</p>
              <p className="text-xs text-neutral-500 mt-1">{metrics.newProjectsThisWeek} new this week</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-500">
              <FolderKanban className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
            <span className="text-neutral-500">Next: check {atRiskProjects} at-risk</span>
            <span className="text-brand-500 font-medium flex items-center gap-1">Open <ArrowUpRight className="h-3 w-3" /></span>
          </div>
        </Card>

        <Card hover className="cursor-pointer" onClick={() => navigate('/invoicing?filter=overdue')}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Open Invoices</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{money(metrics.openInvoices)}</p>
              <p className={`text-xs mt-1 ${metrics.invoiceChange <= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {metrics.invoiceChange >= 0 ? '+' : ''}{metrics.invoiceChange}% vs last week
              </p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-warning-50 flex items-center justify-center text-warning-600">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
            <span className="text-neutral-500">Next: send reminders</span>
            <span className="text-brand-500 font-medium flex items-center gap-1">Act now <ArrowUpRight className="h-3 w-3" /></span>
          </div>
        </Card>

        <Card hover className="cursor-pointer" onClick={() => navigate('/sales')}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Pipeline Value</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{money(142000, true)}</p>
              <p className="text-xs text-neutral-500 mt-1">{pulse.hotLeads} hot leads</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-success-50 flex items-center justify-center text-success-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
            <span className="text-neutral-500">Next: advance stuck deals</span>
            <span className="text-brand-500 font-medium flex items-center gap-1">Open <ArrowUpRight className="h-3 w-3" /></span>
          </div>
        </Card>
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Projects */}
        <Card className="lg:col-span-2" padding="none">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
            <div>
              <h3 className="text-sm font-semibold text-neutral-800">Active Projects</h3>
              <p className="text-xs text-neutral-500 mt-0.5">{projects.length} projects in progress</p>
            </div>
            <Button variant="ghost" size="sm" iconRight={<ArrowUpRight className="h-3.5 w-3.5" />} onClick={() => navigate('/projects')}>
              View All
            </Button>
          </div>
          <div className="divide-y divide-neutral-100">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-4 px-6 py-3.5 hover:bg-neutral-25 transition-colors cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-neutral-800 truncate">{project.name}</p>
                    <Badge
                      variant={healthMap[project.health].variant}
                      dot
                    >
                      {healthMap[project.health].label}
                    </Badge>
                  </div>
                  <p className="text-xs text-neutral-500">{project.client}</p>
                </div>
                <div className="w-32">
                  <ProgressBar
                    value={project.progress}
                    size="sm"
                    color={project.health === 'at-risk' ? 'warning' : project.health === 'delayed' ? 'danger' : 'brand'}
                    showLabel
                  />
                </div>
                <p className="text-sm font-medium text-neutral-700 w-20 text-right">{money(project.value)}</p>
              </motion.div>
            ))}
          </div>
        </Card>

        {/* Company Pulse Sidebar */}
        <div className="space-y-6">
          {/* Pulse */}
          <Card>
            <h3 className="text-sm font-semibold text-neutral-800 mb-4">Company Pulse</h3>
            <div className="space-y-4">
              {[
                { label: 'MRR', value: money(pulse.mrr), icon: DollarSign, color: 'text-success-600', path: '/invoicing' },
                { label: 'Open Invoices', value: money(pulse.openInvoices), icon: Receipt, color: 'text-warning-600', path: '/invoicing' },
                { label: 'Tasks In Progress', value: String(pulse.tasksInProgress), icon: CheckCircle2, color: 'text-brand-500', path: '/development' },
                { label: 'Hot Leads', value: String(pulse.hotLeads), icon: TrendingUp, color: 'text-info-600', path: '/sales' },
                { label: 'Overdue Bugs', value: String(pulse.overdueBugs), icon: AlertTriangle, color: 'text-danger-600', path: '/development' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between hover:bg-neutral-50 -mx-2 px-2 py-1 rounded-md cursor-pointer transition-colors" onClick={() => navigate(item.path)}>
                  <div className="flex items-center gap-2.5">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    <span className="text-sm text-neutral-600">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-neutral-800">{item.value}</span>
                </div>
              ))}
            </div>
            <p className="text-2xs text-neutral-400 mt-4">Refreshes every 60 seconds</p>
          </Card>

          {/* Pinned Broadcast */}
          <Card className="bg-brand-50/50 border-brand-200/40 cursor-pointer" hover onClick={() => navigate('/broadcasts')}>
            <div className="flex items-center gap-2 mb-3">
              <Megaphone className="h-4 w-4 text-brand-500" />
              <span className="text-xs font-semibold text-brand-500 uppercase tracking-wider">Pinned Broadcast</span>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">
              Team standup moved to 10:30 AM starting Monday. Please update your calendars.
            </p>
            <p className="text-xs text-neutral-400 mt-3">2 hours ago &middot; All Team</p>
          </Card>
        </div>
      </div>

      {/* Team Today */}
      <motion.div {...fadeInUp}>
        <Card padding="none">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
            <div>
              <h3 className="text-sm font-semibold text-neutral-800">Team Today</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Real-time team status and activity</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />
                Live
              </span>
              <Button variant="ghost" size="sm" onClick={() => navigate('/employees')}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="divide-y divide-neutral-100">
            {team.map((member, i) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="flex items-center gap-4 px-6 py-3.5 hover:bg-neutral-25 transition-colors"
              >
                <Avatar name={member.name} size="sm" status={member.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800">{member.name}</p>
                  <p className="text-xs text-neutral-500">{member.role}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-neutral-700">{member.task}</p>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <Clock className="h-3 w-3 text-neutral-400" />
                    <span className="text-xs text-neutral-500 font-mono">{member.hours}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
