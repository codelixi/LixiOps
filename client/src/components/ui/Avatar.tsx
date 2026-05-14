import { cn } from '@/lib/cn'

interface AvatarProps {
  src?: string
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  status?: 'online' | 'away' | 'offline' | 'busy'
  className?: string
}

const sizeStyles = {
  xs: 'h-6 w-6 text-2xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

const statusColors = {
  online: 'bg-success-500',
  away: 'bg-warning-500',
  offline: 'bg-neutral-400',
  busy: 'bg-danger-500',
}

const statusSizes = {
  xs: 'h-1.5 w-1.5 border',
  sm: 'h-2 w-2 border-[1.5px]',
  md: 'h-2.5 w-2.5 border-2',
  lg: 'h-3 w-3 border-2',
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const bgColors = [
  'bg-brand-100 text-brand-500',
  'bg-info-100 text-info-600',
  'bg-success-100 text-success-600',
  'bg-warning-100 text-warning-600',
]

function getColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return bgColors[Math.abs(hash) % bgColors.length]
}

export function Avatar({ src, name, size = 'md', status, className }: AvatarProps) {
  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn('rounded-full object-cover', sizeStyles[size])}
        />
      ) : (
        <div
          className={cn(
            'rounded-full flex items-center justify-center font-semibold',
            sizeStyles[size],
            getColor(name),
          )}
        >
          {getInitials(name)}
        </div>
      )}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-white',
            statusColors[status],
            statusSizes[size],
          )}
        />
      )}
    </div>
  )
}
