import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Heart, TrendingUp, TrendingDown, AlertTriangle, Clock, RefreshCw, Loader2 } from 'lucide-react'
import { Card, Badge, ProgressBar, Button } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useClientHealth } from '@/hooks/useClientHealth'
import { useAuthStore } from '@/stores/useAuthStore'
import type { ClientHealthSnapshot } from '@/hooks/useClientHealth'

function getHealthColor(score: number) {
  if (score >= 80) return 'text-success-600'
  if (score >= 60) return 'text-warning-600'
  return 'text-danger-600'
}

function getHealthBg(score: number) {
  if (score >= 80) return 'bg-success-50'
  if (score >= 60) return 'bg-warning-50'
  return 'bg-danger-50'
}

function formatMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`
  return `$${n}`
}

interface NPSPromptState {
  clientId: string
  draft: string
}

export function ClientHealthPage() {
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.user?.role)
  const isPrivileged = role === 'CEO' || role === 'MANAGER'
  const { stats, clients, loading, usingFallback, refresh, setHealthScore, recordNPS } = useClientHealth()
  const [nps, setNps] = useState<NPSPromptState | null>(null)
  const [npsSaving, setNpsSaving] = useState(false)
  const [savingHealth, setSavingHealth] = useState<string | null>(null)

  const handleOpenNPS = (e: React.MouseEvent, clientId: string) => {
    e.stopPropagation()
    setNps({ clientId, draft: '' })
  }

  const submitNPS = async () => {
    if (!nps) return
    const value = Number(nps.draft)
    if (!Number.isFinite(value) || value < 0 || value > 10) {
      window.alert('NPS must be between 0 and 10')
      return
    }
    setNpsSaving(true)
    try {
      await recordNPS(nps.clientId, value)
      setNps(null)
    } catch (err: any) {
      window.alert(err?.message ?? 'Failed to record NPS')
    } finally {
      setNpsSaving(false)
    }
  }

  const handleAdjustHealth = async (e: React.MouseEvent, snapshot: ClientHealthSnapshot) => {
    e.stopPropagation()
    const raw = window.prompt(
      `Set health score for ${snapshot.company} (0-100, or leave blank to clear)`,
      String(snapshot.healthScore),
    )
    if (raw === null) return
    if (raw.trim() === '') {
      setSavingHealth(snapshot.id)
      try {
        await setHealthScore(snapshot.id, null)
      } catch (err: any) {
        window.alert(err?.message ?? 'Failed to clear health score')
      } finally {
        setSavingHealth(null)
      }
      return
    }
    const v = Number(raw)
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      window.alert('Score must be between 0 and 100')
      return
    }
    setSavingHealth(snapshot.id)
    try {
      await setHealthScore(snapshot.id, Math.round(v))
    } catch (err: any) {
      window.alert(err?.message ?? 'Failed to update score')
    } finally {
      setSavingHealth(null)
    }
  }

  const trendIcon = (t: ClientHealthSnapshot['trend']) => {
    if (t === 'improving') return <TrendingUp className="h-3 w-3 text-success-500" />
    if (t === 'declining') return <TrendingDown className="h-3 w-3 text-danger-500" />
    return null
  }

  const trendColor = (t: ClientHealthSnapshot['trend']) =>
    t === 'improving' ? 'text-success-600' : t === 'declining' ? 'text-danger-600' : 'text-neutral-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Heart className="h-5 w-5 text-danger-500" />
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Client Health</h1>
          </div>
          <p className="text-sm text-neutral-500">
            Monitor client satisfaction and risk indicators
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

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Avg Health</p>
          <p className={`text-2xl font-bold ${getHealthColor(stats.avgHealth)}`}>{stats.avgHealth}%</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Healthy</p>
          <p className="text-2xl font-bold text-success-600">{stats.healthy}</p>
          <p className="text-2xs text-neutral-400 mt-1">of {stats.total} clients</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">At Risk</p>
          <p className="text-2xl font-bold text-danger-600">{stats.atRisk}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Open Risks</p>
          <p className="text-2xl font-bold text-warning-600">{stats.openIssues}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Avg NPS</p>
          <p className="text-2xl font-bold text-info-600">
            {stats.avgNps !== null ? stats.avgNps.toFixed(1) : '—'}
          </p>
          <p className="text-2xs text-neutral-400 mt-1">out of 10</p>
        </Card>
      </div>

      {/* List */}
      {clients.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500 text-center py-12">No active clients to monitor.</p>
        </Card>
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
          {clients.map((client) => (
            <motion.div key={client.id} variants={staggerItem}>
              <Card hover className="cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                <div className="flex items-center gap-6">
                  {/* Health Score */}
                  <div
                    onClick={(e) => isPrivileged && handleAdjustHealth(e, client)}
                    className={`flex-shrink-0 h-16 w-16 rounded-xl flex flex-col items-center justify-center relative ${getHealthBg(client.healthScore)} ${
                      isPrivileged ? 'hover:ring-2 hover:ring-brand-400 transition' : ''
                    }`}
                    title={isPrivileged ? 'Click to adjust manually' : undefined}
                  >
                    {savingHealth === client.id ? (
                      <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
                    ) : (
                      <>
                        <span className={`text-xl font-bold ${getHealthColor(client.healthScore)}`}>
                          {client.healthScore}
                        </span>
                        <span className="text-[9px] font-medium text-neutral-400 uppercase">Score</span>
                      </>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-semibold text-neutral-900">{client.company}</h3>
                      <span className="text-xs text-neutral-400">· {client.contactName}</span>
                      {client.vertical && (
                        <Badge variant="default">{client.vertical}</Badge>
                      )}
                      <div className="flex items-center gap-1 text-xs">
                        {trendIcon(client.trend)}
                        <span className={`capitalize ${trendColor(client.trend)}`}>{client.trend}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-neutral-500 mb-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {client.lastInteractionLabel}
                      </span>
                      <button
                        onClick={(e) => handleOpenNPS(e, client.id)}
                        className="hover:text-brand-600 cursor-pointer underline-offset-2 hover:underline"
                      >
                        NPS: {client.npsScore !== null ? `${client.npsScore}/10` : '—'}
                      </button>
                      <span>SLA: {client.slaCompliance}%</span>
                      {client.contractValue > 0 && (
                        <span>{formatMoney(client.contractValue)} contract</span>
                      )}
                      {client.openIssues > 0 && (
                        <span className="text-danger-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {client.openIssues} open risk{client.openIssues === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>

                    {client.riskFactors.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {client.riskFactors.map((rf) => (
                          <Badge key={rf} variant="danger">{rf}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SLA bar */}
                  <div className="flex-shrink-0 w-32 hidden md:block">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-neutral-400 uppercase">SLA</span>
                      <span className="text-xs font-medium text-neutral-700">{client.slaCompliance}%</span>
                    </div>
                    <ProgressBar
                      value={client.slaCompliance}
                      size="sm"
                      color={client.slaCompliance >= 95 ? 'success' : client.slaCompliance >= 85 ? 'warning' : 'danger'}
                    />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* NPS prompt */}
      {nps && (
        <div
          onClick={() => !npsSaving && setNps(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm px-4"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-sm bg-white rounded-2xl border border-neutral-200/60 shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-900">Record NPS</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                "How likely would the client recommend us?" Score 0–10.
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <input
                type="number"
                autoFocus
                min={0}
                max={10}
                value={nps.draft}
                onChange={(e) => setNps({ ...nps, draft: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitNPS()
                  if (e.key === 'Escape') setNps(null)
                }}
                placeholder="0 – 10"
                className="w-full h-10 px-3 text-base font-mono bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                disabled={npsSaving}
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-neutral-100 bg-neutral-50/50">
              <Button variant="secondary" size="sm" onClick={() => setNps(null)} disabled={npsSaving}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={submitNPS}
                disabled={npsSaving}
                icon={npsSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
              >
                {npsSaving ? 'Saving…' : 'Record'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
