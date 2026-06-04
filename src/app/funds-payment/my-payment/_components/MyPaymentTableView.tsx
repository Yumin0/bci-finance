'use client'

import { useState } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FundsPayment } from '@/lib/types'
import { StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import PageHeader from '@/app/_components/PageHeader'

type PaymentRow = FundsPayment & {
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

const buildSearchFields = (payeeLabel: string | null): Array<(r: PaymentRow) => string | null | undefined> => [
  (r) => r.purchase_order_number,
  (r) => r.name,
  (r) => r.payment_method,
  ...(payeeLabel ? [(r: PaymentRow) => r.extra_data?.[payeeLabel]] : []),
]

function getStepName(r: PaymentRow): string | null {
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

export default function MyPaymentTableView({
  records,
  labelConfig,
  payeeLabel,
}: {
  records: PaymentRow[]
  labelConfig: StatusLabelConfig
  payeeLabel: string | null
}) {
  const [query, setQuery] = useState('')

  const searchFields = buildSearchFields(payeeLabel)
  const filtered = query.trim()
    ? records.filter(r => searchFields.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
    : records

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="我的付款憑單"
        action={
          <Input
            placeholder="搜尋採購單號、憑單名稱、付款方式…"
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
              {['狀態', '採購單號', '項目', '付款方式', '付款對象', '金額', ''].map((col, i) => (
                <TableHead key={i}>{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                  {query ? '找不到符合的紀錄' : '尚無付款憑單'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <StatusBadge module="payment_voucher" status={r.status} stepName={getStepName(r)} labelConfig={labelConfig} />
                </TableCell>
                <TableCell>
                  <Link href={`/funds-payment/my-payment/${r.id}`} className="text-sm text-primary underline underline-offset-4">
                    {r.status === 'draft' ? '繼續編輯' : (r.purchase_order_number ?? '-')}
                  </Link>
                </TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.payment_method ?? '-'}</TableCell>
                <TableCell>{payeeLabel ? (r.extra_data?.[payeeLabel] ?? '-') : '-'}</TableCell>
                <TableCell>{r.amount}</TableCell>
                <TableCell>
                  <Link href={`/funds-payment/my-payment/${r.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
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
