'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { FundsPayment, StepDecision } from '@/lib/types'
import { PAYMENT_STATUS, PaymentStatus } from '@/lib/constants'
import PaymentApprovalPanel from '@/app/funds-payment/_components/PaymentApprovalPanel'
import { getMyPayment, submitMyPayment } from '@/app/actions/payment'
import { Button, buttonVariants } from '@/components/ui/button'

function getCurrentStep(status: PaymentStatus): 1 | 2 | 3 | 4 {
  if (status === PAYMENT_STATUS.PENDING_STEP2 || status === PAYMENT_STATUS.REJECTED_STEP2) return 2
  if (status === PAYMENT_STATUS.PENDING_STEP3 || status === PAYMENT_STATUS.REJECTED_STEP3) return 3
  if (status === PAYMENT_STATUS.PENDING_STEP4 || status === PAYMENT_STATUS.REJECTED_STEP4) return 4
  return 1
}

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<FundsPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { id } = await params
      const { data, error: fetchError } = await getMyPayment(Number(id))
      if (fetchError || !data) {
        setNotFound(true)
      } else {
        setRecord(data)
      }
      setLoading(false)
    }
    load()
  }, [params])

  async function handleSubmit() {
    if (!record) return
    setSubmitting(true)
    setError(null)
    const { error: updateError } = await submitMyPayment(record.id)
    if (updateError) { setError(updateError); setSubmitting(false); return }
    router.push('/funds-payment/my-payment')
  }

  if (loading) return <p>載入中...</p>
  if (notFound) return (
    <div>
      <p style={{ color: '#dc2626' }}>找不到此付款憑單，或你沒有權限檢視。</p>
      <Link href="/funds-payment/my-payment" style={{ fontSize: 14, color: '#2563eb' }}>返回列表</Link>
    </div>
  )

  const fields: { label: string; value: string | number | null }[] = [
    { label: '日期', value: record!.date },
    { label: '申請處別', value: record!.apply_division },
    { label: '申請課別', value: record!.apply_section },
    { label: '申請人', value: record!.applicant },
    { label: '職稱', value: record!.apply_role },
    { label: '機構', value: record!.institution },
    { label: '出款帳戶', value: record!.payment_account },
    { label: '費用項目', value: record!.expense_item },
    { label: '項目', value: record!.name },
    { label: '金額', value: record!.amount },
    { label: '類別', value: record!.category },
    { label: '備註', value: record!.note },
    { label: '付款方式', value: record!.payment_method },
  ]

  const isDraft = !record!.status || record!.status === PAYMENT_STATUS.DRAFT
  const showPanel = !isDraft

  return (
    <div>
      <div style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>付款憑單</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
          資金分配申請單 #
          <Link href={`/funds-allocation/my-funds/edit/${record!.funds_allocation_id}`} style={{ color: '#2563eb' }}>
            {record!.funds_allocation_id}
          </Link>
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {fields.map(({ label, value }) => (
            <div key={label}>
              <p style={labelStyle}>{label}</p>
              <p style={valueStyle}>{value ?? '-'}</p>
            </div>
          ))}
        </div>

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 16 }}>錯誤：{error}</p>}

        <div style={{ marginTop: 32, display: 'flex', gap: 8 }}>
          <Link href="/funds-payment/my-payment" className={buttonVariants({ variant: 'outline' })}>
            返回列表
          </Link>
          {isDraft && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '送出中...' : '確定送出'}
            </Button>
          )}
        </div>
      </div>

      {showPanel && (
        <div style={{ marginTop: 40 }}>
          <PaymentApprovalPanel
            record={record!}
            currentStep={getCurrentStep(record!.status)}
            canReview={false}
            decision={null as StepDecision}
            comment=""
            submitting={false}
            onDecisionChange={() => {}}
            onCommentChange={() => {}}
            onSubmit={() => {}}
          />
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 2 }
const valueStyle: React.CSSProperties = { fontSize: 14, color: 'var(--text-title)', padding: '8px 12px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: 6 }
