'use client'

import { useState } from 'react'
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

  const filtered = query.trim()
    ? records.filter(r => SEARCH_FIELDS.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
    : records

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
              {['狀態', '單號', '申請處別', '申請課別', '申請人', '職稱', '金額', '出款帳戶', '費用項目', '項目', ''].map((col, i) => (
                <TableHead key={i}>{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="py-6 text-center text-muted-foreground">
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
                <TableCell>{r.apply_division ?? '-'}</TableCell>
                <TableCell>{r.apply_section ?? '-'}</TableCell>
                <TableCell>{r.applicant ?? '-'}</TableCell>
                <TableCell>{r.apply_role ?? '-'}</TableCell>
                <TableCell>{r.amount}</TableCell>
                <TableCell>{r.payment_account ?? '-'}</TableCell>
                <TableCell>{r.expense_item ?? '-'}</TableCell>
                <TableCell>{r.name}</TableCell>
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
