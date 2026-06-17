'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsAllocation, ApprovalRecord, StepDecision, FormBlock, FundAttachment } from '@/lib/types'
import { submitApprovalDecision, checkCanReviewStep } from '@/app/actions/approval-flow'
import { getMySession } from '@/app/actions/auth'
import { getFormSchemas } from '@/app/actions/form-schema'
import FundsAllocationDetail from '@/app/funds-allocation/_components/FundsAllocationDetail'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { DEFAULT_STATUS_LABEL_CONFIG, type StatusLabelConfig } from '@/lib/status-label-config'
import { getAttachmentsByAllocationId } from '@/app/actions/attachments'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/dateUtils'

type StepDef = {
  id: number
  step_number: number
  step_name: string
  reviewer_type: 'org_role' | 'system_role'
  role_type_id: number | null
  system_role_id: number | null
}

type RecordWithTemplate = FundsAllocation & {
  approval_flow_templates: {
    id: number
    name: string
    approval_flow_steps: StepDef[]
  } | null
}

export default function ReviewCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<RecordWithTemplate | null>(null)
  const [pastRecords, setPastRecords] = useState<ApprovalRecord[]>([])
  const [labelConfig, setLabelConfig] = useState<StatusLabelConfig>(DEFAULT_STATUS_LABEL_CONFIG)
  const [loading, setLoading] = useState(true)
  const [schema, setSchema] = useState<FormBlock[]>([])
  const [attachments, setAttachments] = useState<FundAttachment[]>([])
  const [userId, setUserId] = useState<number | null>(null)
  const [canReviewStep, setCanReviewStep] = useState(false)
  const [decision, setDecision] = useState<StepDecision>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { id } = await params
      const numId = Number(id)

      const [recRes, pastRes, config, session] = await Promise.all([
        supabase.from('funds_allocation').select('*').eq('id', numId).single(),
        supabase.from('approval_records').select('*').eq('funds_allocation_id', numId).order('step_number'),
        getStatusLabelConfig(),
        getMySession(),
      ])
      setLabelConfig(config)
      setUserId(session.userId)

      if (recRes.error) { setError(recRes.error.message); setLoading(false); return }

      const allocation = recRes.data as FundsAllocation
      setPastRecords((pastRes.data as ApprovalRecord[]) ?? [])

      let steps: StepDef[] = []
      if (allocation.flow_template_id) {
        const [tmplRes, stepsRes] = await Promise.all([
          supabase.from('approval_flow_templates').select('id, name').eq('id', allocation.flow_template_id).single(),
          supabase.from('approval_flow_steps').select('id, step_number, step_name, reviewer_type, role_type_id, system_role_id').eq('template_id', allocation.flow_template_id).order('step_number'),
        ])
        steps = (stepsRes.data ?? []) as StepDef[]
        setRecord({
          ...allocation,
          approval_flow_templates: tmplRes.data
            ? { id: tmplRes.data.id, name: tmplRes.data.name, approval_flow_steps: steps }
            : null,
        })
      } else {
        setRecord({ ...allocation, approval_flow_templates: null })
      }

      if (session.userId && allocation.status === 'pending' && allocation.current_step !== null) {
        const stepDef = steps.find(s => s.step_number === allocation.current_step)
        if (stepDef) {
          const canReview = await checkCanReviewStep({ userId: session.userId, stepDef })
          setCanReviewStep(canReview)
        }
      }

      getAttachmentsByAllocationId(numId).then(setAttachments)
      setLoading(false)
    }
    load()
    getFormSchemas().then(s => setSchema(s.funds_allocation))
  }, [params])

  const steps = record?.approval_flow_templates?.approval_flow_steps
    ?.slice()
    .sort((a, b) => a.step_number - b.step_number) ?? []

  const currentStep = record?.current_step ?? null
  const canReview = record?.status === 'pending' && currentStep !== null && canReviewStep

  async function handleSubmit() {
    if (!record || !decision || !currentStep) return
    const stepDef = steps.find(s => s.step_number === currentStep)
    if (!stepDef) return
    setSubmitting(true)
    setError(null)
    try {
      await submitApprovalDecision({
        fundsAllocationId: record.id,
        stepNumber: currentStep,
        stepName: stepDef.step_name,
        decision,
        comment,
        reviewerId: String(userId ?? ''),
        totalSteps: steps.length,
      })
      router.push('/funds-allocation/review')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '送出失敗')
      setSubmitting(false)
    }
  }

  if (loading) return <p style={{ padding: 24 }}>載入中...</p>
  if (!record) return <p style={{ padding: 24, color: '#dc2626' }}>找不到此申請單</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid var(--btn-border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
          ← 返回
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>審核申請單</h1>
      </div>

      {error && <p style={{ color: '#dc2626', marginBottom: 12 }}>{error}</p>}

      <FundsAllocationDetail
        record={record}
        labelConfig={labelConfig}
        stepName={steps.find(s => s.step_number === (record.current_step ?? 0))?.step_name ?? null}
        attachments={attachments}
      />

      {/* 審核步驟進度 */}
      <div style={{ marginBottom: 32, maxWidth: 720 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>審核進度</h2>

        {steps.map(step => {
          const past = pastRecords.find(r => r.step_number === step.step_number)
          const isActive = step.step_number === currentStep && record.status === 'pending'
          const isDone = !!past

          return (
            <div key={step.step_number} style={{
              padding: '16px 0', borderBottom: '1px solid var(--border-color)',
              opacity: !isDone && !isActive ? 0.4 : 1,
            }}>
              {/* 步驟標題列 */}
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, alignItems: 'start', marginBottom: isActive ? 10 : 0 }}>
                <strong style={{ fontSize: 14 }}>
                  {step.step_number}. {step.step_name}
                </strong>
                {isDone && (
                  <span style={{ fontSize: 13, color: past.decision === 'approved' ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
                    {past.decision === 'approved' ? '✓ 核准' : '✗ 不核准'}
                    {past.reviewed_at && <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>{formatDateTime(past.reviewed_at)}</span>}
                    {past.comment && <span style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 400, fontSize: 12, marginTop: 2 }}>{past.comment}</span>}
                  </span>
                )}
                {isActive && !isDone && (
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>待審核</span>
                )}
              </div>

              {/* 審核操作區（只有 active 且 canReview 時顯示） */}
              {isActive && canReview && (
                <div style={{ marginLeft: 0 }}>
                  <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                    {(['approved', 'rejected'] as const).map(val => (
                      <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="decision"
                          value={val}
                          checked={decision === val}
                          onChange={() => setDecision(val)}
                        />
                        {val === 'approved' ? '核准' : '不核准'}
                      </label>
                    ))}
                  </div>
                  <textarea
                    placeholder="評論（選填）"
                    rows={3}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      border: '1px solid var(--btn-border)', fontSize: 14,
                      resize: 'vertical', boxSizing: 'border-box',
                      background: 'var(--bg-page)',
                    }}
                  />
                  <div style={{ marginTop: 12 }}>
                    <Button
                      onClick={handleSubmit}
                      disabled={!decision || submitting}
                      className={decision && !submitting ? 'bg-green-500 hover:bg-green-600 text-white border-transparent' : ''}
                    >
                      {submitting ? '送出中...' : '確定送出'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {record.status === 'approved' && (
          <p style={{ marginTop: 16, color: '#16a34a', fontWeight: 600 }}>✓ 此申請已全數核准</p>
        )}
        {record.status === 'rejected' && (
          <p style={{ marginTop: 16, color: '#dc2626', fontWeight: 600 }}>✗ 此申請已被拒絕</p>
        )}
      </div>
    </div>
  )
}
