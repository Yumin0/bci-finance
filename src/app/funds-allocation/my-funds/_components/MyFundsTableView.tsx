'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FundsAllocation } from '@/lib/types'
import { StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import PageHeader from '@/app/_components/PageHeader'
import TemplateModal from './TemplateModal'

type AllocationRow = FundsAllocation & {
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

type ColumnKey = 'division' | 'section' | 'applicant' | 'role' | 'amount' | 'account' | 'expense' | 'name'

const OPTIONAL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'division', label: '申請處別' },
  { key: 'section', label: '申請課別' },
  { key: 'applicant', label: '申請人' },
  { key: 'role', label: '職務' },
  { key: 'amount', label: '金額' },
  { key: 'account', label: '出款帳戶' },
  { key: 'expense', label: '費用項目' },
  { key: 'name', label: '項目' },
]

const LS_KEY = 'bci-funds-my-columns'
const DEFAULT_VISIBLE = new Set<ColumnKey>(OPTIONAL_COLUMNS.map(c => c.key))

const SEARCH_FIELDS: Array<(r: AllocationRow) => string | null | undefined> = [
  (r) => r.apply_section,
  (r) => r.apply_division,
  (r) => r.applicant,
  (r) => r.name,
  (r) => r.expense_item,
]

function getStepName(r: AllocationRow): string | null {
  if (r.status === 'pending') {
    return r.approval_flow_templates?.approval_flow_steps?.find(
      s => s.step_number === r.current_step
    )?.step_name ?? null
  }
  if (r.status === 'rejected') {
    return r.approval_records?.find(a => a.decision === 'rejected')?.step_name ?? null
  }
  if (r.status === 'approved') {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    return steps.reduce((max, s) => s.step_number > max.step_number ? s : max, steps[0])?.step_name ?? null
  }
  return null
}

export default function MyFundsTableView({
  records,
  labelConfig,
}: {
  records: AllocationRow[]
  labelConfig: StatusLabelConfig
}) {
  const [query, setQuery] = useState('')
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(DEFAULT_VISIBLE)
  const [showColPicker, setShowColPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (stored) {
        const parsed: ColumnKey[] = JSON.parse(stored)
        setVisibleCols(new Set(parsed))
      }
    } catch {}
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false)
      }
    }
    if (showColPicker) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColPicker])

  function toggleCol(key: ColumnKey) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      localStorage.setItem(LS_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const filtered = query.trim()
    ? records.filter(r => SEARCH_FIELDS.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
    : records

  const colCount = 2 + visibleCols.size + 1 // 狀態 + 單號 + visible + action

  return (
    <div className="flex flex-col gap-6">
      {showTemplateModal && <TemplateModal onClose={() => setShowTemplateModal(false)} />}

      <PageHeader
        title="我的資金分配申請"
        action={
          <div className="flex items-center gap-2">
            <Input
              placeholder="搜尋申請課別、申請人、項目名稱…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-64 bg-background"
            />
            <div className="relative" ref={pickerRef}>
              <button
                onClick={() => setShowColPicker(v => !v)}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                欄位
              </button>
              {showColPicker && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-md border bg-popover p-2 shadow-md">
                  {OPTIONAL_COLUMNS.map(col => (
                    <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={visibleCols.has(col.key)}
                        onChange={() => toggleCol(col.key)}
                        className="accent-primary"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setShowTemplateModal(true)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              選取範本
            </button>
            <Link href="/funds-allocation/my-funds/add" className={buttonVariants({ variant: 'default', size: 'sm' })}>
              ＋ 新增申請單
            </Link>
          </div>
        }
      />

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>狀態</TableHead>
              <TableHead>單號</TableHead>
              {OPTIONAL_COLUMNS.filter(c => visibleCols.has(c.key)).map(c => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} className="py-6 text-center text-muted-foreground">
                  {query ? '找不到符合的紀錄' : '尚無申請紀錄'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <StatusBadge module="funds_allocation" status={r.status} stepName={getStepName(r)} labelConfig={labelConfig} />
                </TableCell>
                <TableCell>
                  <Link href={`/funds-allocation/my-funds/edit/${r.id}`} className="text-sm text-primary underline underline-offset-4">
                    {r.status === 'draft' ? '繼續編輯' : (r.serial_number ?? '-')}
                  </Link>
                </TableCell>
                {visibleCols.has('division') && <TableCell>{r.apply_division ?? '-'}</TableCell>}
                {visibleCols.has('section') && <TableCell>{r.apply_section ?? '-'}</TableCell>}
                {visibleCols.has('applicant') && <TableCell>{r.applicant ?? '-'}</TableCell>}
                {visibleCols.has('role') && <TableCell>{r.apply_role ?? '-'}</TableCell>}
                {visibleCols.has('amount') && <TableCell>{r.amount.toLocaleString()}</TableCell>}
                {visibleCols.has('account') && <TableCell>{r.payment_account ?? '-'}</TableCell>}
                {visibleCols.has('expense') && <TableCell>{r.expense_item ?? '-'}</TableCell>}
                {visibleCols.has('name') && <TableCell>{r.name}</TableCell>}
                <TableCell>
                  <Link href={`/funds-allocation/my-funds/edit/${r.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    檢視 / 編輯
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
