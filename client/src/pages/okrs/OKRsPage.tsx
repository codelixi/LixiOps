import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Target, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Card, Badge, Avatar, ProgressBar, Button } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useOKRs, krProgress, okrProgress, okrStatus } from '@/hooks/useOKRs'
import type { OKR, KeyResult, OKRStatus } from '@/hooks/useOKRs'
import { useDepartments } from '@/hooks/useDepartments'
import { CreateOKRModal } from './CreateOKRModal'

// Pick the current quarter from today's date so the page lands on
// the most relevant view automatically.
function currentQuarter(): { quarter: string; year: number } {
  const d = new Date()
  return { quarter: `Q${Math.floor(d.getMonth() / 3) + 1}`, year: d.getFullYear() }
}

const STATUS_MAP: Record<OKRStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' }> = {
  achieved: { label: 'Achieved', variant: 'info' },
  healthy: { label: 'On Track', variant: 'success' },
  'on-track': { label: 'Behind', variant: 'warning' },
  'at-risk': { label: 'At Risk', variant: 'danger' },
}

function progressBarColor(progress: number): 'success' | 'brand' | 'danger' {
  if (progress >= 70) return 'success'
  if (progress >= 40) return 'brand'
  return 'danger'
}

function krBarColor(progress: number): 'success' | 'info' | 'warning' | 'danger' {
  if (progress >= 80) return 'success'
  if (progress >= 50) return 'info'
  if (progress >= 25) return 'warning'
  return 'danger'
}

function formatKRValue(value: number, unit: string): string {
  // $-prefix for currency, % suffix for percent, plain otherwise.
  if (unit === '$' || unit === 'USD') {
    if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
    return `$${value}`
  }
  if (unit === '%') return `${value}%`
  // Numeric units like "deals", "hires" — append after value
  if (unit && unit.length > 0 && !/^[$%]/.test(unit)) return `${value} ${unit}`
  return `${value}`
}

function KRRow({
  kr,
  onUpdate,
  onDelete,
}: {
  kr: KeyResult
  onUpdate: (krId: string, current: number) => Promise<void>
  onDelete: (krId: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(kr.current))
  const [saving, setSaving] = useState(false)
  const progress = krProgress(kr)

  const commit = async () => {
    const next = Number(draft)
    if (!Number.isFinite(next) || next < 0) {
      setDraft(String(kr.current))
      setEditing(false)
      return
    }
    if (next === kr.current) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onUpdate(kr.id, next)
    } catch {
      setDraft(String(kr.current))
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  return (
    <div className="space-y-1.5 group">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-neutral-700 flex-1 min-w-0 truncate">{kr.title}</span>
        <div className="flex items-center gap-2 text-xs">
          {editing ? (
            <input
              type="number"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') {
                  setDraft(String(kr.current))
                  setEditing(false)
                }
              }}
              disabled={saving}
              className="w-16 h-6 px-1.5 text-xs text-right font-mono bg-white border border-brand-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="font-mono text-neutral-500 hover:text-neutral-900 hover:underline cursor-pointer"
            >
              {formatKRValue(kr.current, kr.unit)}
            </button>
          )}
          <span className="text-neutral-400">/ {formatKRValue(kr.target, kr.unit)}</span>
          <span className="font-medium text-neutral-700 w-10 text-right">{progress}%</span>
          <button
            onClick={() => {
              if (window.confirm(`Delete KR "${kr.title}"?`)) void onDelete(kr.id)
            }}
            className="h-5 w-5 flex items-center justify-center text-neutral-300 hover:text-danger-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            aria-label="Delete KR"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <ProgressBar value={progress} size="sm" color={krBarColor(progress)} />
    </div>
  )
}

export function OKRsPage() {
  const start = currentQuarter()
  const [quarter, setQuarter] = useState(start.quarter)
  const [year, setYear] = useState(start.year)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)

  const { okrs, usingFallback, refresh, createOKR, deleteOKR, updateKRCurrent, deleteKR } =
    useOKRs({ year, quarter })
  const { departments } = useDepartments()

  // Default-expand all OKRs on first load
  useMemo(() => {
    if (expanded.size === 0 && okrs.length > 0) {
      setExpanded(new Set(okrs.map((o) => o.id)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [okrs])

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Aggregates
  const withProgress = okrs.map((o) => ({ okr: o, progress: okrProgress(o), status: okrStatus(okrProgress(o)) }))
  const avgProgress =
    withProgress.length > 0
      ? Math.round(withProgress.reduce((s, x) => s + x.progress, 0) / withProgress.length)
      : 0
  const healthy = withProgress.filter((x) => x.status === 'healthy' || x.status === 'achieved').length
  const atRisk = withProgress.filter((x) => x.status === 'at-risk').length

  const handleDeleteOKR = async (okr: OKR) => {
    if (!window.confirm(`Delete OKR "${okr.objective}"? This removes all key results too.`)) return
    try {
      await deleteOKR(okr.id)
    } catch (err: any) {
      window.alert(err?.message ?? 'Failed to delete OKR')
    }
  }

  const yearOptions = [year - 1, year, year + 1]
  const quarterOptions = ['Q1', 'Q2', 'Q3', 'Q4']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-5 w-5 text-brand-500" />
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">OKRs</h1>
          </div>
          <p className="text-sm text-neutral-500">
            Objectives & Key Results · {quarter} {year}
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-neutral-100 rounded-lg p-0.5">
            {quarterOptions.map((q) => (
              <button
                key={q}
                onClick={() => setQuarter(q)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  quarter === q ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-8 px-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
            New OKR
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Objectives</p>
          <p className="text-2xl font-bold text-neutral-900">{okrs.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Avg Progress</p>
          <p className={`text-2xl font-bold ${avgProgress >= 60 ? 'text-success-600' : avgProgress >= 30 ? 'text-warning-600' : 'text-danger-600'}`}>
            {avgProgress}%
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Healthy</p>
          <p className="text-2xl font-bold text-success-600">{healthy}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">At Risk</p>
          <p className="text-2xl font-bold text-danger-600">{atRisk}</p>
        </Card>
      </div>

      {/* List */}
      {okrs.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <Target className="h-6 w-6 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">No objectives set for {quarter} {year} yet.</p>
            <p className="text-xs text-neutral-400 mt-1">
              An OKR aligns the team. Start with one ambitious, measurable goal.
            </p>
            <div className="mt-4 inline-flex">
              <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
                Create your first OKR
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
          {withProgress.map(({ okr, progress, status }) => {
            const isExpanded = expanded.has(okr.id)
            const statusCfg = STATUS_MAP[status]
            return (
              <motion.div key={okr.id} variants={staggerItem}>
                <Card>
                  {/* Objective header */}
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => toggle(okr.id)}
                      className="flex items-start gap-3 cursor-pointer flex-1 min-w-0 text-left"
                    >
                      <div className="mt-0.5">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-neutral-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-neutral-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Target className="h-4 w-4 text-brand-500 flex-shrink-0" />
                          <h3 className="text-sm font-semibold text-neutral-900">{okr.objective}</h3>
                          <Badge variant={statusCfg.variant} dot>
                            {statusCfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          <span>{okr.department?.name ?? 'Unassigned'}</span>
                          <span className="text-neutral-300">·</span>
                          <span>{okr.quarter} {okr.year}</span>
                          {okr.owner && (
                            <>
                              <span className="text-neutral-300">·</span>
                              <Avatar name={okr.owner.name} size="xs" />
                              <span>{okr.owner.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-lg font-bold text-neutral-900">{progress}%</span>
                      <button
                        onClick={() => handleDeleteOKR(okr)}
                        className="h-7 w-7 flex items-center justify-center text-neutral-300 hover:text-danger-600 hover:bg-danger-50 rounded cursor-pointer"
                        aria-label="Delete OKR"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Overall progress */}
                  <div className="mt-3 ml-7">
                    <ProgressBar value={progress} color={progressBarColor(progress)} />
                  </div>

                  {/* Key results */}
                  {isExpanded && (
                    <div className="mt-4 ml-7 space-y-3 border-t border-neutral-100 pt-4">
                      {okr.keyResults.length === 0 ? (
                        <p className="text-xs text-neutral-400">No key results yet — add one to track progress.</p>
                      ) : (
                        okr.keyResults.map((kr) => (
                          <KRRow key={kr.id} kr={kr} onUpdate={updateKRCurrent} onDelete={deleteKR} />
                        ))
                      )}
                    </div>
                  )}
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      <CreateOKRModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refresh}
        departments={departments}
        defaultQuarter={quarter}
        defaultYear={year}
        createOKR={createOKR}
      />
    </div>
  )
}
