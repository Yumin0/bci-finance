'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MOCK_USER_ID, PAYMENT_STATUS } from '@/lib/constants'
import { FundsPayment, StepDecision } from '@/lib/types'
import { Button } from '@/components/ui/button'
import PaymentApprovalPanel from '@/app/funds-payment/_components/PaymentApprovalPanel'
import FundsPaymentDetail from '@/app/funds-payment/_components/FundsPaymentDetail'

export default function PaymentStep1CheckPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<FundsPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [decision, setDecision] = useState<StepDecision>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { id } = await params
      const { data, error: fetchError } = await supabase
        .from('funds_payment')
        .select('*')
        .eq('id', Number(id))
        .single()
      if (fetchError) setError(fetchError.message)
      else setRecord(data as FundsPayment)
      setLoading(false)
    }
    load()
  }, [params])

  const canReview = record?.status === PAYMENT_STATUS.PENDING_STEP1

  async function handleSubmit() {
    if (!record || !decision) return
    setSubmitting(true)
    setError(null)

    const newStatus = decision === 'approved' ? PAYMENT_STATUS.PENDING_STEP2 : PAYMENT_STATUS.REJECTED_STEP1

    const { error: updateError } = await supabase
      .from('funds_payment')
      .update({
        status: newStatus,
        step1_decision: decision,
        step1_comment: comment || null,
        step1_reviewer: MOCK_USER_ID,
        step1_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id)

    if (updateError) { setError(updateError.message); setSubmitting(false); return }
    router.push('/funds-payment/step1')
  }

  if (loading) return <p>載入中...</p>
  if (!record) return <p style={{ color: 'red' }}>找不到此付款憑單{error ? `：${error}` : ''}</p>

  return (
    <div>
      <FundsPaymentDetail record={record} />

      <PaymentApprovalPanel
        record={record}
        currentStep={1}
        canReview={canReview}
        decision={decision}
        comment={comment}
        submitting={submitting}
        onDecisionChange={setDecision}
        onCommentChange={setComment}
        onSubmit={handleSubmit}
      />

      {!canReview && !record.step1_decision && (
        <p style={{ color: 'gray', marginTop: 12 }}>此付款憑單目前狀態為「{record.status}」，不在課級審核階段。</p>
      )}

      {error && <p style={{ color: 'red', marginTop: 12 }}>錯誤：{error}</p>}

      <Button variant="outline" onClick={() => router.back()} className="mt-4">返回列表</Button>
    </div>
  )
}
