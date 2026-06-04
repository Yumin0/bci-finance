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

type TempVoucherRow = {
  id: number
  funds_payment_id: number
  date: string | null
  amount: number | null
  applicant: string | null
  status: string
  current_step: number | null
  flow_template_id: number | null
  created_at: string
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

const SEARCH_FIELDS: Array<(r: TempVoucherRow) => string | null | undefined> = [
  (r) => r.applicant,
  (r) => String(r.funds_payment_id),
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

export default function MyVoucherTableView({
  records,
  labelConfig,
}: {
  records: TempVoucherRow[]
  labelConfig: StatusLabelConfig
}) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? records.filter(r => SEARCH_FIELDS.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
    : records

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="我的暫付款沖銷憑單"
        action={
          <Input
            placeholder="搜尋申請人或關聯付款憑單編號…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-64 bg-background"
          />
        }
      />

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {['狀態', '申請日期', '暫付金額', '關聯付款憑單', ''].map((col, i) => (
                <TableHead key={i}>{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  {query ? '找不到符合的紀錄' : '尚無暫付款沖銷憑單'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <StatusBadge module="temp_voucher" status={r.status} stepName={getStepName(r)} labelConfig={labelConfig} />
                </TableCell>
                <TableCell>{r.date ? formatDate(r.date) : '-'}</TableCell>
                <TableCell>{r.amount != null ? r.amount.toLocaleString() : '-'}</TableCell>
                <TableCell>
                  <Link href={`/funds-payment/my-payment/${r.funds_payment_id}`} className="text-sm text-primary underline underline-offset-4">
                    #{r.funds_payment_id}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/funds-voucher/my-voucher/${r.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    檢視
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
