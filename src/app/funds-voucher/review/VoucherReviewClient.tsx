'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ApprovalRecord } from '@/lib/types'
import { type StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PageHeader from '@/app/_components/PageHeader'
import { YearDropdown, WeekDropdown } from '@/app/_components/WeekPicker'

export type TabDef = { key: string; label: string }

export type VoucherAttachment = { file_name: string; url?: string }
export type VoucherAttachmentMap = Record<number, VoucherAttachment[]>

// 母付款憑單資訊：沖銷憑單自己沒有這些欄位，一律取自母付款憑單
type VoucherPaymentRef = {
  payment_account?: string | null
  name?: string | null
  expense_item?: string | null
  payment_method?: string | null
  approved_amount?: number | null
  extra_data?: Record<string, string> | null
} | null

// 待審核 Tab 的沖銷憑單（server action 回傳，已攤平 payment_account / step_name / is_pending_here）
export type VoucherItem = {
  id: number
  serial_number: string | null
  status: string
  amount: number | null
  payment_account: string | null
  funds_payment: VoucherPaymentRef
  step_name?: string
  is_pending_here?: boolean
}

export type HistoryItem = ApprovalRecord & {
  temp_voucher: {
    id: number
    serial_number: string | null
    amount: number | null
    status: string
    funds_payment: VoucherPaymentRef
  } | null
}

// 各列的統一顯示模型，讓待審核與歷史紀錄共用同一套 9 欄渲染
type NormalizedRow = {
  id: number
  serial_number: string | null
  status: string
  amount: number | null            // 沖銷金額
  payment_account: string | null
  name: string | null
  expense_item: string | null
  payment_method: string | null
  approved_amount: number | null   // 母付款憑單核准金額
  payee: string | null
  step_name?: string
}

function normalizePayment(fp: VoucherPaymentRef, payeeLabel: string | null) {
  return {
    name: fp?.name ?? null,
    expense_item: fp?.expense_item ?? null,
    payment_method: fp?.payment_method ?? null,
    approved_amount: fp?.approved_amount ?? null,
    payee: payeeLabel ? (fp?.extra_data?.[payeeLabel] ?? null) : null,
  }
}

function normalizeItem(r: VoucherItem, payeeLabel: string | null): NormalizedRow {
  return {
    id: r.id,
    serial_number: r.serial_number,
    status: r.status,
    amount: r.amount,
    payment_account: r.payment_account,
    step_name: r.step_name,
    ...normalizePayment(r.funds_payment, payeeLabel),
  }
}

function normalizeHistory(r: HistoryItem, payeeLabel: string | null): NormalizedRow {
  const tv = r.temp_voucher
  return {
    id: tv?.id ?? r.temp_voucher_id ?? 0,
    serial_number: tv?.serial_number ?? null,
    status: tv?.status ?? (r.decision === 'approved' ? 'approved' : 'rejected'),
    amount: tv?.amount ?? null,
    payment_account: tv?.funds_payment?.payment_account ?? null,
    step_name: r.step_name ?? undefined,
    ...normalizePayment(tv?.funds_payment ?? null, payeeLabel),
  }
}

const COLUMNS_AFTER_STATUS = [
  '暫付款沖銷憑單號',
  '費用項目',
  '項目',
  '付款對象',
  '付款方式',
  '核准金額',
  '沖銷金額',
  '發票憑證',
] as const

function VoucherCells({ r, attachments }: { r: NormalizedRow; attachments: VoucherAttachment[] }) {
  return (
    <>
      <TableCell>
        <Link href={`/funds-voucher/review/check/${r.id}`} className="text-sm text-primary underline underline-offset-4">
          {r.serial_number ?? `#${r.id}`}
        </Link>
      </TableCell>
      <TableCell>{r.expense_item ?? '-'}</TableCell>
      <TableCell>{r.name ?? '-'}</TableCell>
      <TableCell>{r.payee ?? '-'}</TableCell>
      <TableCell>{r.payment_method ?? '-'}</TableCell>
      <TableCell className="whitespace-nowrap">{r.approved_amount != null ? r.approved_amount.toLocaleString() : '-'}</TableCell>
      <TableCell className="whitespace-nowrap">{r.amount != null ? r.amount.toLocaleString() : '-'}</TableCell>
      <TableCell>
        {attachments.length === 0 ? '-' : (
          <div className="flex flex-col gap-0.5">
            {attachments.map((a, i) => (
              <a
                key={i}
                href={a.url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="whitespace-nowrap text-sm text-primary underline underline-offset-4"
              >
                {a.file_name}
              </a>
            ))}
          </div>
        )}
      </TableCell>
    </>
  )
}

// 搜尋欄位：沖銷單號、費用項目、項目、付款對象、付款方式
const buildSearch = (): Array<(r: NormalizedRow) => string | null | undefined> => [
  (r) => r.serial_number,
  (r) => r.expense_item,
  (r) => r.name,
  (r) => r.payee,
  (r) => r.payment_method,
]

type Props = {
  visibleTabs: TabDef[]
  tabItems: Record<string, VoucherItem[]>
  historyItems: HistoryItem[]
  paymentAccounts: string[]
  labelConfig: StatusLabelConfig
  payeeLabel: string | null
  attachmentsMap: VoucherAttachmentMap
  selectedYear: number
  selectedWeekStart: string
}

export default function VoucherReviewClient({
  visibleTabs,
  tabItems,
  historyItems,
  paymentAccounts,
  labelConfig,
  payeeLabel,
  attachmentsMap,
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

  const q = query.trim().toLowerCase()
  const matches = (r: NormalizedRow) => !q || buildSearch().some(fn => fn(r)?.toLowerCase().includes(q))

  const pendingCount = (key: string) =>
    (tabItems[key] ?? []).filter(r => r.is_pending_here === true).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader
          title="審核管理"
          action={
            <Input
              placeholder="搜尋沖銷單號、費用項目、付款對象…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-64 bg-background"
            />
          }
        />
        <p className="mt-1 text-sm text-muted-foreground">
          暫付款沖銷憑單的審核任務與歷史記錄
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
              onChange={year => router.push(`/funds-voucher/review?year=${year}`)}
            />
            <WeekDropdown
              selectedYear={selectedYear}
              selectedWeekStart={selectedWeekStart}
              align="right"
              onChange={weekStart => router.push(`/funds-voucher/review?year=${selectedYear}&weekStart=${weekStart}`)}
            />
          </div>
        )}
      </div>

      {activeTab === 'history' ? (
        <HistoryList
          rows={historyItems.map(r => normalizeHistory(r, payeeLabel)).filter(matches)}
          labelConfig={labelConfig}
          attachmentsMap={attachmentsMap}
        />
      ) : (
        <AccountGroupedList
          rows={(tabItems[activeTab] ?? []).map(r => normalizeItem(r, payeeLabel)).filter(matches)}
          paymentAccounts={paymentAccounts}
          labelConfig={labelConfig}
          attachmentsMap={attachmentsMap}
        />
      )}
    </div>
  )
}

function AccountGroupedList({
  rows,
  paymentAccounts,
  labelConfig,
  attachmentsMap,
}: {
  rows: NormalizedRow[]
  paymentAccounts: string[]
  labelConfig: StatusLabelConfig
  attachmentsMap: VoucherAttachmentMap
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">本週沒有相關憑單</p>

  const groupMap = rows.reduce<Record<string, NormalizedRow[]>>((acc, r) => {
    const key = r.payment_account ?? '（未指定帳戶）'
    ;(acc[key] ??= []).push(r)
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
                <TableHead>狀態</TableHead>
                {COLUMNS_AFTER_STATUS.map(col => <TableHead key={col}>{col}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupMap[account].map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <StatusBadge module="temp_voucher" status={r.status} stepName={r.step_name} labelConfig={labelConfig} />
                  </TableCell>
                  <VoucherCells r={r} attachments={attachmentsMap[r.id] ?? []} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ))}
    </div>
  )
}

function HistoryList({
  rows,
  labelConfig,
  attachmentsMap,
}: {
  rows: NormalizedRow[]
  labelConfig: StatusLabelConfig
  attachmentsMap: VoucherAttachmentMap
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">尚無審核紀錄</p>
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>狀態</TableHead>
            {COLUMNS_AFTER_STATUS.map(col => <TableHead key={col}>{col}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.id}>
              <TableCell>
                <StatusBadge module="temp_voucher" status={r.status} stepName={r.step_name} labelConfig={labelConfig} />
              </TableCell>
              <VoucherCells r={r} attachments={attachmentsMap[r.id] ?? []} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
