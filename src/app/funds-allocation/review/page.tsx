'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MOCK_USER_ID } from '@/lib/constants'
import { FundsAllocation, ApprovalRecord } from '@/lib/types'
import { formatDateTime } from '@/lib/dateUtils'
import Link from 'next/link'

type Tab = 'pending' | 'history'

type PendingItem = FundsAllocation & {
  step_name: string
}

type HistoryItem = ApprovalRecord & {
  funds_allocation: Pick<FundsAllocation, 'id' | 'name' | 'amount' | 'applicant' | 'apply_section'>
}

export default function ReviewPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)

      // 待我審核：抓所有 pending 申請，透過 template 取得當前步驟名稱
      // TODO: 串接真實 session 後，加入角色篩選（只顯示輪到自己審的）
      const { data: pending } = await supabase
        .from('funds_allocation')
        .select(`
          *,
          approval_flow_templates(
            name,
            approval_flow_steps(step_name, step_number)
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      const pendingMapped: PendingItem[] = (pending ?? []).map((r: FundsAllocation & {
        approval_flow_templates: {
          name: string
          approval_flow_steps: Array<{ step_name: string; step_number: number }>
        } | null
      }) => {
        const steps = r.approval_flow_templates?.approval_flow_steps ?? []
        const currentStepDef = steps.find(s => s.step_number === r.current_step)
        return { ...r, step_name: currentStepDef?.step_name ?? `第 ${r.current_step ?? 1} 步` }
      })

      // 我的審核紀錄：取出所有我審核過的記錄，每張申請單只保留最新一步
      const { data: historyRaw } = await supabase
        .from('approval_records')
        .select(`
          *,
          funds_allocation:funds_allocation_id(id, name, amount, applicant, apply_section)
        `)
        .eq('reviewer_id', MOCK_USER_ID)
        .not('decision', 'is', null)
        .order('reviewed_at', { ascending: false })
        .limit(500)

      // 每張申請單只取 step_number 最大的那筆
      const seen = new Map<number, HistoryItem>()
      for (const r of (historyRaw ?? []) as HistoryItem[]) {
        const allocId = r.funds_allocation_id ?? 0
        const existing = seen.get(allocId)
        if (!existing || r.step_number > existing.step_number) {
          seen.set(allocId, r)
        }
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
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>資金分配申請的審核任務與歷史記錄</p>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-color)', marginBottom: 24 }}>
        <button style={tabStyle('pending')} onClick={() => setTab('pending')}>
          待我審核
          {pendingItems.length > 0 && (
            <span style={{
              marginLeft: 6, fontSize: 11, background: '#dc2626',
              color: '#fff', borderRadius: 999, padding: '1px 8px',
              display: 'inline-block', fontWeight: 600,
            }}>
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
        <PendingList items={pendingItems} />
      ) : (
        <HistoryList items={historyItems} />
      )}
    </div>
  )
}

function PendingList({ items }: { items: PendingItem[] }) {
  if (items.length === 0) {
    return <p style={{ color: 'var(--text-subtle)', fontSize: 14 }}>目前沒有待審核的申請</p>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
            {['審核階段', '申請課別', '申請人', '項目名稱', '金額', ''].map((col, i) => (
              <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={td}>
                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, background: '#1d4ed8', color: '#fff', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  待審核 - {r.step_name}
                </span>
              </td>
              <td style={td}>{r.apply_section ?? '-'}</td>
              <td style={td}>{r.applicant ?? r.created_by}</td>
              <td style={td}>{r.name}</td>
              <td style={td}>{r.amount.toLocaleString()}</td>
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

function HistoryList({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) {
    return <p style={{ color: 'var(--text-subtle)', fontSize: 14 }}>尚無審核紀錄</p>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
            {['審核階段', '申請課別', '申請人', '項目名稱', '金額', '審核時間'].map((col, i) => (
              <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(r => {
            const approved = r.decision === 'approved'
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={td}>
                  <span style={{
                    fontSize: 12, padding: '3px 10px', borderRadius: 4, fontWeight: 500,
                    background: approved ? '#166534' : '#991b1b',
                    color: '#fff', whiteSpace: 'nowrap',
                  }}>
                    {approved ? '已核准' : '未核准'} - {r.step_name}
                  </span>
                </td>
                <td style={td}>{r.funds_allocation?.apply_section ?? '-'}</td>
                <td style={td}>{r.funds_allocation?.applicant ?? '-'}</td>
                <td style={td}>{r.funds_allocation?.name ?? '-'}</td>
                <td style={td}>{r.funds_allocation?.amount?.toLocaleString() ?? '-'}</td>
                <td style={td}>{r.reviewed_at ? formatDateTime(r.reviewed_at) : '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 16px', color: 'var(--text-title)' }
