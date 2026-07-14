'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsPayment, FormBlock, FormSlot } from '@/lib/types'
import { getFormSchemas } from '@/app/actions/form-schema'
import { createTempVoucher } from '@/app/actions/temp-voucher'
import { saveAttachments } from '@/app/actions/attachments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { buttonVariants } from '@/components/ui/button'
import AttachmentUpload, { AttachmentItem } from '@/app/_components/AttachmentUpload'
import ErrorDialog from '@/app/_components/ErrorDialog'

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6,
}
const readonlyCls = 'bg-[var(--bg-page)] cursor-not-allowed'

function getPrefilledValue(fieldId: string, payment: FundsPayment): string {
  const map: Record<string, unknown> = {
    apply_division: payment.apply_division,
    apply_section:  payment.apply_section,
    applicant:      payment.applicant,
    apply_role:     payment.apply_role,
    amount:         payment.amount,
  }
  const val = map[fieldId]
  if (val == null || val === '') return ''
  return String(val)
}

function isReadonlyField(fieldId: string): boolean {
  return ['applicant', 'apply_division', 'apply_section', 'apply_role'].includes(fieldId)
}

export default function AddTempVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [payment, setPayment] = useState<FundsPayment | null>(null)
  const [paymentId, setPaymentId] = useState<number | null>(null)
  const [schema, setSchema] = useState<FormBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [pendingAttachments, setPendingAttachments] = useState<Record<string, AttachmentItem[]>>({})

  useEffect(() => {
    async function load() {
      const { id } = await params
      const numId = Number(id)
      setPaymentId(numId)

      const [{ data, error: fetchError }, schemas] = await Promise.all([
        supabase.from('funds_payment').select('*').eq('id', numId).single(),
        getFormSchemas(),
      ])

      if (fetchError || !data) {
        setError('找不到此付款憑單')
        setLoading(false)
        return
      }

      const p = data as FundsPayment
      setPayment(p)
      setSchema(schemas.temp_voucher)

      const prefilled: Record<string, string> = {}
      for (const block of schemas.temp_voucher) {
        for (const row of block.rows) {
          for (const slot of row.slots) {
            if (slot) prefilled[slot.fieldId] = getPrefilledValue(slot.fieldId, p)
          }
        }
      }
      setFieldValues(prefilled)
      setLoading(false)
    }
    load()
  }, [params])

  function setField(fieldId: string, value: string) {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }))
  }

  function renderSlot(slot: NonNullable<FormSlot>) {
    const value = fieldValues[slot.fieldId] ?? ''
    const readonly = isReadonlyField(slot.fieldId) || slot.type === 'readonly'

    if (slot.type === 'attachment') {
      const items = pendingAttachments[slot.label] ?? []
      return (
        <AttachmentUpload
          slotLabel={slot.label}
          attachments={items}
          onAdd={item => setPendingAttachments(prev => ({ ...prev, [slot.label]: [...(prev[slot.label] ?? []), item] }))}
          onRemove={item => setPendingAttachments(prev => ({ ...prev, [slot.label]: (prev[slot.label] ?? []).filter(a => a.storagePath !== item.storagePath) }))}
        />
      )
    }

    if (slot.type === 'textarea') {
      return (
        <Textarea
          value={value}
          readOnly={readonly}
          rows={4}
          className={readonly ? readonlyCls : ''}
          onChange={readonly ? undefined : e => setField(slot.fieldId, e.target.value)}
        />
      )
    }
    return (
      <Input
        type={slot.type === 'number' ? 'number' : slot.type === 'date' ? 'date' : 'text'}
        value={value}
        readOnly={readonly}
        className={readonly ? readonlyCls : ''}
        onChange={readonly ? undefined : e => setField(slot.fieldId, e.target.value)}
      />
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentId) return
    setSubmitting(true)
    setError(null)
    const { id: newVoucherId, error: saveError } = await createTempVoucher(paymentId, fieldValues)
    if (saveError) { setError(saveError); setSubmitting(false); return }

    const allAttachments = Object.values(pendingAttachments).flat()
    if (newVoucherId && allAttachments.length > 0) {
      await saveAttachments(null, null, allAttachments, newVoucherId)
    }

    router.push('/funds-voucher/my-voucher')
  }

  if (loading) return <p>載入中...</p>
  // 只有載入不到付款憑單才整頁換成錯誤畫面；送出被擋（例如沖銷金額檢查）時
  // 表單要保留讓使用者直接修改重送，錯誤訊息顯示在表單上方
  if (!payment) return (
    <div>
      <p style={{ color: '#dc2626' }}>{error ?? '載入失敗'}</p>
      <Link href="/funds-payment/my-payment" className={buttonVariants({ variant: 'outline' })}>返回</Link>
    </div>
  )

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href={`/funds-payment/my-payment/${paymentId}`} className={buttonVariants({ variant: 'outline' })}>
          ← 返回付款憑單
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>建立暫付款沖銷憑單</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        付款憑單 #{paymentId}
      </p>

      {/* 送出被擋（沖銷金額檢查等）改用全站共用中央彈窗 */}
      <ErrorDialog message={error} title="無法建立沖銷憑單" onClose={() => setError(null)} />

      <form onSubmit={handleSubmit}>
        {schema.map(block => (
          <div key={block.id} style={{
            marginBottom: 16,
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            overflow: 'hidden',
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
                      <label style={labelStyle}>{slot.label}</label>
                      {renderSlot(slot)}
                    </div>
                  ) : <div key={idx} />)}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? '建立中...' : '建立暫付款沖銷憑單'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
        </div>
      </form>
    </div>
  )
}
