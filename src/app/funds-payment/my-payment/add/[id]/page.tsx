'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MOCK_USER_ID } from '@/lib/constants'
import { FundsAllocation } from '@/lib/types'

const PAYMENT_METHODS = ['匯款', '支票', '現金', '其他']

export default function AddPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<FundsAllocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('')

  useEffect(() => {
    async function load() {
      const { id } = await params
      const { data, error: fetchError } = await supabase
        .from('funds_allocation')
        .select('*')
        .eq('id', Number(id))
        .single()
      if (fetchError) { setError(fetchError.message); setLoading(false); return }
      setRecord(data as FundsAllocation)
      setLoading(false)
    }
    load()
  }, [params])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!record) return
    setSubmitting(true)
    setError(null)

    const { error: insertError } = await supabase.from('funds_payment').insert({
      funds_allocation_id: record.id,
      name: record.name,
      amount: record.amount,
      date: record.date,
      institution: record.institution,
      payment_account: record.payment_account,
      expense_item: record.expense_item,
      category: record.category,
      note: record.note,
      apply_division: record.apply_division,
      apply_section: record.apply_section,
      applicant: record.applicant,
      apply_role: record.apply_role,
      payment_method: paymentMethod || null,
      created_by: MOCK_USER_ID,
    })

    if (insertError) { setError(insertError.message); setSubmitting(false); return }
    router.push('/funds-payment/my-payment')
  }

  if (loading) return <p>載入中...</p>
  if (!record) return <p style={{ color: 'red' }}>找不到資金分配申請單</p>

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>建立付款憑單</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>資金分配申請單 #{record.id}</p>

      {error && <p style={errorStyle}>錯誤：{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>日期</label>
          <input value={record.date} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>申請處別</label>
          <input value={record.apply_division ?? '-'} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>申請課別</label>
          <input value={record.apply_section ?? '-'} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>申請人</label>
          <input value={record.applicant ?? '-'} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>職稱</label>
          <input value={record.apply_role ?? '-'} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>機構</label>
          <input value={record.institution ?? '-'} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>出款帳戶</label>
          <input value={record.payment_account ?? '-'} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>費用項目</label>
          <input value={record.expense_item ?? '-'} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>項目</label>
          <input value={record.name} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>金額</label>
          <input value={record.amount} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>備註</label>
          <textarea value={record.note ?? ''} readOnly rows={3} style={{ ...textareaStyle, background: '#f3f4f6', cursor: 'not-allowed' }} />
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />

        <div>
          <label style={labelStyle}>付款方式 *</label>
          <select
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value)}
            required
            style={selectStyle}
          >
            <option value="">請選擇</option>
            {PAYMENT_METHODS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={submitting} style={btnStyle}>
            {submitting ? '建立中...' : '建立付款憑單'}
          </button>
          <button type="button" onClick={() => router.back()} style={cancelStyle}>取消</button>
        </div>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }
const readonlyStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', background: '#f3f4f6', cursor: 'not-allowed' }
const selectStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', background: 'white', cursor: 'pointer' }
const textareaStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }
const btnStyle: React.CSSProperties = { padding: '8px 20px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const cancelStyle: React.CSSProperties = { padding: '8px 20px', background: 'none', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, cursor: 'pointer' }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginBottom: 8 }
