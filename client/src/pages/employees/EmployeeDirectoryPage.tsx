import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Briefcase, Clock, Mail, Phone, RefreshCw, Loader2 } from 'lucide-react'
import { Button, Badge, Card, Avatar } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useEmployees } from '@/hooks/useEmployees'
import type { EmployeeStatus } from '@/hooks/useEmployees'

const statusMap: Record<EmployeeStatus, { label: string; variant: 'success' | 'warning' | 'info' | 'default'; avatar: 'online' | 'away' | 'offline' }> = {
  active: { label: 'Active', variant: 'success', avatar: 'online' },
  away: { label: 'Away', variant: 'warning', avatar: 'away' },
  'on-leave': { label: 'On Leave', variant: 'info', avatar: 'away' },
  inactive: { label: 'Inactive', variant: 'default', avatar: 'offline' },
}

function formatJoinDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function EmployeeDirectoryPage() {
  const navigate = useNavigate()
  const { stats, departments, employees, loading, usingFallback, refresh } = useEmployees()
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState<string>('All')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return employees.filter((e) => {
      const matchesDept =
        deptFilter === 'All' || e.department?.name === deptFilter
      const matchesQ =
        !q || e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
      return matchesDept && matchesQ
    })
  }, [employees, search, deptFilter])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Team Directory</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {stats.total} team members across {departments.length} department{departments.length === 1 ? '' : 's'}
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
            {loading && !usingFallback && (
              <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin text-neutral-400" />
            )}
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={refresh}>
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Team</p>
          <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Active Now</p>
          <p className="text-2xl font-bold text-success-600">{stats.active}</p>
          <p className="text-2xs text-neutral-400 mt-1">logged in &lt; 24h</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Away / On Leave</p>
          <p className="text-2xl font-bold text-warning-600">{stats.away + stats.onLeave}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Avg Hours / Week</p>
          <p className="text-2xl font-bold text-neutral-900">{stats.avgHoursThisWeek}h</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setDeptFilter('All')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
              deptFilter === 'All' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            All <span className="opacity-60 ml-1">{stats.total}</span>
          </button>
          {departments.map((d) => (
            <button
              key={d.id}
              onClick={() => setDeptFilter(d.name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                deptFilter === d.name ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {d.name} <span className="opacity-60 ml-1">{d.count}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by name, role, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-72 transition-all"
          />
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500 text-center py-12">
            {employees.length === 0 ? 'No team members yet.' : 'No one matches your search.'}
          </p>
        </Card>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
        >
          {filtered.map((emp) => {
            const status = statusMap[emp.status]
            return (
              <motion.div key={emp.id} variants={staggerItem} onClick={() => navigate(`/employees/${emp.id}`)}>
                <Card hover className="cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={emp.name} size="lg" status={status.avatar} />
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-neutral-900 truncate">{emp.name}</h3>
                        <p className="text-xs text-neutral-500">{emp.role}</p>
                      </div>
                    </div>
                    <Badge variant={status.variant} dot>
                      {status.label}
                    </Badge>
                  </div>

                  <div className="space-y-2.5 mb-4">
                    <div className="flex items-center gap-2 text-xs text-neutral-600">
                      <Briefcase className="h-3.5 w-3.5 text-neutral-400" />
                      <span>{emp.department?.name ?? 'Unassigned'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-600">
                      <Mail className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                    {emp.phone && (
                      <div className="flex items-center gap-2 text-xs text-neutral-600">
                        <Phone className="h-3.5 w-3.5 text-neutral-400" />
                        <span>{emp.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-neutral-600">
                      <Clock className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="truncate">{emp.currentTask ?? 'No active task'}</span>
                    </div>
                  </div>

                  <div className="border-t border-neutral-100 pt-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[10px] font-medium text-neutral-400 uppercase">Hours</p>
                        <p className="text-sm font-semibold text-neutral-900">{emp.hoursThisWeek}h</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-neutral-400 uppercase">Since</p>
                        <p className="text-sm font-semibold text-neutral-900">{formatJoinDate(emp.joinDate)}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
