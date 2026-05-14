import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Calendar, Users } from 'lucide-react'
import { Button, Badge, Card, Avatar, ProgressBar } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useProjects } from '@/hooks/useProjects'

const statusMap = {
  active: { label: 'Active', variant: 'success' as const },
  completed: { label: 'Completed', variant: 'info' as const },
  'on-hold': { label: 'On Hold', variant: 'warning' as const },
  planning: { label: 'Planning', variant: 'default' as const },
}

const healthMap = {
  'on-track': { label: 'On Track', variant: 'success' as const },
  'at-risk': { label: 'At Risk', variant: 'warning' as const },
  delayed: { label: 'Delayed', variant: 'danger' as const },
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

export function ProjectListPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const { projects, usingFallback } = useProjects()

  const filtered = projects
    .filter((p) => filter === 'all' || p.status === filter)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase()))

  const totalBudget = projects.filter((p) => p.status === 'active').reduce((s, p) => s + p.budget, 0)
  const totalSpent = projects.filter((p) => p.status === 'active').reduce((s, p) => s + p.spent, 0)
  const activeCount = projects.filter((p) => p.status === 'active').length
  const budgetUsage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Projects</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Track progress and manage deliverables
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
          </p>
        </div>
        <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => navigate('/projects/new')}>
          New Project
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Active Projects</p>
          <p className="text-2xl font-bold text-neutral-900">{activeCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Budget</p>
          <p className="text-2xl font-bold text-neutral-900">{formatCurrency(totalBudget)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Spent</p>
          <p className="text-2xl font-bold text-neutral-900">{formatCurrency(totalSpent)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Budget Usage</p>
          <p className={`text-2xl font-bold ${budgetUsage > 85 ? 'text-danger-600' : 'text-success-600'}`}>
            {budgetUsage}%
          </p>
        </Card>
      </div>

      {/* Filters + Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {['all', 'active', 'planning', 'on-hold', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                filter === f ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {f === 'all' ? 'All' : f.replace('-', ' ')}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-64 transition-all"
          />
        </div>
      </div>

      {/* Project Cards */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-4"
      >
        {filtered.map((project) => (
          <motion.div key={project.id} variants={staggerItem} onClick={() => navigate(`/projects/${project.id}`)}>
            <Card hover className="cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-neutral-900">{project.name}</h3>
                    <Badge variant={statusMap[project.status].variant} dot>
                      {statusMap[project.status].label}
                    </Badge>
                    <Badge variant={healthMap[project.health].variant}>
                      {healthMap[project.health].label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span>{project.client}</span>
                    <span>·</span>
                    <span>{project.type}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-neutral-900">{formatCurrency(project.budget)}</p>
                  <p className="text-xs text-neutral-500">Spent {formatCurrency(project.spent)}</p>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-neutral-500">{project.tasksCompleted}/{project.tasksTotal} tasks</span>
                  <span className="text-xs font-medium text-neutral-700">{project.progress}%</span>
                </div>
                <ProgressBar
                  value={project.progress}
                  color={project.health === 'delayed' ? 'danger' : project.health === 'at-risk' ? 'warning' : 'brand'}
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{project.startDate} — {project.dueDate}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <Users className="h-3.5 w-3.5" />
                    <span>{project.teamSize} members</span>
                  </div>
                </div>
                <div className="flex -space-x-2">
                  {project.teamAvatars.slice(0, 4).map((name) => (
                    <Avatar key={name} name={name} size="xs" />
                  ))}
                  {project.teamAvatars.length > 4 && (
                    <div className="h-6 w-6 rounded-full bg-neutral-200 flex items-center justify-center text-[10px] font-medium text-neutral-600 ring-2 ring-white">
                      +{project.teamAvatars.length - 4}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
