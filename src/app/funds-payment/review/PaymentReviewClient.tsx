'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FundsPayment, ApprovalRecord } from '@/lib/types'
import { type StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buttonVariants } from '@/components/ui/button'
import PageHeader from '@/app/_components/PageHeader'
import { YearDropdown, WeekDropdown } from '@/app/_components/WeekPicker'

export type TabDef = { key: string; label: string }

export type PaymentItem = FundsPayment & {
  step_name?: string
  total_steps?: number
  is_pending_here?: boolean
}

export type HistoryItem = ApprovalRecord & {
  funds_payment: Pick<FundsPayment, 'id' | 'name' | 'amount' | 'status' | 'purchase_order_number' | 'payment_method' | 'extra_data'> | null
}

const buildPaymentSearch = (payeeLabel: string | null): Array<(r: PaymentItem) => string | null | undefined> => [
  (r) => r.purchase_order_number,
  (r) => r.name,
  (r) => r.payment_method,
  (r) => r.applicant,
  ...(payeeLabel ? [(r: PaymentItem) => r.extra_data?.[payeeLabel]] : []),
]
const buildHistorySearch = (payeeLabel: string | null): Array<(r: HistoryItem) => string | null | undefined> => [
  (r) => r.funds_payment?.purchase_order_number,
  (r) => r.funds_payment?.name,
  (r) => r.funds_payment?.payment_method,
  ...(payeeLabel ? [(r: HistoryItem) => r.funds_payment?.extra_data?.[payeeLabel]] : []),
]

type Props = {
  visibleTabs: TabDef[]
  tabItems: Record<string, PaymentItem[]>
  historyItems: HistoryItem[]
  paymentAccounts: string[]
  labelConfig: StatusLabelConfig
  payeeLabel: string | null
  selectedYear: number
  selectedWeekStart: string
}

export default function PaymentReviewClient({
  visibleTabs,
  tabItems,
  historyItems,
  paymentAccounts,
  labelConfig,
  payeeLabel,
  selectedYear,
  selectedWeekStart,
}: Props) {
  const router = useRouter()
  const [isPending] = useTransition()
  const [activeTab, setActiveTab] = useState<string>(visibleTabs[0]?.key ?? 'history')
  const [query, setQuery] = useState('')

  function handleTabChange(key: string) {
    setActiveTab(key)
    setQuery('')
  }

  function filterItems(items: PaymentItem[]) {
    if (!query.trim()) return items
    return items.filter(r => buildPaymentSearch(payeeLabel).some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
  }

  function filterHistory(items: HistoryItem[]) {
    if (!query.trim()) return items
    return items.filter(r => buildHistorySearch(payeeLabel).some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
  }

  const pendingCount = (key: string) =>
    (tabItems[key] ?? []).filter(r => r.is_pending_here === true).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader
          title="審核管理"
          action={
            <Input
              placeholder="搜尋採購單號、憑單名稱、付款方式…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-64 bg-background"
            />
          }
        />
        <p className="mt-1 text-sm text-muted-foreground">
          付款憑單的審核任務與歷史記錄
          {isPending && <span className="ml-2 opacity-60">更新中…</span>}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex border-b border-border flex-1">
          {visibleTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`-mb-px whitespace-nowrap border-b-2 px-5 py-2 text-sm font-medium transition-colors ${activeTab === tab.key ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
              {tab.key !== 'history' && pendingCount(tab.key) > 0 && (
                <span className="ml-1.5 inline-block rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-white">
                  {pendingCount(tab.key)}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab !== 'history' && (
          <div className="flex items-center gap-2 pl-4 pb-px">
            <YearDropdown
              selectedYear={selectedYear}
              onChange={year => router.push(`/funds-payment/review?year=${year}`)}
            />
            <WeekDropdown
              selectedYear={selectedYear}
              selectedWeekStart={selectedWeekStart}
              align="right"
              onChange={weekStart => router.push(`/funds-payment/review?year=${selectedYear}&weekStart=${weekStart}`)}
            />
          </div>
        )}
      </div>

      {activeTab === 'history' ? (
        <HistoryList items={filterHistory(historyItems)} labelConfig={labelConfig} payeeLabel={payeeLabel} />
      ) : (
        <AccountGroupedList
          items={filterItems(tabItems[activeTab] ?? [])}
          paymentAccounts={paymentAccounts}
          labelConfig={labelConfig}
          payeeLabel={payeeLabel}
        />
      )}
    </div>
  )
}

function AccountGroupedList({
  items,
  paymentAccounts,
  labelConfig,
  payeeLabel,
}: {
  items: PaymentItem[]
  paymentAccounts: string[]
  labelConfig: StatusLabelConfig
  payeeLabel: string | null
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">本週沒有相關憑單</p>

  const groupMap = items.reduce<Record<string, PaymentItem[]>>((acc, r) => {
    const key = r.payment_account ?? '（未指定帳戶）'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  const orderedKeys = [
    ...paymentAccounts.filter(k => groupMap[k]),
    ...Object.keys(groupMap).filter(k => !paymentAccounts.includes(k)),
  ]

  return (
    <div className="flex flex-col gap-6">
      {orderedKeys.map(account => (
        <Card key={account} className="overflow-hidden p-0">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-base">{account}</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                {['狀態', '採購單號', '申請人', '項目', '付款方式', '付款對象', '金額', ''].map((col, i) => (
                  <TableHead key={i}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupMap[account].map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <StatusBadge module="payment_voucher" status={r.status} stepName={r.step_name} labelConfig={labelConfig} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/funds-payment/review/check/${r.id}`} className="text-sm text-primary underline underline-offset-4">
                      {r.purchase_order_number ?? '-'}
                    </Link>
                  </TableCell>
                  <TableCell>{r.applicant ?? '-'}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.payment_method ?? '-'}</TableCell>
                  <TableCell>{payeeLabel ? (r.extra_data?.[payeeLabel] ?? '-') : '-'}</TableCell>
                  <TableCell>{r.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    {r.is_pending_here === true
                      ? <Link href={`/funds-payment/review/check/${r.id}`} className={buttonVariants({ variant: 'default', size: 'sm' })}>審核</Link>
                      : <Link href={`/funds-payment/review/check/${r.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>查閱</Link>
                    }
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ))}
    </div>
  )
}

function HistoryList({ items, labelConfig, payeeLabel }: { items: HistoryItem[]; labelConfig: StatusLabelConfig; payeeLabel: string | null }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">尚無審核紀錄</p>
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            {['狀態', '採購單號', '項目', '付款方式', '付款對象', '金額', ''].map((col, i) => <TableHead key={i}>{col}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(r => (
            <TableRow key={r.id}>
              <TableCell>
                <StatusBadge module="payment_voucher" status={r.funds_payment?.status ?? (r.decision === 'approved' ? 'approved' : 'rejected')} stepName={r.step_name} labelConfig={labelConfig} />
              </TableCell>
              <TableCell>
                {r.funds_payment_id
                  ? <Link href={`/funds-payment/review/check/${r.funds_payment_id}`} className="text-sm text-primary underline underline-offset-4">{r.funds_payment?.purchase_order_number ?? '-'}</Link>
                  : (r.funds_payment?.purchase_order_number ?? '-')}
              </TableCell>
              <TableCell>{r.funds_payment?.name ?? '-'}</TableCell>
              <TableCell>{r.funds_payment?.payment_method ?? '-'}</TableCell>
              <TableCell>{payeeLabel ? (r.funds_payment?.extra_data?.[payeeLabel] ?? '-') : '-'}</TableCell>
              <TableCell>{r.funds_payment?.amount?.toLocaleString() ?? '-'}</TableCell>
              <TableCell>
                {r.funds_payment_id && <Link href={`/funds-payment/review/check/${r.funds_payment_id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>查閱</Link>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
