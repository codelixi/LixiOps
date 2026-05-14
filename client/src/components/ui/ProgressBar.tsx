import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

interface ProgressBarProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  color?: 'brand' | 'success' | 'warning' | 'danger' | 'info'
  showLabel?: boolean
  className?: string
}

const colorStyles = {
  brand: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
}

const sizeStyles = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2.5',
}

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  color = 'brand',
  showLabel = false,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.round((value / max) * 100), 100)

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('flex-1 rounded-full bg-neutral-100 overflow-hidden', sizeStyles[size])}>
        <motion.div
          className={cn('h-full rounded-full', colorStyles[color])}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-neutral-500 tabular-nums min-w-[2.5rem] text-right">
          {percentage}%
        </span>
      )}
    </div>
  )
}
