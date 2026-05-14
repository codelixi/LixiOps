import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { staggerItem } from '@/lib/motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  className?: string
}

export function MetricCard({ label, value, change, changeLabel, icon, className }: MetricCardProps) {
  const trend = change !== undefined ? (change > 0 ? 'up' : change < 0 ? 'down' : 'flat') : null

  return (
    <motion.div
      variants={staggerItem}
      className={cn(
        'bg-white rounded-xl border border-neutral-200/60 shadow-xs p-5',
        'hover:shadow-sm transition-shadow duration-200',
        className,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{label}</p>
        {icon && (
          <span className="text-neutral-400 [&>svg]:h-4.5 [&>svg]:w-4.5">{icon}</span>
        )}
      </div>

      <div className="flex items-end gap-3">
        <motion.p
          className="text-2xl font-semibold text-neutral-900 tracking-tight"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {value}
        </motion.p>

        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium mb-0.5',
              trend === 'up' && 'text-success-600',
              trend === 'down' && 'text-danger-600',
              trend === 'flat' && 'text-neutral-500',
            )}
          >
            {trend === 'up' && <TrendingUp className="h-3 w-3" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3" />}
            {trend === 'flat' && <Minus className="h-3 w-3" />}
            <span>{change! > 0 ? '+' : ''}{change}%</span>
            {changeLabel && <span className="text-neutral-400 ml-0.5">{changeLabel}</span>}
          </div>
        )}
      </div>
    </motion.div>
  )
}
