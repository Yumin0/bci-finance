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
import ExportCsvButton from './ExportCsvButton'

const LS_KEY = 'bci-funds-all-columns-v2'

type AllocationRow = FundsAllocation & {
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

const SEARCH_FIELDS: Array<(r: AllocationRow) => string | null | undefined> = [
  (r) => r.serial_number,
  (r) => r.apply_division,
  (r) => r.apply_section,
  (r) => r.applicant,
  (r) => r.expense_item,
  (r) => r.name,
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

export default function AllFundsTableView({
  records,
  labelConfig,
  canExport,
}: {
  records: AllocationRow[]
  labelConfig: StatusLabelConfig
  canExport: boolean
}) {
  const [query, setQuery] = useState('')
  const { visibleCols, toggleCol } = useColumnVisibility(LS_KEY, FUNDS_ALLOCATION_COLUMNS.map(c => c.key))

  const filtered = query.trim()
    ? records.filter(r => SEARCH_FIELDS.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
    : records

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader
          title="全部申請紀錄"
          action={
            <div className="flex items-center gap-2">
              <Input
                placeholder="搜尋單號、申請處別、申請課別…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-64 bg-background"
              />
              <ColumnPicker columns={FUNDS_ALLOCATION_COLUMNS} visibleCols={visibleCols} onToggle={toggleCol} />
              {canExport && <ExportCsvButton labelConfig={labelConfig} />}
            </div>
          }
        />
        <p className="mt-1 text-sm text-muted-foreground">所有資金分配申請的完整狀態覽表</p>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>狀態</TableHead>
              <TableHead>單號</TableHead>
              {FUNDS_ALLOCATION_COLUMNS.filter(c => visibleCols.has(c.key)).map(c => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={2 + visibleCols.size + 1} className="py-6 text-center text-muted-foreground">
                  {query ? '找不到符合的紀錄' : '目前無申請紀錄'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map(r => (
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
                {visibleCols.has('applicant') && <TableCell>{r.applicant ?? r.created_by}</TableCell>}
                {visibleCols.has('role') && <TableCell>{r.apply_role ?? '-'}</TableCell>}
                {visibleCols.has('requestedAmount') && <TableCell>{r.amount.toLocaleString()}</TableCell>}
                {visibleCols.has('approvedAmount') && <TableCell>{r.approved_amount != null ? r.approved_amount.toLocaleString() : '-'}</TableCell>}
                {visibleCols.has('remainingAmount') && <TableCell>-</TableCell>}
                {visibleCols.has('account') && <TableCell>{r.payment_account ?? '-'}</TableCell>}
                {visibleCols.has('expense') && <TableCell>{r.expense_item ?? '-'}</TableCell>}
                {visibleCols.has('name') && <TableCell>{r.name}</TableCell>}
                <TableCell>
                  <Link href={`/funds-allocation/my-funds/edit/${r.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    查閱
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
