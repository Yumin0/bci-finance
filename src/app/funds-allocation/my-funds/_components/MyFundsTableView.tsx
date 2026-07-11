'use client'

import { useState } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FundsAllocation } from '@/lib/types'
import { StatusLabelConfig } from '@/lib/status-label-config'
import { FUNDS_ALLOCATION_COLUMNS } from '@/lib/fundsAllocationColumns'
import StatusBadge from '@/app/_components/StatusBadge'
import PageHeader from '@/app/_components/PageHeader'
import ColumnPicker from '@/app/_components/ColumnPicker'
import { useColumnVisibility } from '@/app/_components/useColumnVisibility'
import TemplateModal from './TemplateModal'

type AllocationRow = FundsAllocation & {
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

const LS_KEY = 'bci-funds-my-columns-v2'

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
  const { visibleCols, toggleCol } = useColumnVisibility(LS_KEY, FUNDS_ALLOCATION_COLUMNS.map(c => c.key))

  const filtered = query.trim()
    ? records.filter(r => SEARCH_FIELDS.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
    : records

  const colCount = 2 + visibleCols.size // 狀態 + 單號 + visible

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
            <ColumnPicker columns={FUNDS_ALLOCATION_COLUMNS} visibleCols={visibleCols} onToggle={toggleCol} />
            <button onClick={() => setShowTemplateModal(true)} className={buttonVariants({ variant: 'outline' })}>
              選取範本
            </button>
            <Link href="/funds-allocation/my-funds/add" className={buttonVariants({ variant: 'default' })}>
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
              {FUNDS_ALLOCATION_COLUMNS.filter(c => visibleCols.has(c.key)).map(c => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
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
                {visibleCols.has('requestedAmount') && <TableCell>{r.amount.toLocaleString()}</TableCell>}
                {visibleCols.has('approvedAmount') && <TableCell>{r.approved_amount != null ? r.approved_amount.toLocaleString() : '-'}</TableCell>}
                {visibleCols.has('remainingAmount') && <TableCell>-</TableCell>}
                {visibleCols.has('account') && <TableCell>{r.payment_account ?? '-'}</TableCell>}
                {visibleCols.has('expense') && <TableCell>{r.expense_item ?? '-'}</TableCell>}
                {visibleCols.has('name') && <TableCell>{r.name}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
