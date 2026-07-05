'use client'

import Link from 'next/link'
import { useState } from 'react'
import { FundsAllocation, FundsPayment } from '@/lib/types'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import StatusBadge from '@/app/_components/StatusBadge'
import PageHeader from '@/app/_components/PageHeader'
import type { StatusLabelConfig } from '@/lib/status-label-config'

type Tab = 'funds' | 'payment' | 'voucher'

type TempVoucherRow = {
  id: number
  funds_payment_id: number
  date: string | null
  amount: number | null
  applicant: string | null
  status: string
  created_at: string
}

type WithStep<T> = T & { stepName: string | null }

export default function HomeTabView({
  fundsRecords,
  paymentRecords,
  voucherRecords,
  labelConfig,
}: {
  fundsRecords: WithStep<FundsAllocation>[]
  paymentRecords: WithStep<FundsPayment>[]
  voucherRecords: WithStep<TempVoucherRow>[]
  labelConfig: StatusLabelConfig
}) {
  const [tab, setTab] = useState<Tab>('funds')

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
            <Link href="/funds-allocation/my-funds/add" className={buttonVariants({ size: 'sm' })}>
              + 新增申請單
            </Link>
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
                {['狀態', '申請處別', '申請課別', '申請人', '職稱', '金額', '出款帳戶', '費用項目', '項目', ''].map((col, i) => (
                  <TableHead key={i}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {fundsRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">尚無申請紀錄</TableCell>
                </TableRow>
              )}
              {fundsRecords.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><StatusBadge module="funds_allocation" status={r.status} stepName={r.stepName} labelConfig={labelConfig} /></TableCell>
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
      )}

      {/* 付款憑單 */}
      {tab === 'payment' && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {['狀態', '費用項目', '項目', '付款方式', '金額', ''].map((col, i) => (
                  <TableHead key={i}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">尚無付款憑單</TableCell>
                </TableRow>
              )}
              {paymentRecords.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><StatusBadge module="payment_voucher" status={r.status} stepName={r.stepName} labelConfig={labelConfig} /></TableCell>
                  <TableCell>{r.expense_item ?? '-'}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.payment_method ?? '-'}</TableCell>
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
      )}

      {/* 暫付款沖銷憑單 */}
      {tab === 'voucher' && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {['狀態', '申請人', '日期', '金額', ''].map((col, i) => (
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
                  <TableCell>{r.applicant ?? '-'}</TableCell>
                  <TableCell>{r.date ?? '-'}</TableCell>
                  <TableCell>{r.amount ?? '-'}</TableCell>
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
      )}
    </div>
  )
}
