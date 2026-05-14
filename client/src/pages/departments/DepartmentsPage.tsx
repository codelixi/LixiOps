import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, RefreshCw, AlertTriangle, Trash2, Edit3, Loader2 } from 'lucide-react'
import { Card, Badge, Avatar, ProgressBar, Button } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useDepartments } from '@/hooks/useDepartments'
import { useUsers } from '@/hooks/useUsers'
import { useAuthStore } from '@/stores/useAuthStore'
import type { DepartmentAggregate, DeptStatus } from '@/hooks/useDepartments'
import { DepartmentFormModal } from './DepartmentFormModal'

const statusMap: Record<DeptStatus, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  healthy: { label: 'Healthy', variant: 'success' },
  'needs-attention': { label: 'Needs Attention', variant: 'warning' },
  critical: { label: 'Critical', variant: 'danger' },
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

export function DepartmentsPage() {
  const role = useAuthStore((s) => s.user?.role)
  const isPrivileged = role === 'CEO' || role === 'MANAGER'
  const isCEO = role === 'CEO'
  const { departments, loading, usingFallback, refresh, createDepartment, updateDepartment, deleteDepartment } =
    useDepartments()
  const { users } = useUsers()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DepartmentAggregate | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const totalMembers = departments.reduce((s, d) => s + d.members, 0)
  const avgUtilization =
    departments.length > 0
      ? Math.round(departments.reduce((s, d) => s + d.utilization, 0) / departments.length)
      : 0
  const totalBudget = departments.reduce((s, d) => s + d.budget, 0)
  const avgOkrProgress =
    departments.length > 0
      ? Math.round(departments.reduce((s, d) => s + d.okrProgress, 0) / departments.length)
      : 0

  const handleDelete = async (d: DepartmentAggregate) => {
    if (!window.confirm(`Delete department "${d.name}"? This cannot be undone.`)) return
    setPageError(null)
    setDeletingId(d.id)
    try {
      await deleteDepartment(d.id)
    } catch (err: any) {
      setPageError(err?.message ?? 'Failed to delete department')
    } finally {
      setDeletingId(null)
    }
  }

  const handleEdit = (d: DepartmentAggregate) => {
    setEditing(d)
    setFormOpen(true)
  }

  const handleCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Departments</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Organizational overview across all teams
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
            {loading && !usingFallback && (
              <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin text-neutral-400" />
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={refresh}>
            Refresh
          </Button>
          {isPrivileged && (
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={handleCreate}>
              New Department
            </Button>
          )}
        </div>
      </div>

      {pageError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-50 border border-danger-200 text-xs text-danger-700">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          {pageError}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Departments</p>
          <p className="text-2xl font-bold text-neutral-900">{departments.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Members</p>
          <p className="text-2xl font-bold text-neutral-900">{totalMembers}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Avg Utilization</p>
          <p className={`text-2xl font-bold ${avgUtilization > 90 ? 'text-danger-600' : avgUtilization > 85 ? 'text-warning-600' : 'text-success-600'}`}>
            {avgUtilization}%
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Avg OKR Progress</p>
          <p className={`text-2xl font-bold ${avgOkrProgress >= 60 ? 'text-success-600' : avgOkrProgress >= 30 ? 'text-warning-600' : 'text-danger-600'}`}>
            {avgOkrProgress}%
          </p>
          <p className="text-2xs text-neutral-400 mt-1">budget: {formatCurrency(totalBudget)}</p>
        </Card>
      </div>

      {/* Department list */}
      {departments.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <p className="text-sm text-neutral-500">No departments yet.</p>
            {isPrivileged && (
              <div className="mt-4 inline-flex">
                <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={handleCreate}>
                  Create your first department
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {departments.map((d) => {
            const status = statusMap[d.status]
            return (
              <motion.div key={d.id} variants={staggerItem}>
                <Card hover>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-base font-semibold text-neutral-900">{d.name}</h3>
                        <Badge variant={status.variant} dot>
                          {status.label}
                        </Badge>
                      </div>
                      {d.description && (
                        <p className="text-xs text-neutral-500">{d.description}</p>
                      )}
                    </div>
                    {isPrivileged && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleEdit(d)}
                          className="h-7 w-7 flex items-center justify-center text-neutral-400 hover:text-brand-600 hover:bg-brand-50 rounded cursor-pointer"
                          aria-label="Edit"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        {isCEO && (
                          <button
                            onClick={() => handleDelete(d)}
                            disabled={deletingId === d.id}
                            className="h-7 w-7 flex items-center justify-center text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded cursor-pointer disabled:opacity-50"
                            aria-label="Delete"
                          >
                            {deletingId === d.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Head + members */}
                  <div className="flex items-center justify-between mb-4 py-3 border-y border-neutral-100">
                    <div className="flex items-center gap-2">
                      {d.head ? (
                        <>
                          <Avatar name={d.head.name} size="sm" />
                          <div>
                            <p className="text-xs font-medium text-neutral-800">{d.head.name}</p>
                            <p className="text-2xs text-neutral-400 uppercase tracking-wider">{d.head.role}</p>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-neutral-400 italic">No head assigned</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-neutral-900">{d.members}</p>
                      <p className="text-2xs text-neutral-400 uppercase tracking-wider">members</p>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <p className="text-2xs text-neutral-400 uppercase tracking-wider mb-0.5">Active</p>
                      <p className="text-sm font-semibold text-neutral-900">{d.activeProjects} proj</p>
                    </div>
                    <div>
                      <p className="text-2xs text-neutral-400 uppercase tracking-wider mb-0.5">Budget</p>
                      <p className="text-sm font-semibold text-neutral-900">{formatCurrency(d.budget)}</p>
                    </div>
                    <div>
                      <p className="text-2xs text-neutral-400 uppercase tracking-wider mb-0.5">Utilization</p>
                      <p className={`text-sm font-semibold ${d.utilization > 90 ? 'text-danger-600' : d.utilization > 85 ? 'text-warning-600' : 'text-success-600'}`}>
                        {d.utilization}%
                      </p>
                    </div>
                  </div>

                  {/* OKR progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-2xs font-medium text-neutral-500 uppercase tracking-wider">OKR Progress</span>
                      <span className="text-xs font-medium text-neutral-700">{d.okrProgress}%</span>
                    </div>
                    <ProgressBar
                      value={d.okrProgress}
                      size="sm"
                      color={d.okrProgress >= 70 ? 'success' : d.okrProgress >= 40 ? 'brand' : 'danger'}
                    />
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      <DepartmentFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        existing={editing}
        users={users}
        onSubmit={async (payload) => {
          if (editing) await updateDepartment(editing.id, payload)
          else await createDepartment(payload)
        }}
      />
    </div>
  )
}
