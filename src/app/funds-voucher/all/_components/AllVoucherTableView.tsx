'use client'

import { useState } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/dateUtils'
import { StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import PageHeader from '@/app/_components/PageHeader'
import ExportCsvButton from './ExportCsvButton'

type TempVoucherRow = {
  id: number
  funds_payment_id: number
  date: string | null
  apply_section: string | null
  applicant: string | null
  amount: number | null
  status: string
  current_step: number | null
  created_at: string
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

const SEARCH_FIELDS: Array<(r: TempVoucherRow) => string | null | undefined> = [
  (r) => r.apply_section,
  (r) => r.applicant,
  (r) => r.approval_flow_templates?.name,
]

function getStepName(r: TempVoucherRow): string | null {
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

export default function AllVoucherTableView({
  records,
  labelConfig,
  canExport,
}: {
  records: TempVoucherRow[]
  labelConfig: StatusLabelConfig
  canExport: boolean
}) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? records.filter(r => SEARCH_FIELDS.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
    : records

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader
          title="全部暫付款沖銷憑單"
          action={
            <div className="flex items-center gap-2">
              <Input
                placeholder="搜尋申請課別、申請人、審核流程…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-64 bg-background"
              />
              {canExport && <ExportCsvButton labelConfig={labelConfig} />}
            </div>
          }
        />
        <p className="mt-1 text-sm text-muted-foreground">所有暫付款沖銷憑單的完整狀態覽表</p>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {['申請日期', '申請課別', '申請人', '暫付金額', '審核流程', '狀態', ''].map((col, i) => (
                <TableHead key={i}>{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                  {query ? '找不到符合的紀錄' : '目前無暫付款沖銷憑單'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.date ? formatDate(r.date) : formatDate(r.created_at)}</TableCell>
                <TableCell>{r.apply_section ?? '-'}</TableCell>
                <TableCell>{r.applicant ?? '-'}</TableCell>
                <TableCell>{r.amount != null ? r.amount.toLocaleString() : '-'}</TableCell>
                <TableCell>{r.approval_flow_templates?.name ?? '-'}</TableCell>
                <TableCell>
                  <StatusBadge module="temp_voucher" status={r.status} stepName={getStepName(r)} labelConfig={labelConfig} />
                </TableCell>
                <TableCell>
                  <Link href={`/funds-voucher/my-voucher/${r.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
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
