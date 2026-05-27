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

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '10px 24px', fontSize: 14, fontWeight: tab === t ? 600 : 400,
    background: tab === t ? 'var(--bg-page)' : 'none',
    border: 'none', cursor: 'pointer',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    color: tab === t ? 'var(--text-title)' : 'var(--text-muted)',
  })

  const filteredPending = query.trim()
    ? pendingItems.filter(r => PENDING_SEARCH.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
    : pendingItems
  const filteredHistory = query.trim()
    ? historyItems.filter(r => HISTORY_SEARCH.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
    : historyItems

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>審核管理</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>資金分配申請的審核任務與歷史記錄</p>
        </div>
        <Input
          placeholder="搜尋單號、申請處別、申請課別、申請人、費用項目、項目名稱…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ width: 260, fontSize: 13 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-color)', marginBottom: 24 }}>
        <button style={tabStyle('pending')} onClick={() => setTab('pending')}>
          待我審核
          {pendingItems.length > 0 && (
            <span style={{ marginLeft: 6, fontSize: 11, background: '#dc2626', color: '#fff', borderRadius: 999, padding: '1px 8px', display: 'inline-block', fontWeight: 600 }}>
              {pendingItems.length}
            </span>
          )}
        </button>
        <button style={tabStyle('history')} onClick={() => setTab('history')}>
          我的審核紀錄
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>載入中...</p>
      ) : tab === 'pending' ? (
        <PendingList items={filteredPending} labelConfig={labelConfig} />
      ) : (
        <HistoryList items={filteredHistory} labelConfig={labelConfig} />
      )}
    </div>
  )
}

function PendingList({ items, labelConfig }: { items: PendingItem[]; labelConfig: StatusLabelConfig }) {
  if (items.length === 0) {
    return <p style={{ color: 'var(--text-subtle)', fontSize: 14 }}>目前沒有待審核的申請</p>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
            {['狀態', '單號', '申請處別', '申請課別', '申請人', '職稱', '金額', '出款帳戶', '費用項目', '項目', ''].map((col, i) => (
              <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={td}>
                <StatusBadge module="funds_allocation" status="pending" stepName={r.step_name} labelConfig={labelConfig} />
              </td>
              <td style={td}>
                <Link href={`/funds-allocation/review/check/${r.id}`}
                  style={{ color: '#2563eb', textDecoration: 'underline', fontSize: 13 }}>
                  {r.serial_number ?? '-'}
                </Link>
              </td>
              <td style={td}>{r.apply_division ?? '-'}</td>
              <td style={td}>{r.apply_section ?? '-'}</td>
              <td style={td}>{r.applicant ?? r.created_by}</td>
              <td style={td}>{r.apply_role ?? '-'}</td>
              <td style={td}>{r.amount.toLocaleString()}</td>
              <td style={td}>{r.payment_account ?? '-'}</td>
              <td style={td}>{r.expense_item ?? '-'}</td>
              <td style={td}>{r.name}</td>
              <td style={td}>
                <Link
                  href={`/funds-allocation/review/check/${r.id}`}
                  style={{ fontSize: 13, color: 'var(--text-body)', border: '1px solid var(--btn-border)', borderRadius: 4, padding: '4px 12px', textDecoration: 'none' }}
                >
                  審核
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HistoryList({ items, labelConfig }: { items: HistoryItem[]; labelConfig: StatusLabelConfig }) {
  if (items.length === 0) {
    return <p style={{ color: 'var(--text-subtle)', fontSize: 14 }}>尚無審核紀錄</p>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
            {['狀態', '單號', '申請處別', '申請課別', '申請人', '職稱', '金額', '出款帳戶', '費用項目', '項目', ''].map((col, i) => (
              <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={td}>
                <StatusBadge
                  module="funds_allocation"
                  status={r.funds_allocation?.status ?? (r.decision === 'approved' ? 'approved' : 'rejected')}
                  stepName={r.step_name}
                  labelConfig={labelConfig}
                />
              </td>
              <td style={td}>
                {r.funds_allocation_id ? (
                  <Link href={`/funds-allocation/review/check/${r.funds_allocation_id}`}
                    style={{ color: '#2563eb', textDecoration: 'underline', fontSize: 13 }}>
                    {r.funds_allocation?.serial_number ?? '-'}
                  </Link>
                ) : (r.funds_allocation?.serial_number ?? '-')}
              </td>
              <td style={td}>{r.funds_allocation?.apply_division ?? '-'}</td>
              <td style={td}>{r.funds_allocation?.apply_section ?? '-'}</td>
              <td style={td}>{r.funds_allocation?.applicant ?? '-'}</td>
              <td style={td}>{r.funds_allocation?.apply_role ?? '-'}</td>
              <td style={td}>{r.funds_allocation?.amount?.toLocaleString() ?? '-'}</td>
              <td style={td}>{r.funds_allocation?.payment_account ?? '-'}</td>
              <td style={td}>{r.funds_allocation?.expense_item ?? '-'}</td>
              <td style={td}>{r.funds_allocation?.name ?? '-'}</td>
              <td style={td}>
                {r.funds_allocation_id && (
                  <Link href={`/funds-allocation/review/check/${r.funds_allocation_id}`}
                    style={{ fontSize: 13, color: 'var(--text-body)', border: '1px solid var(--btn-border)', borderRadius: 4, padding: '4px 12px', textDecoration: 'none' }}>
                    查閱
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 16px', color: 'var(--text-title)' }
