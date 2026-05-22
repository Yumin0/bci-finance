'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MOCK_USER_ID, FUNDS_STATUS } from '@/lib/constants'
import { FundsAllocation, StepDecision } from '@/lib/types'
import ApprovalPanel from '@/app/funds-allocation/_components/ApprovalPanel'
import FundsAllocationDetail from '@/app/funds-allocation/_components/FundsAllocationDetail'
import { Button } from '@/components/ui/button'

export default function Step2CheckPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<FundsAllocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [decision, setDecision] = useState<StepDecision>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { id } = await params
      const { data, error } = await supabase.from('funds_allocation').select('*').eq('id', Number(id)).single()
      if (error) setError(error.message)
      else setRecord(data as FundsAllocation)
      setLoading(false)
    }
    load()
  }, [params])

  const canReview = record?.status === FUNDS_STATUS.PENDING_STEP2

  async function handleSubmit() {
    if (!record || !decision) return
    setSubmitting(true)
    setError(null)

    const newStatus = decision === 'approved' ? FUNDS_STATUS.PENDING_STEP3 : FUNDS_STATUS.REJECTED_STEP2

    const { error: updateError } = await supabase
      .from('funds_allocation')
      .update({
        status: newStatus,
        step2_decision: decision,
        step2_comment: comment || null,
        step2_reviewer: MOCK_USER_ID,
        step2_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id)

    if (updateError) { setError(updateError.message); setSubmitting(false); return }
    router.push('/funds-allocation/step2')
  }

  if (loading) return <p>載入中...</p>
  if (!record) return <p style={{ color: 'red' }}>找不到此申請單</p>

  return (
    <div>
      <h1>處級審核</h1>

      <FundsAllocationDetail record={record} />

      <ApprovalPanel
        record={record}
        currentStep={2}
        canReview={canReview}
        decision={decision}
        comment={comment}
        submitting={submitting}
        onDecisionChange={setDecision}
        onCommentChange={setComment}
        onSubmit={handleSubmit}
      />

      {!canReview && (
        <p style={{ color: '#dc2626', marginTop: 12, fontWeight: 500 }}>
          此申請單目前狀態為「{record.status}」，不在處級審核階段。
          {!record.step2_decision && '請先完成課級審核，或至 Supabase 確認 status 欄位是否為「新單-處級」。'}
        </p>
      )}

      {error && <p style={{ color: 'red' }}>錯誤：{error}</p>}

      <Button variant="outline" onClick={() => router.back()} className="mt-4">返回列表</Button>
    </div>
  )
}
