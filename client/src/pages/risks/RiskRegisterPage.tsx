import { motion } from 'framer-motion'
import { ShieldAlert } from 'lucide-react'
import { Card, Badge, Avatar } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useRisks } from '@/hooks/useRisks'
import type { RiskSeverity, RiskStatusUi } from '@/hooks/useRisks'

const severityMap: Record<RiskSeverity, { label: string; color: string }> = {
  critical: { label: 'Critical', color: 'bg-danger-50 text-danger-700' },
  high: { label: 'High', color: 'bg-warning-50 text-warning-700' },
  medium: { label: 'Medium', color: 'bg-info-50 text-info-700' },
  low: { label: 'Low', color: 'bg-neutral-100 text-neutral-600' },
}

const statusMap: Record<RiskStatusUi, { label: string; variant: 'danger' | 'warning' | 'success' | 'info' }> = {
  open: { label: 'Open', variant: 'danger' },
  mitigating: { label: 'Mitigating', variant: 'warning' },
  resolved: { label: 'Resolved', variant: 'success' },
  accepted: { label: 'Accepted', variant: 'info' },
}

const categoryColors: Record<string, string> = {
  financial: 'bg-success-50 text-success-600',
  operational: 'bg-brand-50 text-brand-600',
  technical: 'bg-info-50 text-info-600',
  legal: 'bg-danger-50 text-danger-600',
  strategic: 'bg-warning-50 text-warning-600',
  client: 'bg-brand-50 text-brand-600',
  timeline: 'bg-warning-50 text-warning-600',
  compliance: 'bg-danger-50 text-danger-600',
}

export function RiskRegisterPage() {
  const { risks, usingFallback } = useRisks()

  const critical = risks.filter((r) => r.severity === 'critical').length
  const open = risks.filter((r) => r.status === 'open').length
  const mitigating = risks.filter((r) => r.status === 'mitigating').length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-5 w-5 text-danger-500" />
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Risk Register</h1>
        </div>
        <p className="text-sm text-neutral-500">
          Track and mitigate organizational risks
          {usingFallback && (
            <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
          )}
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Risks</p>
          <p className="text-2xl font-bold text-neutral-900">{risks.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Critical</p>
          <p className="text-2xl font-bold text-danger-600">{critical}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Open</p>
          <p className="text-2xl font-bold text-warning-600">{open}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Being Mitigated</p>
          <p className="text-2xl font-bold text-info-600">{mitigating}</p>
        </Card>
      </div>

      {/* Risk Cards */}
      {risks.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500 text-center py-8">No risks have been logged yet.</p>
        </Card>
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
          {risks.map((risk) => (
            <motion.div key={risk.id} variants={staggerItem}>
              <Card hover className="cursor-pointer">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-neutral-900">{risk.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${severityMap[risk.severity].color}`}>
                      {severityMap[risk.severity].label}
                    </span>
                    <Badge variant={statusMap[risk.status].variant} dot>
                      {statusMap[risk.status].label}
                    </Badge>
                    <span className="text-[10px] text-neutral-500">{risk.projectName}</span>
                  </div>
                </div>

                {risk.description && (
                  <p className="text-xs text-neutral-600 mb-3 leading-relaxed">{risk.description}</p>
                )}

                <div className="bg-neutral-50 rounded-lg p-3 mb-3">
                  <p className="text-[10px] font-medium text-neutral-400 uppercase mb-1">Mitigation Plan</p>
                  <p className="text-xs text-neutral-700">{risk.mitigation}</p>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded font-medium capitalize ${categoryColors[risk.category] ?? 'bg-neutral-100 text-neutral-600'}`}>
                      {risk.category}
                    </span>
                    <span className="text-neutral-500 capitalize">Likelihood: {risk.likelihood.replace('-', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar name={risk.owner} size="xs" />
                    <span className="text-neutral-500">{risk.owner}</span>
                    <span className="text-neutral-400">· {risk.dateIdentified}</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
