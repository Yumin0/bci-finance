'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
            <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
              {['項次', '出款帳戶', '可分配總額', '預算提供'].map((col, i) => (
                <th
                  key={i}
                  style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-body)', whiteSpace: 'nowrap' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-subtle)' }}>
                  尚無出款帳戶，請先至「支出欄位設定」新增。
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={row.account} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={td}>{idx + 1}</td>
                <td style={td}>{row.account}</td>
                <td style={td}>
                  {row.budget != null
                    ? row.budget.toLocaleString()
                    : <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                </td>
                <td style={td}>
                  <Button variant="outline" size="sm" onClick={() => openModal(row.account)}>
                    輸入金額
                  </Button>
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
            background: 'var(--bg-card)', borderRadius: 12, width: 480, maxWidth: '90vw',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color)',
            }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>請輸入本周預算</span>
              <button
                onClick={closeModal}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '28px 24px' }}>
              <Input
                type="number"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
                placeholder="20000"
                autoFocus
              />
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end',
              padding: '12px 24px 20px', borderTop: '1px solid var(--border-color)',
            }}>
              <Button
                onClick={handleConfirm}
                disabled={saving}
                className="bg-green-400 hover:bg-green-500 text-white"
              >
                確認
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 16px', color: 'var(--text-title)' }
