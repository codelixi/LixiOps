import { motion } from 'framer-motion'
import { fadeInUp } from '@/lib/motion'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      {...fadeInUp}
      className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}
    >
      {icon && (
        <div className="mb-4 text-neutral-300 [&>svg]:h-12 [&>svg]:w-12">{icon}</div>
      )}
      <h3 className="text-base font-semibold text-neutral-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-neutral-500 max-w-sm mb-6">{description}</p>}
      {action}
    </motion.div>
  )
}
