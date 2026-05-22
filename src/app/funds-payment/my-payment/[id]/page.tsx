'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsPayment, ApprovalRecord } from '@/lib/types'
import { PAYMENT_STATUS } from '@/lib/constants'
import { getMyPayment, submitMyPayment } from '@/app/actions/payment'
import { Button, buttonVariants } from '@/components/ui/button'
import { formatDateTime } from '@/lib/dateUtils'

type RecordWithTemplate = FundsPayment & {
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
}

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<RecordWithTemplate | null>(null)
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { id } = await params
      const numId = Number(id)
      const [{ data, error: fetchError }, histRes] = await Promise.all([
        supabase.from('funds_payment')
          .select(`*, approval_flow_templates(name, approval_flow_steps(step_name, step_number))`)
          .eq('id', numId).single(),
        supabase.from('approval_records')
          .select('*').eq('funds_payment_id', numId).order('step_number'),
      ])
      if (fetchError || !data) { setNotFound(true) }
      else { setRecord(data as RecordWithTemplate) }
      setApprovalHistory((histRes.data as ApprovalRecord[]) ?? [])
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

  const isDraft = record!.status === PAYMENT_STATUS.DRAFT

  function statusLabel() {
    if (record!.status === 'approved') return '已核准'
    if (record!.status === 'rejected') return '已拒絕'
    if (isDraft) return '草稿'
    const step = record!.approval_flow_templates?.approval_flow_steps?.find(s => s.step_number === record!.current_step)
    return step ? `審核中・${step.step_name}` : '審核中'
  }

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

  return (
    <div>
      <div style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>付款憑單</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          狀態：<strong>{statusLabel()}</strong>　資金分配申請單 #
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
          <Link href="/funds-payment/my-payment" className={buttonVariants({ variant: 'outline' })}>返回列表</Link>
          {isDraft && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '送出中...' : '確定送出'}
            </Button>
          )}
        </div>
      </div>

      {/* 審核歷程 */}
      {approvalHistory.length > 0 && (
        <div style={{ marginTop: 40, maxWidth: 600 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>審核歷程</h2>
          {approvalHistory.map(r => (
            <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <strong style={{ fontSize: 13 }}>{r.step_name}</strong>
                <span style={{ fontSize: 12, color: r.decision === 'approved' ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
                  {r.decision === 'approved' ? '✓ 核准' : '✗ 不核准'}
                </span>
                {r.reviewed_at && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(r.reviewed_at)}</span>}
              </div>
              {r.comment && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 2 }
const valueStyle: React.CSSProperties = { fontSize: 14, color: 'var(--text-title)', padding: '8px 12px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: 6 }
