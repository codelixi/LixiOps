import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { microBounce } from '@/lib/motion'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

// framer-motion overloads onDrag/onAnimation*/etc. with different signatures
// than React's DOM event handlers — omit the conflicting props from the React
// type so motion.button can supply its own.
type MotionConflicts =
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, MotionConflicts> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-sm',
  secondary:
    'bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 shadow-xs',
  ghost:
    'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
  danger:
    'bg-danger-600 text-white hover:bg-danger-500 active:bg-danger-600',
  success:
    'bg-success-600 text-white hover:bg-success-500 active:bg-success-600',
}

const sizeStyles: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-9 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-6 text-base gap-2.5 rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, iconRight, children, disabled, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        {...microBounce}
        className={cn(
          'inline-flex items-center justify-center font-medium',
          'transition-all duration-150 ease-out',
          'disabled:opacity-50 disabled:pointer-events-none',
          'cursor-pointer select-none',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : icon ? (
          <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        ) : null}
        {children}
        {iconRight && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{iconRight}</span>}
      </motion.button>
    )
  },
)

Button.displayName = 'Button'
