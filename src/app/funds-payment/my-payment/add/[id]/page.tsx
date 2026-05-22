'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsAllocation } from '@/lib/types'
import { createPayment } from '@/app/actions/payment'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const PAYMENT_METHODS = ['匯款', '支票', '現金', '其他']

export default function AddPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<FundsAllocation | null>(null)
  const [allocationId, setAllocationId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('')

  useEffect(() => {
    async function load() {
      const { id } = await params
      const numId = Number(id)
      setAllocationId(numId)
      const { data, error: fetchError } = await supabase
        .from('funds_allocation')
        .select('*')
        .eq('id', numId)
        .single()
      if (fetchError) { setError(fetchError.message); setLoading(false); return }
      setRecord(data as FundsAllocation)
      setLoading(false)
    }
    load()
  }, [params])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allocationId) return
    setSubmitting(true)
    setError(null)

    const { error: insertError } = await createPayment(allocationId, paymentMethod)
    if (insertError) { setError(insertError); setSubmitting(false); return }
    router.push('/funds-payment/my-payment')
  }

  if (loading) return <p>載入中...</p>
  if (!record) return <p style={{ color: 'red' }}>找不到資金分配申請單</p>

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>建立付款憑單</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>資金分配申請單 #{record.id}</p>

      {error && <p style={errorStyle}>錯誤：{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>日期</label>
          <Input value={record.date} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
        </div>
        <div>
          <label style={labelStyle}>申請處別</label>
          <Input value={record.apply_division ?? '-'} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
        </div>
        <div>
          <label style={labelStyle}>申請課別</label>
          <Input value={record.apply_section ?? '-'} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
        </div>
        <div>
          <label style={labelStyle}>申請人</label>
          <Input value={record.applicant ?? '-'} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
        </div>
        <div>
          <label style={labelStyle}>職稱</label>
          <Input value={record.apply_role ?? '-'} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
        </div>
        <div>
          <label style={labelStyle}>機構</label>
          <Input value={record.institution ?? '-'} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
        </div>
        <div>
          <label style={labelStyle}>出款帳戶</label>
          <Input value={record.payment_account ?? '-'} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
        </div>
        <div>
          <label style={labelStyle}>費用項目</label>
          <Input value={record.expense_item ?? '-'} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
        </div>
        <div>
          <label style={labelStyle}>項目</label>
          <Input value={record.name} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
        </div>
        <div>
          <label style={labelStyle}>金額</label>
          <Input value={record.amount} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
        </div>
        <div>
          <label style={labelStyle}>備註</label>
          <Textarea value={record.note ?? ''} readOnly rows={3} className="bg-[var(--bg-page)] cursor-not-allowed" />
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

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
          <Button type="submit" disabled={submitting}>
            {submitting ? '建立中...' : '建立付款憑單'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
        </div>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const selectStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--btn-border)', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', background: 'white', cursor: 'pointer' }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginBottom: 8 }
