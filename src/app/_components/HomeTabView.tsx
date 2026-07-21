'use client'

import Link from 'next/link'
import { useState } from 'react'
import { FundsAllocation, FundsPayment } from '@/lib/types'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import StatusBadge from '@/app/_components/StatusBadge'
import { RemainingBadge, VoucherStatusBadge } from '@/app/_components/CompletionBadge'
import PageHeader from '@/app/_components/PageHeader'
import ColumnPicker from '@/app/_components/ColumnPicker'
import { useColumnVisibility } from '@/app/_components/useColumnVisibility'
import { FUNDS_ALLOCATION_COLUMNS } from '@/lib/fundsAllocationColumns'
import {
  PaymentListCells,
  PAYMENT_LIST_COLUMNS_AFTER_STATUS,
} from '@/app/funds-payment/_components/PaymentListCells'
import type { StatusLabelConfig } from '@/lib/status-label-config'
import type { VoucherCompletionStatus } from '@/lib/paymentVoucherStatus'

const LS_KEY = 'bci-funds-home-columns-v2'

type Tab = 'funds' | 'payment' | 'voucher'

type TempVoucherRow = {
  id: number
  funds_payment_id: number
  serial_number: string | null
  date: string | null
  amount: number | null
  applicant: string | null
  status: string
  created_at: string
}

type WithStep<T> = T & { stepName: string | null }
type FundsAllocationRow = WithStep<FundsAllocation> & { remainingAmount: number }

export default function HomeTabView({
  fundsRecords,
  paymentRecords,
  voucherRecords,
  labelConfig,
  payeeLabel,
  voucherStatuses,
}: {
  fundsRecords: FundsAllocationRow[]
  paymentRecords: WithStep<FundsPayment>[]
  voucherRecords: WithStep<TempVoucherRow>[]
  labelConfig: StatusLabelConfig
  payeeLabel: string | null
  voucherStatuses?: Record<number, VoucherCompletionStatus>
}) {
  const [tab, setTab] = useState<Tab>('funds')
  const { visibleCols, toggleCol } = useColumnVisibility(LS_KEY, FUNDS_ALLOCATION_COLUMNS.map(c => c.key))

  const tabCls = (t: Tab) =>
    `-mb-px whitespace-nowrap border-b-2 px-5 py-2 text-sm font-medium transition-colors ${
      tab === t
        ? 'border-foreground text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="我的申請紀錄"
        action={
          tab === 'funds' ? (
            <div className="flex items-center gap-2">
              <ColumnPicker columns={FUNDS_ALLOCATION_COLUMNS} visibleCols={visibleCols} onToggle={toggleCol} />
              <Link href="/funds-allocation/my-funds/add" className={buttonVariants({})}>
                + 新增申請單
              </Link>
            </div>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button onClick={() => setTab('funds')} className={tabCls('funds')}>資金分配申請單</button>
        <button onClick={() => setTab('payment')} className={tabCls('payment')}>付款憑單申請單</button>
        <button onClick={() => setTab('voucher')} className={tabCls('voucher')}>暫付款沖銷憑單</button>
      </div>

      {/* 資金分配申請 */}
      {tab === 'funds' && (
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
              {fundsRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2 + visibleCols.size} className="py-6 text-center text-muted-foreground">尚無申請紀錄</TableCell>
                </TableRow>
              )}
              {fundsRecords.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <StatusBadge module="funds_allocation" status={r.status} stepName={r.stepName} labelConfig={labelConfig} />
                    {r.status === 'approved' && r.approved_amount != null && <RemainingBadge remaining={r.remainingAmount} />}
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
                  {visibleCols.has('remainingAmount') && <TableCell>{r.approved_amount != null ? r.remainingAmount.toLocaleString() : '-'}</TableCell>}
                  {visibleCols.has('account') && <TableCell>{r.payment_account ?? '-'}</TableCell>}
                  {visibleCols.has('expense') && <TableCell>{r.expense_item ?? '-'}</TableCell>}
                  {visibleCols.has('name') && <TableCell>{r.name}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 付款憑單 */}
      {tab === 'payment' && (
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
              {paymentRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={1 + PAYMENT_LIST_COLUMNS_AFTER_STATUS.length} className="py-6 text-center text-muted-foreground">尚無付款憑單</TableCell>
                </TableRow>
              )}
              {paymentRecords.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <StatusBadge module="payment_voucher" status={r.status} stepName={r.stepName} labelConfig={labelConfig} />
                    {voucherStatuses?.[r.id] && <VoucherStatusBadge status={voucherStatuses[r.id]} />}
                  </TableCell>
                  <PaymentListCells r={r} payeeLabel={payeeLabel} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 暫付款沖銷憑單 */}
      {tab === 'voucher' && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {['狀態', '暫付款沖銷憑單號', '申請人', '日期', '金額'].map((col, i) => (
                  <TableHead key={i}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {voucherRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">尚無暫付款沖銷憑單</TableCell>
                </TableRow>
              )}
              {voucherRecords.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><StatusBadge module="temp_voucher" status={r.status} stepName={r.stepName} labelConfig={labelConfig} /></TableCell>
                  <TableCell>
                    <Link href={`/funds-voucher/my-voucher/${r.id}`} className="text-sm text-primary underline underline-offset-4">
                      {r.serial_number ?? `#${r.id}`}
                    </Link>
                  </TableCell>
                  <TableCell>{r.applicant ?? '-'}</TableCell>
                  <TableCell>{r.date ?? '-'}</TableCell>
                  <TableCell>{r.amount ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
