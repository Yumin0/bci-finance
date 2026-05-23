'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsAllocation, FormBlock } from '@/lib/types'
import { createPayment } from '@/app/actions/payment'
import { getFormSchemas } from '@/app/actions/form-schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const PAYMENT_METHODS = ['匯款', '支票', '現金', '其他']

function getAllocFieldValue(fieldId: string, record: FundsAllocation): string {
  const map: Record<string, unknown> = {
    purchase_order_number: record.serial_number ? `${record.serial_number}001` : '-',
    date: record.date,
    apply_division: record.apply_division,
    apply_section: record.apply_section,
    applicant: record.applicant,
    apply_role: record.apply_role,
    institution: record.institution,
    payment_account: record.payment_account,
    expense_item: record.expense_item,
    name: record.name,
    amount: record.amount,
    category: record.category,
    note: record.note,
  }
  const val = map[fieldId]
  if (val == null || val === '') return '-'
  return String(val)
}

export default function AddPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<FundsAllocation | null>(null)
  const [allocationId, setAllocationId] = useState<number | null>(null)
  const [schema, setSchema] = useState<FormBlock[]>([])
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
    getFormSchemas().then(s => setSchema(s.payment_voucher))
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
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>建立付款憑單</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>資金分配申請單 #{record.id}</p>

      {error && <p style={errorStyle}>錯誤：{error}</p>}

      <form onSubmit={handleSubmit}>
        {schema.map(block => (
          <div key={block.id} style={{
            marginBottom: 16,
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            overflow: 'hidden',
            background: 'var(--bg-card)',
          }}>
            {block.title && (
              <div style={{
                padding: '10px 20px',
                background: 'var(--bg-sidebar)',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>{block.title}</span>
              </div>
            )}
            <div style={{ padding: '20px 20px 4px' }}>
              {block.rows.map(row => (
                <div key={row.id} style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${row.cols}, 1fr)`,
                  gap: 20,
                  marginBottom: 20,
                }}>
                  {row.slots.map((slot, idx) => slot ? (
                    <div key={idx}>
                      <label style={labelStyle}>
                        {slot.label}
                        {slot.fieldId === 'payment_method' && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                      </label>
                      {slot.fieldId === 'payment_method' ? (
                        <select
                          value={paymentMethod}
                          onChange={e => setPaymentMethod(e.target.value)}
                          required
                          style={selectStyle}
                        >
                          <option value="">請選擇</option>
                          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      ) : slot.type === 'textarea' ? (
                        <Textarea value={getAllocFieldValue(slot.fieldId, record)} readOnly rows={4} className="bg-[var(--bg-page)] cursor-not-allowed" />
                      ) : (
                        <Input value={getAllocFieldValue(slot.fieldId, record)} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
                      )}
                    </div>
                  ) : <div key={idx} />)}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
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
