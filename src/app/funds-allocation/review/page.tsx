'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MOCK_USER_ID } from '@/lib/constants'
import { FundsAllocation, ApprovalRecord } from '@/lib/types'
import Link from 'next/link'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { DEFAULT_STATUS_LABEL_CONFIG, type StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buttonVariants } from '@/components/ui/button'
import PageHeader from '@/app/_components/PageHeader'

const PENDING_SEARCH: Array<(r: PendingItem) => string | null | undefined> = [
  (r) => r.serial_number,
  (r) => r.apply_division,
  (r) => r.apply_section,
  (r) => r.applicant,
  (r) => r.expense_item,
  (r) => r.name,
]
const HISTORY_SEARCH: Array<(r: HistoryItem) => string | null | undefined> = [
  (r) => r.funds_allocation?.serial_number,
  (r) => r.funds_allocation?.apply_division,
  (r) => r.funds_allocation?.apply_section,
  (r) => r.funds_allocation?.applicant,
  (r) => r.funds_allocation?.expense_item,
  (r) => r.funds_allocation?.name,
]

type Tab = 'pending' | 'history'

type PendingItem = FundsAllocation & { step_name: string }

type HistoryItem = ApprovalRecord & {
  funds_allocation: Pick<FundsAllocation, 'id' | 'name' | 'amount' | 'status' | 'serial_number' | 'apply_division' | 'apply_section' | 'applicant' | 'apply_role' | 'payment_account' | 'expense_item'> | null
}

export default function ReviewPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [labelConfig, setLabelConfig] = useState<StatusLabelConfig>(DEFAULT_STATUS_LABEL_CONFIG)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => { setQuery('') }, [tab])

  useEffect(() => {
    async function load() {
      setLoading(true)

      const [config, pendingRes, historyRaw] = await Promise.all([
        getStatusLabelConfig(),
        supabase
          .from('funds_allocation')
          .select(`*, approval_flow_templates(name, approval_flow_steps(step_name, step_number))`)
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
        supabase
          .from('approval_records')
          .select(`*, funds_allocation:funds_allocation_id(id, name, amount, status, serial_number, apply_division, apply_section, applicant, apply_role, payment_account, expense_item)`)
          .eq('reviewer_id', MOCK_USER_ID)
          .not('decision', 'is', null)
          .not('funds_allocation_id', 'is', null)
          .order('reviewed_at', { ascending: false })
          .limit(500),
      ])

      setLabelConfig(config)

      const pendingMapped: PendingItem[] = (pendingRes.data ?? []).map((r: FundsAllocation & {
        approval_flow_templates: { name: string; approval_flow_steps: Array<{ step_name: string; step_number: number }> } | null
      }) => {
        const steps = r.approval_flow_templates?.approval_flow_steps ?? []
        const step = steps.find(s => s.step_number === r.current_step)
        return { ...r, step_name: step?.step_name ?? `第 ${r.current_step ?? 1} 步` }
      })

      const seen = new Map<number, HistoryItem>()
      for (const r of (historyRaw.data ?? []) as HistoryItem[]) {
        const allocId = r.funds_allocation_id ?? 0
        const existing = seen.get(allocId)
        if (!existing || r.step_number > existing.step_number) seen.set(allocId, r)
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
              placeholder="搜尋單號、申請處別、課別、申請人…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-64 bg-background"
            />
          }
        />
        <p className="mt-1 text-sm text-muted-foreground">資金分配申請的審核任務與歷史記錄</p>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => setTab('pending')}
          className={`-mb-px whitespace-nowrap border-b-2 px-5 py-2 text-sm font-medium transition-colors ${tab === 'pending' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          待我審核
          {pendingItems.length > 0 && (
            <span className="ml-1.5 inline-block rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-white">
              {pendingItems.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('history')}
          className={`-mb-px whitespace-nowrap border-b-2 px-5 py-2 text-sm font-medium transition-colors ${tab === 'history' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          我的審核紀錄
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">載入中...</p>
      ) : tab === 'pending' ? (
        <PendingList items={filteredPending} labelConfig={labelConfig} />
      ) : (
        <HistoryList items={filteredHistory} labelConfig={labelConfig} />
      )}
    </div>
  )
}

function PendingList({ items, labelConfig }: { items: PendingItem[]; labelConfig: StatusLabelConfig }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">目前沒有待審核的申請</p>
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            {['狀態', '單號', '申請處別', '申請課別', '申請人', '職稱', '金額', '出款帳戶', '費用項目', '項目', ''].map((col, i) => (
              <TableHead key={i}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(r => (
            <TableRow key={r.id}>
              <TableCell><StatusBadge module="funds_allocation" status="pending" stepName={r.step_name} labelConfig={labelConfig} /></TableCell>
              <TableCell><Link href={`/funds-allocation/review/check/${r.id}`} className="text-sm text-primary underline underline-offset-4">{r.serial_number ?? '-'}</Link></TableCell>
              <TableCell>{r.apply_division ?? '-'}</TableCell>
              <TableCell>{r.apply_section ?? '-'}</TableCell>
              <TableCell>{r.applicant ?? r.created_by}</TableCell>
              <TableCell>{r.apply_role ?? '-'}</TableCell>
              <TableCell>{r.amount.toLocaleString()}</TableCell>
              <TableCell>{r.payment_account ?? '-'}</TableCell>
              <TableCell>{r.expense_item ?? '-'}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell><Link href={`/funds-allocation/review/check/${r.id}`} className={buttonVariants({ variant: 'default', size: 'sm' })}>審核</Link></TableCell>
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
            {['狀態', '單號', '申請處別', '申請課別', '申請人', '職稱', '金額', '出款帳戶', '費用項目', '項目', ''].map((col, i) => (
              <TableHead key={i}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(r => (
            <TableRow key={r.id}>
              <TableCell>
                <StatusBadge module="funds_allocation" status={r.funds_allocation?.status ?? (r.decision === 'approved' ? 'approved' : 'rejected')} stepName={r.step_name} labelConfig={labelConfig} />
              </TableCell>
              <TableCell>
                {r.funds_allocation_id
                  ? <Link href={`/funds-allocation/review/check/${r.funds_allocation_id}`} className="text-sm text-primary underline underline-offset-4">{r.funds_allocation?.serial_number ?? '-'}</Link>
                  : (r.funds_allocation?.serial_number ?? '-')}
              </TableCell>
              <TableCell>{r.funds_allocation?.apply_division ?? '-'}</TableCell>
              <TableCell>{r.funds_allocation?.apply_section ?? '-'}</TableCell>
              <TableCell>{r.funds_allocation?.applicant ?? '-'}</TableCell>
              <TableCell>{r.funds_allocation?.apply_role ?? '-'}</TableCell>
              <TableCell>{r.funds_allocation?.amount?.toLocaleString() ?? '-'}</TableCell>
              <TableCell>{r.funds_allocation?.payment_account ?? '-'}</TableCell>
              <TableCell>{r.funds_allocation?.expense_item ?? '-'}</TableCell>
              <TableCell>{r.funds_allocation?.name ?? '-'}</TableCell>
              <TableCell>
                {r.funds_allocation_id && <Link href={`/funds-allocation/review/check/${r.funds_allocation_id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>查閱</Link>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
