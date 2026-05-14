import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
import type { DepartmentLite } from '@/hooks/useDepartments'

interface KRDraft {
  title: string
  target: string
  current: string
  unit: string
}

const DEFAULT_KR: KRDraft = { title: '', target: '', current: '0', unit: '%' }

interface CreateOKRModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  departments: DepartmentLite[]
  defaultQuarter: string
  defaultYear: number
  createOKR: (payload: {
    objective: string
    departmentId: string
    quarter: string
    year: number
    keyResults?: Array<{ title: string; target: number; current?: number; unit?: string }>
  }) => Promise<unknown>
}

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

export function CreateOKRModal({
  open,
  onClose,
  onCreated,
  departments,
  defaultQuarter,
  defaultYear,
  createOKR,
}: CreateOKRModalProps) {
  const [objective, setObjective] = useState('')
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? '')
  const [quarter, setQuarter] = useState(defaultQuarter)
  const [year, setYear] = useState(defaultYear)
  const [krs, setKrs] = useState<KRDraft[]>([{ ...DEFAULT_KR }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setObjective('')
    setDepartmentId(departments[0]?.id ?? '')
    setQuarter(defaultQuarter)
    setYear(defaultYear)
    setKrs([{ ...DEFAULT_KR }])
    setError(null)
  }

  const handleClose = () => {
    if (submitting) return
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    setError(null)
    if (!objective.trim()) {
      setError('Objective is required')
      return
    }
    if (!departmentId) {
      setError('Pick a department')
      return
    }
    const cleanKrs = krs
      .map((kr) => ({
        title: kr.title.trim(),
        target: Number(kr.target),
        current: Number(kr.current) || 0,
        unit: kr.unit.trim() || '%',
      }))
      .filter((kr) => kr.title.length > 0 && Number.isFinite(kr.target) && kr.target > 0)

    setSubmitting(true)
    try {
      await createOKR({
        objective: objective.trim(),
        departmentId,
        quarter,
        year,
        keyResults: cleanKrs.length > 0 ? cleanKrs : undefined,
      })
      reset()
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create OKR')
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
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-neutral-200/60 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">New objective</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">An ambitious goal with measurable key results.</p>
                </div>
                <button
                  onClick={handleClose}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Objective</label>
                  <textarea
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="e.g. Scale revenue to $100K MRR"
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Department</label>
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Quarter</label>
                    <select
                      value={quarter}
                      onChange={(e) => setQuarter(e.target.value)}
                      className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    >
                      {QUARTERS.map((q) => (
                        <option key={q} value={q}>{q}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Year</label>
                    <input
                      type="number"
                      min={2020}
                      max={2100}
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value) || defaultYear)}
                      className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                  </div>
                </div>

                {/* Key Results */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-neutral-700">Key Results</label>
                    <button
                      onClick={() => setKrs((prev) => [...prev, { ...DEFAULT_KR }])}
                      className="text-2xs font-medium text-brand-600 hover:text-brand-700 cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add KR
                    </button>
                  </div>
                  <div className="space-y-3">
                    {krs.map((kr, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
                          <input
                            type="text"
                            value={kr.title}
                            onChange={(e) =>
                              setKrs((prev) => prev.map((p, idx) => (idx === i ? { ...p, title: e.target.value } : p)))
                            }
                            placeholder="What will you measure?"
                            className="w-full h-8 px-2.5 text-xs bg-white border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={kr.current}
                            onChange={(e) =>
                              setKrs((prev) => prev.map((p, idx) => (idx === i ? { ...p, current: e.target.value } : p)))
                            }
                            placeholder="0"
                            className="w-full h-8 px-2 text-xs text-right font-mono bg-white border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={kr.target}
                            onChange={(e) =>
                              setKrs((prev) => prev.map((p, idx) => (idx === i ? { ...p, target: e.target.value } : p)))
                            }
                            placeholder="target"
                            className="w-full h-8 px-2 text-xs text-right font-mono bg-white border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={kr.unit}
                            onChange={(e) =>
                              setKrs((prev) => prev.map((p, idx) => (idx === i ? { ...p, unit: e.target.value } : p)))
                            }
                            placeholder="%"
                            className="w-full h-8 px-2 text-xs bg-white border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                          />
                        </div>
                        <button
                          onClick={() => setKrs((prev) => prev.filter((_, idx) => idx !== i))}
                          className="col-span-1 h-8 flex items-center justify-center text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-md cursor-pointer"
                          aria-label="Remove KR"
                          disabled={krs.length === 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-2xs text-neutral-400">
                    Current / Target / Unit (e.g. 3 / 5 / deals, or 88 / 95 / %).
                  </p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-50 border border-danger-200 text-xs text-danger-700">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    {error}
                  </div>
                )}
              </div>

              {/* Footer */}
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
                  {submitting ? 'Creating…' : 'Create OKR'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
