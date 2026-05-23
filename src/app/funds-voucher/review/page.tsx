'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { MOCK_USER_ID } from '@/lib/constants'
import { ApprovalRecord } from '@/lib/types'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { DEFAULT_STATUS_LABEL_CONFIG, type StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import { formatDateTime } from '@/lib/dateUtils'

type Tab = 'pending' | 'history'

type TempVoucherRow = {
  id: number
  funds_payment_id: number
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
  temp_voucher: Pick<TempVoucherRow, 'id' | 'applicant' | 'apply_section' | 'amount' | 'status'> | null
}

export default function VoucherReviewPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [pendingItems, setPendingItems] = useState<TempVoucherRow[]>([])
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [labelConfig, setLabelConfig] = useState<StatusLabelConfig>(DEFAULT_STATUS_LABEL_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [config, pendingRes, historyRaw] = await Promise.all([
        getStatusLabelConfig(),
        supabase
          .from('temp_vouchers')
          .select(`*, approval_flow_templates(approval_flow_steps(step_name, step_number))`)
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
        supabase
          .from('approval_records')
          .select(`*, temp_voucher:temp_voucher_id(id, applicant, apply_section, amount, status)`)
          .eq('reviewer_id', MOCK_USER_ID)
          .not('decision', 'is', null)
          .not('temp_voucher_id', 'is', null)
          .order('reviewed_at', { ascending: false })
          .limit(500),
      ])

      setLabelConfig(config)

      const pendingMapped: TempVoucherRow[] = ((pendingRes.data ?? []) as TempVoucherRow[]).map(r => {
        const steps = r.approval_flow_templates?.approval_flow_steps ?? []
        const step = steps.find(s => s.step_number === r.current_step)
        return { ...r, step_name: step?.step_name ?? `第 ${r.current_step ?? 1} 步` }
      })

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

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '10px 24px', fontSize: 14, fontWeight: tab === t ? 600 : 400,
    background: tab === t ? 'var(--bg-page)' : 'none',
    border: 'none', cursor: 'pointer',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    color: tab === t ? 'var(--text-title)' : 'var(--text-muted)',
  })

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>審核管理</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>暫付款沖銷憑單的審核任務與歷史記錄</p>
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
        <button style={tabStyle('history')} onClick={() => setTab('history')}>我的審核紀錄</button>
      </div>

      {loading ? <p style={{ color: 'var(--text-muted)' }}>載入中...</p>
        : tab === 'pending' ? <PendingList items={pendingItems} labelConfig={labelConfig} />
        : <HistoryList items={historyItems} labelConfig={labelConfig} />}
    </div>
  )
}

function PendingList({ items, labelConfig }: { items: TempVoucherRow[]; labelConfig: StatusLabelConfig }) {
  if (items.length === 0) return <p style={{ color: 'var(--text-subtle)', fontSize: 14 }}>目前沒有待審核的憑單</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
            {['狀態', '申請課別', '申請人', '暫付金額', ''].map((col, i) => (
              <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={td}>
                <StatusBadge module="temp_voucher" status="pending" stepName={r.step_name ?? null} labelConfig={labelConfig} />
              </td>
              <td style={td}>{r.apply_section ?? '-'}</td>
              <td style={td}>{r.applicant ?? '-'}</td>
              <td style={td}>{r.amount != null ? r.amount.toLocaleString() : '-'}</td>
              <td style={td}>
                <Link href={`/funds-voucher/review/check/${r.id}`}
                  style={{ fontSize: 13, color: 'var(--text-body)', border: '1px solid var(--btn-border)', borderRadius: 4, padding: '4px 12px', textDecoration: 'none' }}>
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
  if (items.length === 0) return <p style={{ color: 'var(--text-subtle)', fontSize: 14 }}>尚無審核紀錄</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
            {['審核結果', '申請課別', '申請人', '暫付金額', '審核時間', ''].map((col, i) => (
              <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={td}>
                <StatusBadge
                  module="temp_voucher"
                  status={r.temp_voucher?.status ?? (r.decision === 'approved' ? 'approved' : 'rejected')}
                  stepName={r.step_name}
                  labelConfig={labelConfig}
                />
              </td>
              <td style={td}>{r.temp_voucher?.apply_section ?? '-'}</td>
              <td style={td}>{r.temp_voucher?.applicant ?? '-'}</td>
              <td style={td}>{r.temp_voucher?.amount != null ? r.temp_voucher.amount.toLocaleString() : '-'}</td>
              <td style={td}>{r.reviewed_at ? formatDateTime(r.reviewed_at) : '-'}</td>
              <td style={td}>
                {r.temp_voucher_id && (
                  <Link href={`/funds-voucher/review/check/${r.temp_voucher_id}`}
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
