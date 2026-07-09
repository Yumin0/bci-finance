'use client'

import { useEffect, useRef, useState } from 'react'
import { buttonVariants } from '@/components/ui/button'

export default function ColumnPicker<K extends string>({
  columns,
  visibleCols,
  onToggle,
}: {
  columns: { key: K; label: string }[]
  visibleCols: Set<K>
  onToggle: (key: K) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
      >
        欄位
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-md border bg-popover p-2 shadow-md">
          {columns.map(col => (
            <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
              <input
                type="checkbox"
                checked={visibleCols.has(col.key)}
                onChange={() => onToggle(col.key)}
                className="accent-primary"
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
