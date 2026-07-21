'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FundsPayment } from '@/lib/types'
import { StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import { VoucherStatusBadge } from '@/app/_components/CompletionBadge'
import PageHeader from '@/app/_components/PageHeader'
import {
  PaymentListCells,
  PAYMENT_LIST_COLUMNS_AFTER_STATUS,
} from '@/app/funds-payment/_components/PaymentListCells'
import type { VoucherCompletionStatus } from '@/lib/paymentVoucherStatus'
import ExportCsvButton from './ExportCsvButton'

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

export default function AllPaymentTableView({
  records,
  labelConfig,
  canExport,
  payeeLabel,
  voucherStatuses,
}: {
  records: PaymentRow[]
  labelConfig: StatusLabelConfig
  canExport: boolean
  payeeLabel: string | null
  voucherStatuses?: Record<number, VoucherCompletionStatus>
}) {
  const [query, setQuery] = useState('')

  const searchFields = buildSearchFields(payeeLabel)
  const filtered = query.trim()
    ? records.filter(r => searchFields.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
    : records

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader
          title="全部付款紀錄"
          action={
            <div className="flex items-center gap-2">
              <Input
                placeholder="搜尋採購單號、憑單名稱、付款方式…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-64 bg-background"
              />
              {canExport && <ExportCsvButton labelConfig={labelConfig} />}
            </div>
          }
        />
        <p className="mt-1 text-sm text-muted-foreground">所有付款憑單的完整狀態覽表</p>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>狀態</TableHead>
              {PAYMENT_LIST_COLUMNS_AFTER_STATUS.map((col) => (
                <TableHead key={col}>{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={1 + PAYMENT_LIST_COLUMNS_AFTER_STATUS.length} className="py-6 text-center text-muted-foreground">
                  {query ? '找不到符合的紀錄' : '目前無付款紀錄'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <StatusBadge module="payment_voucher" status={r.status} stepName={getStepName(r)} labelConfig={labelConfig} />
                  {voucherStatuses?.[r.id] && <VoucherStatusBadge status={voucherStatuses[r.id]} />}
                </TableCell>
                <PaymentListCells r={r} payeeLabel={payeeLabel} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
