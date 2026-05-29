'use client'

import { useState, useRef, useEffect } from 'react'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

type Props = {
  value: string
  onChange: (v: string) => void
  allowedWeekdays: number[]
  weeksAhead: number
  required?: boolean
  name?: string
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function computeAllowedDates(allowedWeekdays: number[], weeksAhead: number): Set<string> {
  const result = new Set<string>()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const wd of allowedWeekdays) {
    const daysUntil = (wd - today.getDay() + 7) % 7
    const first = new Date(today)
    first.setDate(first.getDate() + daysUntil)

    for (let i = 0; i <= weeksAhead; i++) {
      const d = new Date(first)
      d.setDate(d.getDate() + i * 7)
      result.add(toLocalDateStr(d))
    }
  }
  return result
}

function pad(n: number) { return String(n).padStart(2, '0') }

export default function DateCyclePicker({ value, onChange, allowedWeekdays, weeksAhead, required, name }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const todayObj = new Date()
  const [viewYear, setViewYear] = useState(() =>
    value ? new Date(value + 'T00:00:00').getFullYear() : todayObj.getFullYear()
  )
  const [viewMonth, setViewMonth] = useState(() =>
    value ? new Date(value + 'T00:00:00').getMonth() : todayObj.getMonth()
  )

  const allowedDates = computeAllowedDates(allowedWeekdays, weeksAhead)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function dateStr(d: number) {
    return `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`
  }

  function selectDate(d: number) {
    const ds = dateStr(d)
    if (!allowedDates.has(ds)) return
    onChange(ds)
    setOpen(false)
  }

  function formatDisplay(v: string) {
    if (!v) return null
    const [y, m, d] = v.split('-')
    return `${y}年${parseInt(m)}月${parseInt(d)}日`
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input type="hidden" name={name} value={value} required={required} />
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 12px', border: '1px solid var(--btn-border)', borderRadius: 6,
          background: 'white', cursor: 'pointer', fontSize: 14, minHeight: 38,
          color: value ? 'var(--text-body)' : '#9ca3af',
        }}
      >
        <span>{formatDisplay(value) ?? '年 / 月 / 日'}</span>
        <span style={{ fontSize: 12, opacity: 0.4 }}>▼</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
          background: 'white', border: '1px solid var(--border-color)',
          borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          padding: 12, width: 248,
        }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button type="button" onClick={prevMonth} style={navBtn}>↑</button>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{viewYear}年{viewMonth + 1}月</span>
            <button type="button" onClick={nextMonth} style={navBtn}>↓</button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
            {WEEKDAY_LABELS.map(l => (
              <div key={l} style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', padding: '2px 0' }}>{l}</div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} />
              const ds = dateStr(d)
              const allowed = allowedDates.has(ds)
              const isSelected = ds === value
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => selectDate(d)}
                  style={{
                    padding: '5px 2px', textAlign: 'center', fontSize: 12,
                    borderRadius: 4, border: 'none',
                    background: isSelected ? '#2563eb' : 'transparent',
                    color: isSelected ? 'white' : allowed ? 'var(--text-body)' : '#d1d5db',
                    cursor: allowed ? 'pointer' : 'default',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {d}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
            <button type="button" onClick={() => { onChange(''); setOpen(false) }}
              style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
              清除
            </button>
            <button type="button" onClick={() => { setViewYear(todayObj.getFullYear()); setViewMonth(todayObj.getMonth()) }}
              style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
              今天
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: '2px 8px', fontSize: 14, color: '#374151',
}
