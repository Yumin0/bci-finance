'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type AccountRow = {
  account: string
  budget: number | null
}

export default function FundsPage() {
  const [rows, setRows] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalAccount, setModalAccount] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadData() {
    const [optRes, budgetRes] = await Promise.all([
      supabase
        .from('dropdown_options')
        .select('label')
        .eq('field', 'payment_account')
        .order('sort_order'),
      supabase.from('fund_budgets').select('payment_account, budget'),
    ])

    if (optRes.error) { setError(optRes.error.message); setLoading(false); return }
    if (budgetRes.error) { setError(budgetRes.error.message); setLoading(false); return }

    const budgetMap: Record<string, number> = {}
    for (const b of budgetRes.data ?? []) {
      budgetMap[b.payment_account] = b.budget
    }

    setRows(
      (optRes.data ?? []).map(o => ({
        account: o.label,
        budget: budgetMap[o.label] ?? null,
      }))
    )
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function openModal(account: string) {
    const current = rows.find(r => r.account === account)
    setInputValue(current?.budget != null ? String(current.budget) : '')
    setModalAccount(account)
  }

  function closeModal() {
    setModalAccount(null)
    setInputValue('')
  }

  async function handleConfirm() {
    if (!modalAccount) return
    const num = Number(inputValue)
    if (isNaN(num) || inputValue.trim() === '') return
    setSaving(true)
    const { error: e } = await supabase
      .from('fund_budgets')
      .upsert(
        { payment_account: modalAccount, budget: num, updated_at: new Date().toISOString() },
        { onConflict: 'payment_account' }
      )
    setSaving(false)
    if (e) { setError(e.message); return }
    setRows(prev =>
      prev.map(r => r.account === modalAccount ? { ...r, budget: num } : r)
    )
    closeModal()
  }

  if (loading) return <p style={{ padding: 24 }}>載入中...</p>

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>資金管理</h1>

      {error && <p style={{ color: '#dc2626', marginBottom: 16 }}>錯誤：{error}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['項次', '出款帳戶', '可分配總額', '預算提供'].map((col, i) => (
                <th
                  key={i}
                  style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af' }}>
                  尚無出款帳戶，請先至「支出欄位設定」新增。
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={row.account} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={td}>{idx + 1}</td>
                <td style={td}>{row.account}</td>
                <td style={td}>
                  {row.budget != null
                    ? row.budget.toLocaleString()
                    : <span style={{ color: '#9ca3af' }}>—</span>}
                </td>
                <td style={td}>
                  <button
                    onClick={() => openModal(row.account)}
                    style={{
                      padding: '5px 14px',
                      fontSize: 13,
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      background: '#fff',
                      cursor: 'pointer',
                      color: '#374151',
                    }}
                  >
                    輸入金額
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalAccount && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{
            background: '#fff', borderRadius: 12, width: 480, maxWidth: '90vw',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb',
            }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>請輸入本周預算</span>
              <button
                onClick={closeModal}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6b7280', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '28px 24px' }}>
              <input
                type="number"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
                placeholder="20000"
                autoFocus
                style={{
                  width: '100%', padding: '10px 14px', fontSize: 15,
                  border: '1px solid #d1d5db', borderRadius: 8,
                  boxSizing: 'border-box', outline: 'none',
                }}
              />
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end',
              padding: '12px 24px 20px', borderTop: '1px solid #e5e7eb',
            }}>
              <button
                onClick={handleConfirm}
                disabled={saving}
                style={{
                  padding: '10px 28px', background: '#4ade80', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                }}
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 16px', color: '#111827' }
