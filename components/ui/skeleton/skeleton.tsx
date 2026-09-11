interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-shimmer rounded bg-gray-100 ${className}`} aria-hidden="true" />
}
