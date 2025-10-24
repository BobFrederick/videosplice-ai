import { cn } from '@/lib/utils'

interface ActivityProgressBarProps {
  className?: string
  isActive?: boolean
}

export function ActivityProgressBar({ className, isActive = true }: ActivityProgressBarProps) {
  if (!isActive) {
    return null
  }

  return (
    <div className={cn("relative h-1.5 bg-gray-200 rounded-full overflow-hidden", className)}>
      {/* Base animated bar with gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-pulse rounded-full" />
      
      {/* Moving shimmer effect */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full" />
    </div>
  )
}