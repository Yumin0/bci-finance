import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export default function PageHeader({
  title,
  action,
  className,
}: {
  title: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      {action}
    </div>
  )
}
