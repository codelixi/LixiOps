import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { hoverLift } from '@/lib/motion'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onClick?: () => void
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({ children, className, hover = false, padding = 'md', onClick }: CardProps) {
  const Component = hover ? motion.div : 'div'
  const motionProps = hover ? hoverLift : {}

  return (
    <Component
      {...motionProps}
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-neutral-200/60',
        'shadow-xs',
        paddingStyles[padding],
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </Component>
  )
}
