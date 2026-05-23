'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsPayment, ApprovalRecord, FormBlock } from '@/lib/types'
import { PAYMENT_STATUS } from '@/lib/constants'
import { submitMyPayment } from '@/app/actions/payment'
import { getFormSchemas } from '@/app/actions/form-schema'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { DEFAULT_STATUS_LABEL_CONFIG, type StatusLabelConfig } from '@/lib/status-label-config'
import FundsPaymentDetail from '@/app/funds-payment/_components/FundsPaymentDetail'
import StatusBadge from '@/app/_components/StatusBadge'
import { Button, buttonVariants } from '@/components/ui/button'
import { formatDateTime } from '@/lib/dateUtils'

type RecordWithTemplate = FundsPayment & {
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<RecordWithTemplate | null>(null)
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([])
  const [schema, setSchema] = useState<FormBlock[]>([])
  const [labelConfig, setLabelConfig] = useState<StatusLabelConfig>(DEFAULT_STATUS_LABEL_CONFIG)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { id } = await params
      const numId = Number(id)
      const [{ data, error: fetchError }, histRes, config] = await Promise.all([
        supabase.from('funds_payment')
          .select(`*, approval_flow_templates(name, approval_flow_steps(step_name, step_number)), approval_records!funds_payment_id(step_name, decision)`)
          .eq('id', numId).single(),
        supabase.from('approval_records')
          .select('*').eq('funds_payment_id', numId).order('step_number'),
        getStatusLabelConfig(),
      ])
      if (fetchError || !data) { setNotFound(true) }
      else { setRecord(data as RecordWithTemplate) }
      setApprovalHistory((histRes.data as ApprovalRecord[]) ?? [])
      setLabelConfig(config)
      setLoading(false)
    }
    load()
    getFormSchemas().then(s => setSchema(s.payment_voucher))
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

  function getStepName(): string | null {
    const r = record!
    if (r.status === 'pending') {
      return r.approval_flow_templates?.approval_flow_steps?.find(s => s.step_number === r.current_step)?.step_name ?? null
    }
    if (r.status === 'rejected') {
      return r.approval_records?.find(a => a.decision === 'rejected')?.step_name ?? null
    }
    if (r.status === 'approved') {
      const steps = r.approval_flow_templates?.approval_flow_steps ?? []
      return steps.reduce((max, s) => s.step_number > max.step_number ? s : max, steps[0])?.step_name ?? null
    }
    return null
  }

  return (
    <div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Link href="/funds-payment/my-payment" className={buttonVariants({ variant: 'outline' })}>← 返回列表</Link>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>付款憑單</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          <span>狀態：</span>
          <StatusBadge module="payment_voucher" status={record!.status} stepName={getStepName()} labelConfig={labelConfig} />
          <span>　資金分配申請單 #</span>
          <Link href={`/funds-allocation/my-funds/edit/${record!.funds_allocation_id}`} style={{ color: '#2563eb' }}>
            {record!.funds_allocation_id}
          </Link>
        </div>

        <FundsPaymentDetail record={record!} schema={schema} />

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 16 }}>錯誤：{error}</p>}

        {isDraft && (
          <div style={{ marginTop: 32, display: 'flex', gap: 8 }}>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '送出中...' : '確定送出'}
            </Button>
          </div>
        )}
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

