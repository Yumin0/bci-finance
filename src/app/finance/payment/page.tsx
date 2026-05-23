'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsPayment } from '@/lib/types'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { confirmPayment } from '@/app/actions/payment'
import { DEFAULT_STATUS_LABEL_CONFIG, type StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import Link from 'next/link'

type PaymentRecord = FundsPayment & {
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

export default function FinancePaymentPage() {
  const [records, setRecords] = useState<PaymentRecord[]>([])
  const [labelConfig, setLabelConfig] = useState<StatusLabelConfig>(DEFAULT_STATUS_LABEL_CONFIG)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<Set<number>>(new Set())

  useEffect(() => {
    async function load() {
      const [{ data }, config] = await Promise.all([
        supabase
          .from('funds_payment')
          .select(`
            *,
            approval_flow_templates(name, approval_flow_steps(step_name, step_number)),
            approval_records!funds_payment_id(step_name, decision)
          `)
          .order('created_at', { ascending: false }),
        getStatusLabelConfig(),
      ])
      setRecords((data ?? []) as PaymentRecord[])
      setLabelConfig(config)
      setLoading(false)
    }
    load()
  }, [])

  function getStepName(r: PaymentRecord): string | null {
    if (r.status === 'pending') {
      return r.approval_flow_templates?.approval_flow_steps?.find(
        s => s.step_number === r.current_step
      )?.step_name ?? null
    }
    if (r.status === 'rejected') {
      return r.approval_records?.find(a => a.decision === 'rejected')?.step_name ?? null
    }
    if (r.status === 'approved') {
      const steps = r.approval_flow_templates?.approval_flow_steps ?? []
      if (steps.length === 0) return null
      return steps.reduce((max, s) => s.step_number > max.step_number ? s : max, steps[0])?.step_name ?? null
    }
    return null
  }

  async function handleConfirmPayment(id: number) {
    setConfirming(prev => new Set(prev).add(id))
    const result = await confirmPayment(id)
    if (!result.error) {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'paid' as FundsPayment['status'] } : r))
    }
    setConfirming(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const groups = records.reduce<Record<string, PaymentRecord[]>>((acc, r) => {
    const key = r.payment_account ?? '（未指定帳戶）'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  if (loading) return <p style={{ color: 'var(--text-muted)', padding: 32 }}>載入中...</p>

  if (Object.keys(groups).length === 0) {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>付款憑單管理</h1>
        <p style={{ color: 'var(--text-subtle)' }}>尚無付款憑單</p>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 28 }}>付款憑單管理</h1>

      {Object.entries(groups).map(([account, items]) => {
        const totalAmount = items
          .filter(r => r.status === 'approved' || r.status === 'paid')
          .reduce((sum, r) => sum + (r.amount ?? 0), 0)
        const paidAmount = items
          .filter(r => r.status === 'paid')
          .reduce((sum, r) => sum + (r.amount ?? 0), 0)

        return (
          <section key={account} style={{ marginBottom: 44 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingBottom: 10, marginBottom: 16,
              borderBottom: '2px solid var(--accent)',
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{account}</h2>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                實際付款總額：
                <span style={{ color: '#166534', fontWeight: 600 }}>{totalAmount.toLocaleString()}</span>
                {' '}元，已執行：
                <span style={{ color: '#1d4ed8', fontWeight: 600 }}>{paidAmount.toLocaleString()}</span>
                {' '}元
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 170 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 120 }} />
                  <col />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 72 }} />
                </colgroup>
                <thead>
                  <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
                    {['狀態', '申請人', '費用項目', '項目', '付款方式', '金額', '付款執行', ''].map((col, i) => (
                      <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={td}>
                        <StatusBadge
                          module="payment_voucher"
                          status={r.status}
                          stepName={getStepName(r)}
                          labelConfig={labelConfig}
                        />
                      </td>
                      <td style={td}>{r.applicant ?? '-'}</td>
                      <td style={td}>{r.expense_item ?? '-'}</td>
                      <td style={td}>{r.name}</td>
                      <td style={td}>{r.payment_method ?? '-'}</td>
                      <td style={td}>{r.amount.toLocaleString()}</td>
                      <td style={td}>
                        {r.status === 'approved' ? (
                          <button
                            onClick={() => handleConfirmPayment(r.id)}
                            disabled={confirming.has(r.id)}
                            style={{
                              fontSize: 13, padding: '5px 16px', borderRadius: 6,
                              background: confirming.has(r.id) ? '#d1d5db' : '#166534',
                              color: '#fff', border: 'none',
                              cursor: confirming.has(r.id) ? 'default' : 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {confirming.has(r.id) ? '處理中...' : '確認付款'}
                          </button>
                        ) : r.status === 'paid' ? (
                          <button disabled style={{
                            fontSize: 13, padding: '5px 16px', borderRadius: 6,
                            background: '#e5e7eb', color: '#9ca3af',
                            border: 'none', cursor: 'default', whiteSpace: 'nowrap',
                            minWidth: 80,
                          }}>
                            已付款
                          </button>
                        ) : (
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={td}>
                        <Link
                          href={`/funds-payment/my-payment/${r.id}`}
                          style={{ fontSize: 13, color: 'var(--text-body)', border: '1px solid var(--btn-border)', borderRadius: 4, padding: '4px 12px', textDecoration: 'none' }}
                        >
                          查閱
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 16px', color: 'var(--text-title)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
