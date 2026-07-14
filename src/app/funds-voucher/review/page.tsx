'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ApprovalRecord } from '@/lib/types'
import { getPendingVouchersForReviewer } from '@/app/actions/approval-flow'
import { getMySession } from '@/app/actions/auth'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { DEFAULT_STATUS_LABEL_CONFIG, type StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import { formatDateTime } from '@/lib/dateUtils'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buttonVariants } from '@/components/ui/button'
import PageHeader from '@/app/_components/PageHeader'

// 搜尋欄位設定：要新增或移除搜尋欄位只改這裡
const PENDING_SEARCH: Array<(r: TempVoucherRow) => string | null | undefined> = [
  (r) => r.apply_section,
  (r) => r.applicant,
  (r) => r.serial_number,
]
const HISTORY_SEARCH: Array<(r: HistoryItem) => string | null | undefined> = [
  (r) => r.temp_voucher?.apply_section,
  (r) => r.temp_voucher?.applicant,
  (r) => r.temp_voucher?.serial_number,
]

type Tab = 'pending' | 'history'

type TempVoucherRow = {
  id: number
  funds_payment_id: number
  serial_number: string | null
  date: string | null
  applicant: string | null
  apply_section: string | null
  amount: number | null
  status: string
  current_step: number | null
  approval_flow_templates: {
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
  step_name?: string
}

type HistoryItem = ApprovalRecord & {
  temp_voucher: Pick<TempVoucherRow, 'id' | 'serial_number' | 'applicant' | 'apply_section' | 'amount' | 'status'> | null
}

export default function VoucherReviewPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [pendingItems, setPendingItems] = useState<TempVoucherRow[]>([])
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [labelConfig, setLabelConfig] = useState<StatusLabelConfig>(DEFAULT_STATUS_LABEL_CONFIG)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => { setQuery('') }, [tab])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [config, session] = await Promise.all([
        getStatusLabelConfig(),
        getMySession(),
      ])
      setLabelConfig(config)

      const userId = session.userId
      if (!userId) { setLoading(false); return }

      const [pendingData, historyRaw] = await Promise.all([
        getPendingVouchersForReviewer(userId),
        supabase
          .from('approval_records')
          .select(`*, temp_voucher:temp_voucher_id(id, serial_number, applicant, apply_section, amount, status)`)
          .eq('reviewer_id', String(userId))
          .not('decision', 'is', null)
          .not('temp_voucher_id', 'is', null)
          .order('reviewed_at', { ascending: false })
          .limit(500),
      ])

      const pendingMapped: TempVoucherRow[] = (pendingData as unknown as TempVoucherRow[])

      const seen = new Map<number, HistoryItem>()
      for (const r of (historyRaw.data ?? []) as HistoryItem[]) {
        const vid = r.temp_voucher_id ?? 0
        const existing = seen.get(vid)
        if (!existing || r.step_number > existing.step_number) seen.set(vid, r)
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
    ? pendingItems.filter(r => PENDING_SEARCH.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
    : pendingItems
  const filteredHistory = query.trim()
    ? historyItems.filter(r => HISTORY_SEARCH.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
    : historyItems

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader
          title="審核管理"
          action={
            <Input
              placeholder="搜尋申請課別、申請人…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-64 bg-background"
            />
          }
        />
        <p className="mt-1 text-sm text-muted-foreground">暫付款沖銷憑單的審核任務與歷史記錄</p>
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
        : tab === 'pending' ? <PendingList items={filteredPending} labelConfig={labelConfig} />
        : <HistoryList items={filteredHistory} labelConfig={labelConfig} />}
    </div>
  )
}

function PendingList({ items, labelConfig }: { items: TempVoucherRow[]; labelConfig: StatusLabelConfig }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">目前沒有待審核的憑單</p>
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            {['狀態', '暫付款沖銷憑單號', '申請課別', '申請人', '暫付金額', ''].map((col, i) => <TableHead key={i}>{col}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(r => (
            <TableRow key={r.id}>
              <TableCell><StatusBadge module="temp_voucher" status="pending" stepName={r.step_name ?? null} labelConfig={labelConfig} /></TableCell>
              <TableCell>
                <Link href={`/funds-voucher/review/check/${r.id}`} className="text-sm text-primary underline underline-offset-4">
                  {r.serial_number ?? `#${r.id}`}
                </Link>
              </TableCell>
              <TableCell>{r.apply_section ?? '-'}</TableCell>
              <TableCell>{r.applicant ?? '-'}</TableCell>
              <TableCell>{r.amount != null ? r.amount.toLocaleString() : '-'}</TableCell>
              <TableCell><Link href={`/funds-voucher/review/check/${r.id}`} className={buttonVariants({ variant: 'default', size: 'sm' })}>審核</Link></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function HistoryList({ items, labelConfig }: { items: HistoryItem[]; labelConfig: StatusLabelConfig }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">尚無審核紀錄</p>
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            {['審核結果', '暫付款沖銷憑單號', '申請課別', '申請人', '暫付金額', '審核時間', ''].map((col, i) => <TableHead key={i}>{col}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(r => (
            <TableRow key={r.id}>
              <TableCell>
                <StatusBadge module="temp_voucher" status={r.temp_voucher?.status ?? (r.decision === 'approved' ? 'approved' : 'rejected')} stepName={r.step_name} labelConfig={labelConfig} />
              </TableCell>
              <TableCell>
                {r.temp_voucher_id ? (
                  <Link href={`/funds-voucher/review/check/${r.temp_voucher_id}`} className="text-sm text-primary underline underline-offset-4">
                    {r.temp_voucher?.serial_number ?? `#${r.temp_voucher_id}`}
                  </Link>
                ) : '-'}
              </TableCell>
              <TableCell>{r.temp_voucher?.apply_section ?? '-'}</TableCell>
              <TableCell>{r.temp_voucher?.applicant ?? '-'}</TableCell>
              <TableCell>{r.temp_voucher?.amount != null ? r.temp_voucher.amount.toLocaleString() : '-'}</TableCell>
              <TableCell>{r.reviewed_at ? formatDateTime(r.reviewed_at) : '-'}</TableCell>
              <TableCell>
                {r.temp_voucher_id && <Link href={`/funds-voucher/review/check/${r.temp_voucher_id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>查閱</Link>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
