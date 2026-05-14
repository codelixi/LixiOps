import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
import type { ActionTrigger, ActionType } from '@/hooks/useActionEngine'

// ───────────────────────────────────────────
// Custom Action Rule editor — bound to the Action Engine schema.
// Config is freeform key/value (string only at this layer); the
// server stores it as JSON, so adding typed configs per trigger is
// future work without changing the storage shape.
// ───────────────────────────────────────────

const TRIGGER_OPTIONS: { value: ActionTrigger; label: string; description: string }[] = [
  { value: 'INVOICE_OVERDUE', label: 'Invoice overdue', description: 'Invoice past dueDate and not paid' },
  { value: 'INVOICE_DUE_SOON', label: 'Invoice due soon', description: 'Invoice due within configurable window' },
  { value: 'LEAD_STALE', label: 'Lead stale', description: 'No activity for N days while in active stage' },
  { value: 'LEAD_IN_STAGE_TOO_LONG', label: 'Lead stuck in stage', description: 'Same stage for too long' },
  { value: 'PROJECT_PAST_DUE', label: 'Project past due', description: 'goLiveDate elapsed and not delivered' },
  { value: 'PROJECT_NO_UPDATE', label: 'Project no update', description: 'No status update for N days' },
  { value: 'MILESTONE_DUE_SOON', label: 'Milestone due soon', description: 'Milestone due within window' },
  { value: 'TASK_OVERDUE', label: 'Task overdue', description: 'Task past dueDate' },
  { value: 'CONTRACT_EXPIRING', label: 'Contract expiring', description: 'Contract end within N days' },
  { value: 'SLA_BREACH', label: 'SLA breach', description: 'Response time threshold exceeded' },
  { value: 'NPS_LOW', label: 'NPS low', description: 'Client NPS below threshold' },
]

const ACTION_OPTIONS: { value: ActionType; label: string; description: string }[] = [
  { value: 'NOTIFY_USER', label: 'Notify user', description: 'In-app notification to the entity owner' },
  { value: 'NOTIFY_ROLE', label: 'Notify role', description: 'Notify everyone in a role (CEO, MANAGER…)' },
  { value: 'EMAIL', label: 'Send email', description: 'Send templated email' },
  { value: 'CREATE_TASK', label: 'Create task', description: 'Auto-create a follow-up task' },
  { value: 'ESCALATE', label: 'Escalate', description: 'Escalate to manager' },
  { value: 'WEBHOOK', label: 'Webhook', description: 'POST to a configured webhook URL' },
]

export interface RulePreset {
  name?: string
  trigger?: ActionTrigger
  actionType?: ActionType
  config?: Record<string, unknown>
}

interface CreateRuleModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  createRule: (payload: {
    name: string
    trigger: ActionTrigger
    actionType: ActionType
    config?: Record<string, unknown>
    isActive?: boolean
  }) => Promise<unknown>
  preset?: RulePreset | null
}

export function CreateRuleModal({ open, onClose, onCreated, createRule, preset }: CreateRuleModalProps) {
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState<ActionTrigger>('INVOICE_OVERDUE')
  const [actionType, setActionType] = useState<ActionType>('NOTIFY_USER')
  const [isActive, setIsActive] = useState(true)
  const [configEntries, setConfigEntries] = useState<{ key: string; value: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setTrigger('INVOICE_OVERDUE')
    setActionType('NOTIFY_USER')
    setIsActive(true)
    setConfigEntries([])
    setError(null)
  }

  // Apply preset when opening — if Insights suggested a rule, pre-fill the form.
  useEffect(() => {
    if (!open) return
    if (preset) {
      if (preset.name) setName(preset.name)
      if (preset.trigger) setTrigger(preset.trigger)
      if (preset.actionType) setActionType(preset.actionType)
      if (preset.config) {
        setConfigEntries(
          Object.entries(preset.config).map(([k, v]) => ({
            key: k,
            value: typeof v === 'string' ? v : String(v),
          })),
        )
      }
    } else {
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset])

  const handleSubmit = async () => {
    setError(null)
    if (!name.trim()) {
      setError('Rule name is required')
      return
    }
    const config: Record<string, unknown> = {}
    for (const e of configEntries) {
      const k = e.key.trim()
      if (!k) continue
      const v = e.value.trim()
      // Coerce numeric strings to numbers; "true"/"false" to booleans.
      if (/^-?\d+(\.\d+)?$/.test(v)) config[k] = Number(v)
      else if (v === 'true' || v === 'false') config[k] = v === 'true'
      else config[k] = v
    }

    setSubmitting(true)
    try {
      await createRule({ name: name.trim(), trigger, actionType, config, isActive })
      reset()
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create rule')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (submitting) return
    reset()
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-16 pb-10 px-4 overflow-y-auto"
          >
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-neutral-200/60 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">New automation rule</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">Fires whenever the trigger condition is met during a scan.</p>
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
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Rule name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Escalate overdue invoices to CEO"
                    className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                {/* Trigger */}
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Trigger</label>
                  <select
                    value={trigger}
                    onChange={(e) => setTrigger(e.target.value as ActionTrigger)}
                    className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    {TRIGGER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-2xs text-neutral-500">
                    {TRIGGER_OPTIONS.find((o) => o.value === trigger)?.description}
                  </p>
                </div>

                {/* Action */}
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Action</label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value as ActionType)}
                    className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    {ACTION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-2xs text-neutral-500">
                    {ACTION_OPTIONS.find((o) => o.value === actionType)?.description}
                  </p>
                </div>

                {/* Config */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-neutral-700">Config (optional)</label>
                    <button
                      onClick={() => setConfigEntries((prev) => [...prev, { key: '', value: '' }])}
                      className="text-2xs font-medium text-brand-600 hover:text-brand-700 cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add field
                    </button>
                  </div>
                  {configEntries.length === 0 ? (
                    <p className="text-2xs text-neutral-400 py-2">
                      Examples: <code className="font-mono text-neutral-500">thresholdDays=14</code>,{' '}
                      <code className="font-mono text-neutral-500">recipientRole=CEO</code>,{' '}
                      <code className="font-mono text-neutral-500">webhookUrl=https://…</code>
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {configEntries.map((entry, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={entry.key}
                            onChange={(e) =>
                              setConfigEntries((prev) =>
                                prev.map((p, idx) => (idx === i ? { ...p, key: e.target.value } : p)),
                              )
                            }
                            placeholder="key"
                            className="flex-1 h-8 px-2.5 text-xs font-mono bg-white border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                          />
                          <span className="text-neutral-400 text-xs">=</span>
                          <input
                            type="text"
                            value={entry.value}
                            onChange={(e) =>
                              setConfigEntries((prev) =>
                                prev.map((p, idx) => (idx === i ? { ...p, value: e.target.value } : p)),
                              )
                            }
                            placeholder="value"
                            className="flex-1 h-8 px-2.5 text-xs font-mono bg-white border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                          />
                          <button
                            onClick={() =>
                              setConfigEntries((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="h-8 w-8 flex items-center justify-center text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-md cursor-pointer"
                            aria-label="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Active toggle */}
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setIsActive((v) => !v)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      isActive ? 'bg-brand-500' : 'bg-neutral-200'
                    }`}
                    aria-label={isActive ? 'Disable rule' : 'Enable rule'}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                        isActive ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-xs text-neutral-700">Enable rule immediately</span>
                </label>

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
                  {submitting ? 'Creating…' : 'Create rule'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
