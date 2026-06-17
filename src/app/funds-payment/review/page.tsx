'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsPayment, ApprovalRecord, FormSlot } from '@/lib/types'
import { getPendingPaymentsForReviewer } from '@/app/actions/approval-flow'
import { getMySession } from '@/app/actions/auth'
import Link from 'next/link'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { getFormSchemas } from '@/app/actions/form-schema'
import { DEFAULT_STATUS_LABEL_CONFIG, type StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buttonVariants } from '@/components/ui/button'
import PageHeader from '@/app/_components/PageHeader'

const buildPendingSearch = (payeeLabel: string | null): Array<(r: PendingItem) => string | null | undefined> => [
  (r) => r.purchase_order_number,
  (r) => r.name,
  (r) => r.payment_method,
  ...(payeeLabel ? [(r: PendingItem) => r.extra_data?.[payeeLabel]] : []),
]
const buildHistorySearch = (payeeLabel: string | null): Array<(r: HistoryItem) => string | null | undefined> => [
  (r) => r.funds_payment?.purchase_order_number,
  (r) => r.funds_payment?.name,
  (r) => r.funds_payment?.payment_method,
  ...(payeeLabel ? [(r: HistoryItem) => r.funds_payment?.extra_data?.[payeeLabel]] : []),
]

type Tab = 'pending' | 'history'

type PendingItem = FundsPayment & { step_name: string }

type HistoryItem = ApprovalRecord & {
  funds_payment: Pick<FundsPayment, 'id' | 'name' | 'amount' | 'status' | 'purchase_order_number' | 'payment_method' | 'extra_data'> | null
}

export default function PaymentReviewPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [labelConfig, setLabelConfig] = useState<StatusLabelConfig>(DEFAULT_STATUS_LABEL_CONFIG)
  const [payeeLabel, setPayeeLabel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => { setQuery('') }, [tab])

  useEffect(() => {
    async function load() {
      setLoading(true)

      const [config, schemas, session] = await Promise.all([
        getStatusLabelConfig(),
        getFormSchemas(),
        getMySession(),
      ])

      const label = schemas.payment_voucher
        .flatMap(b => b.rows.flatMap(r => r.slots))
        .find((s): s is NonNullable<FormSlot> => s !== null && s.dataSource?.startsWith('payee_records:') === true)
        ?.label ?? null
      setPayeeLabel(label)
      setLabelConfig(config)

      const userId = session.userId
      if (!userId) { setLoading(false); return }

      const [pendingData, historyRaw] = await Promise.all([
        getPendingPaymentsForReviewer(userId),
        supabase
          .from('approval_records')
          .select(`*, funds_payment:funds_payment_id(id, name, amount, status, purchase_order_number, payment_method, extra_data)`)
          .eq('reviewer_id', String(userId))
          .not('decision', 'is', null)
          .not('funds_payment_id', 'is', null)
          .order('reviewed_at', { ascending: false })
          .limit(500),
      ])

      const pendingMapped: PendingItem[] = (pendingData as unknown as PendingItem[])

      const seen = new Map<number, HistoryItem>()
      for (const r of (historyRaw.data ?? []) as HistoryItem[]) {
        const pid = r.funds_payment_id ?? 0
        const existing = seen.get(pid)
        if (!existing || r.step_number > existing.step_number) seen.set(pid, r)
      }
      const deduped = Array.from(seen.values()).sort(
        (a, b) => new Date(b.reviewed_at ?? '').getTime() - new Date(a.reviewed_at ?? '').getTime()
      )

      setPendingItems(pendingMapped)
      setHistoryItems(deduped)
      setLoading(false)
    }
    load()
  }, [])

  const filteredPending = query.trim()
    ? pendingItems.filter(r => buildPendingSearch(payeeLabel).some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
    : pendingItems
  const filteredHistory = query.trim()
    ? historyItems.filter(r => buildHistorySearch(payeeLabel).some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
    : historyItems

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
        <p className="mt-1 text-sm text-muted-foreground">付款憑單的審核任務與歷史記錄</p>
      </div>

      <div className="flex border-b border-border">
        <button onClick={() => setTab('pending')} className={`-mb-px whitespace-nowrap border-b-2 px-5 py-2 text-sm font-medium transition-colors ${tab === 'pending' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          待我審核
          {pendingItems.length > 0 && (
            <span className="ml-1.5 inline-block rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-white">{pendingItems.length}</span>
          )}
        </button>
        <button onClick={() => setTab('history')} className={`-mb-px whitespace-nowrap border-b-2 px-5 py-2 text-sm font-medium transition-colors ${tab === 'history' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          我的審核紀錄
        </button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">載入中...</p>
        : tab === 'pending' ? <PendingList items={filteredPending} labelConfig={labelConfig} payeeLabel={payeeLabel} />
        : <HistoryList items={filteredHistory} labelConfig={labelConfig} payeeLabel={payeeLabel} />}
    </div>
  )
}

function PendingList({ items, labelConfig, payeeLabel }: { items: PendingItem[]; labelConfig: StatusLabelConfig; payeeLabel: string | null }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">目前沒有待審核的憑單</p>
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
              <TableCell><StatusBadge module="payment_voucher" status="pending" stepName={r.step_name} labelConfig={labelConfig} /></TableCell>
              <TableCell><Link href={`/funds-payment/review/check/${r.id}`} className="text-sm text-primary underline underline-offset-4">{r.purchase_order_number ?? '-'}</Link></TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>{r.payment_method ?? '-'}</TableCell>
              <TableCell>{payeeLabel ? (r.extra_data?.[payeeLabel] ?? '-') : '-'}</TableCell>
              <TableCell>{r.amount.toLocaleString()}</TableCell>
              <TableCell><Link href={`/funds-payment/review/check/${r.id}`} className={buttonVariants({ variant: 'default', size: 'sm' })}>審核</Link></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
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
