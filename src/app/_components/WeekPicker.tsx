'use client'

import { useState, useEffect, useRef } from 'react'
import { getWeeksForYear, formatWeekRange, toDateStr, getCurrentWeekStart } from '@/lib/weekUtils'

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 text-muted-foreground">
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
      <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function YearDropdown({
  selectedYear,
  onChange,
}: {
  selectedYear: number
  onChange: (year: number) => void
}) {
  const [open, setOpen] = useState(false)
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 3, currentYear - 2, currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground hover:bg-muted"
      >
        {selectedYear}
        <ChevronDown />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-28 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
          {years.map(y => (
            <button
              key={y}
              onClick={() => { onChange(y); setOpen(false) }}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-muted ${y === selectedYear ? 'text-primary' : 'text-foreground'}`}
            >
              {y}
              {y === selectedYear && <CheckMark />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function WeekDropdown({
  selectedYear,
  selectedWeekStart,
  maxFutureWeeks = 4,
  onChange,
  align = 'left',
}: {
  selectedYear: number
  selectedWeekStart: string
  maxFutureWeeks?: number
  onChange: (weekStart: string) => void
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const selectedRef = useRef<HTMLButtonElement>(null)

  const maxFuture = getCurrentWeekStart()
  maxFuture.setDate(maxFuture.getDate() + maxFutureWeeks * 7)
  const weeks = getWeeksForYear(selectedYear).filter(w => w <= maxFuture)

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        selectedRef.current?.scrollIntoView({ block: 'center' })
      })
    }
  }, [open])

  const displayDate = weeks.find(w => toDateStr(w) === selectedWeekStart) ?? weeks[weeks.length - 1]

  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground hover:bg-muted"
      >
        {displayDate ? formatWeekRange(displayDate) : selectedWeekStart}
        <ChevronDown />
      </button>
      {open && (
        <div
          className={`absolute top-full z-50 mt-1 max-h-64 w-44 overflow-y-auto rounded-lg border border-border bg-background shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {weeks.map(wk => {
            const s = toDateStr(wk)
            const isSelected = s === selectedWeekStart
            return (
              <button
                key={s}
                ref={isSelected ? selectedRef : undefined}
                onClick={() => { onChange(s); setOpen(false) }}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-muted ${isSelected ? 'text-primary' : 'text-foreground'}`}
              >
                <span>{formatWeekRange(wk)}</span>
                {isSelected && <CheckMark />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
