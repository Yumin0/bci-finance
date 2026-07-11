'use client'

import { useState } from 'react'
import { YearDropdown, WeekDropdown } from './WeekPicker'
import {
  ALL_WEEKS,
  fromDateStr,
  getCurrentWeekStart,
  getDefaultWeekForYear,
  getWeekEnd,
  toDateStr,
  toTaipeiDateStr,
} from '@/lib/weekUtils'

export type WeekFilter = {
  year: number
  weekStart: string
  setYear: (year: number) => void
  setWeekStart: (weekStart: string) => void
  isFiltering: boolean
  matches: (date: string | null | undefined, createdAt?: string) => boolean
}

/**
 * 列表頁前端週次過濾：預設當週，可切「全部週次」。
 * matches 以申請日期（date 欄位）比對，草稿無日期時退回 created_at（台北時區日期）。
 */
export function useWeekFilter(): WeekFilter {
  const [year, setYear] = useState(() => getCurrentWeekStart().getFullYear())
  const [weekStart, setWeekStart] = useState(() => toDateStr(getCurrentWeekStart()))

  const isFiltering = weekStart !== ALL_WEEKS
  const weekEnd = isFiltering ? toDateStr(getWeekEnd(fromDateStr(weekStart))) : null

  function changeYear(y: number) {
    setYear(y)
    if (weekStart !== ALL_WEEKS) {
      setWeekStart(toDateStr(getDefaultWeekForYear(y)))
    }
  }

  function matches(date: string | null | undefined, createdAt?: string): boolean {
    if (!isFiltering) return true
    const d = date ? date.slice(0, 10) : createdAt ? toTaipeiDateStr(createdAt) : null
    if (!d) return false
    return d >= weekStart && d <= weekEnd!
  }

  return { year, weekStart, setYear: changeYear, setWeekStart, isFiltering, matches }
}

export default function WeekFilterBar({ filter }: { filter: WeekFilter }) {
  return (
    <div className="flex items-center gap-2">
      <YearDropdown selectedYear={filter.year} onChange={filter.setYear} />
      <WeekDropdown
        selectedYear={filter.year}
        selectedWeekStart={filter.weekStart}
        onChange={filter.setWeekStart}
        allowAll
      />
    </div>
  )
}
