'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsAllocation, ApprovalRecord, StepDecision, FormBlock, FundAttachment } from '@/lib/types'
import { submitApprovalDecision, checkCanReviewStep } from '@/app/actions/approval-flow'
import { getMySession } from '@/app/actions/auth'
import { getFormSchemas } from '@/app/actions/form-schema'
import FundsAllocationDetail from '@/app/funds-allocation/_components/FundsAllocationDetail'
import EditFundsForm from '@/app/funds-allocation/my-funds/edit/[id]/_components/EditFundsForm'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { DEFAULT_STATUS_LABEL_CONFIG, type StatusLabelConfig } from '@/lib/status-label-config'
import { getAttachmentsByAllocationId } from '@/app/actions/attachments'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/dateUtils'
import ChangeLogModal from '@/app/funds-allocation/_components/ChangeLogModal'

type StepDef = {
  id: number
  step_number: number
  step_name: string
  reviewer_type: 'org_role' | 'system_role' | 'approval_group'
  role_type_id: number | null
  org_unit_type: string | null
  system_role_id: number | null
  approval_group_id: number | null
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
  const [userName, setUserName] = useState<string>('')
  const [canReviewStep, setCanReviewStep] = useState(false)
  const [reviewerNames, setReviewerNames] = useState<Record<string, string>>({})
  const [decision, setDecision] = useState<StepDecision>('approved')
  const [comment, setComment] = useState('')
  const [approvedAmount, setApprovedAmount] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [changeLogOpen, setChangeLogOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

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
      setUserName(session.name ?? '')

      if (recRes.error) { setError(recRes.error.message); setLoading(false); return }

      const allocation = recRes.data as FundsAllocation
      const past = (pastRes.data as ApprovalRecord[]) ?? []
      setPastRecords(past)

      const ids = past.map(r => r.reviewer_id).filter((rid): rid is string => !!rid && !isNaN(Number(rid)))
      if (ids.length > 0) {
        const { data: users } = await supabase.from('app_users').select('id, name').in('id', ids.map(Number))
        const nameMap: Record<string, string> = {}
        for (const u of users ?? []) nameMap[String(u.id)] = u.name
        setReviewerNames(nameMap)
      }

      let steps: StepDef[] = []
      if (allocation.flow_template_id) {
        const [tmplRes, stepsRes] = await Promise.all([
          supabase.from('approval_flow_templates').select('id, name').eq('id', allocation.flow_template_id).single(),
          supabase.from('approval_flow_steps').select('id, step_number, step_name, reviewer_type, role_type_id, org_unit_type, system_role_id, approval_group_id').eq('template_id', allocation.flow_template_id).order('step_number'),
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
          const canReview = await checkCanReviewStep({
            userId: session.userId,
            stepDef,
            applyDivisionId: allocation.apply_division_id,
            applySectionId: allocation.apply_section_id,
          })
          setCanReviewStep(canReview)
        }
      }

      // 預填核准金額：優先承接上一步審核人核准的最新金額，第一步才用申請金額
      setApprovedAmount(String(allocation.approved_amount ?? allocation.amount ?? ''))
      getAttachmentsByAllocationId(numId).then(setAttachments)
      setLoading(false)
    }
    load()
    getFormSchemas().then(s => setSchema(s.funds_allocation))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, refreshKey])

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
        approvedAmount: decision === 'approved' && approvedAmount !== '' ? Number(approvedAmount) : null,
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
      <ChangeLogModal fundsAllocationId={record.id} open={changeLogOpen} onClose={() => setChangeLogOpen(false)} />

      {/* 頂部標題列 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid var(--btn-border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
            ← 返回
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>審核申請單</h1>
        </div>
        <button
          onClick={() => setChangeLogOpen(true)}
          style={{ fontSize: 13, padding: '6px 12px', border: '1px solid var(--btn-border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-body)' }}
        >
          變更歷程
        </button>
      </div>

      {error && <p style={{ color: '#dc2626', marginBottom: 12 }}>{error}</p>}

      {/* 表單區：審核人看可編輯版，其他人看唯讀版 */}
      {canReview ? (
        <EditFundsForm
          key={refreshKey}
          record={record}
          schema={schema}
          applicantName={userName}
          userId={userId}
          labelConfig={labelConfig}
          isCurrentReviewer
          hideApprovalPanel
          onSaveSuccess={() => setRefreshKey(k => k + 1)}
        />
      ) : (
        <FundsAllocationDetail
          record={record}
          labelConfig={labelConfig}
          stepName={steps.find(s => s.step_number === (record.current_step ?? 0))?.step_name ?? null}
          attachments={attachments}
          schema={schema}
        />
      )}

      {/* 審核進度與操作區 */}
      <div style={{ marginBottom: 32, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '20px 24px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>審核進度</h2>

        {steps.map((step, idx) => {
          const past = pastRecords.find(r => r.step_number === step.step_number)
          const isActive = step.step_number === currentStep && record.status === 'pending'
          const isDone = !!past
          const isLast = idx === steps.length - 1

          return (
            <div key={step.step_number} style={{
              padding: '14px 0',
              borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
              opacity: !isDone && !isActive ? 0.4 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isActive && canReview ? 14 : 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0, minWidth: 20 }}>
                  {step.step_number}.
                </span>
                <strong style={{ fontSize: 14, flexShrink: 0 }}>
                  {step.step_name}
                  {isDone && past.reviewer_id && reviewerNames[past.reviewer_id] && (
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
                      · {reviewerNames[past.reviewer_id]}
                    </span>
                  )}
                </strong>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--text-body)', textAlign: 'center' }}>
                  {isDone && past.comment ? past.comment : ''}
                </span>
                {isDone && past.decision === 'approved' && past.approved_amount != null && (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>
                    核准金額：{past.approved_amount.toLocaleString()} 元
                  </span>
                )}
                {isDone && (
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, flexShrink: 0,
                    background: past.decision === 'approved' ? '#dcfce7' : '#fee2e2',
                    color: past.decision === 'approved' ? '#16a34a' : '#dc2626',
                  }}>
                    {past.decision === 'approved' ? '✓ 核准' : '✗ 不核准'}
                  </span>
                )}
                {isActive && !isDone && (
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#dbeafe', color: '#2563eb', flexShrink: 0 }}>
                    待審核
                  </span>
                )}
                {isDone && past.reviewed_at && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{formatDateTime(past.reviewed_at)}</span>
                )}
              </div>
              {isActive && canReview && (
                <div style={{ marginLeft: 30, display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingTop: 8, flexShrink: 0 }}>
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
                      flex: 1, minWidth: 160, padding: '8px 10px', borderRadius: 6,
                      border: '1px solid var(--btn-border)', fontSize: 14,
                      resize: 'vertical', boxSizing: 'border-box',
                      background: 'var(--bg-card)', color: 'var(--text-body)',
                    }}
                  />
                  <input
                    type="number"
                    value={approvedAmount}
                    onChange={e => setApprovedAmount(e.target.value)}
                    onWheel={e => e.currentTarget.blur()}
                    min={0}
                    placeholder="核准金額"
                    style={{
                      width: 130, padding: '8px 10px', borderRadius: 6,
                      border: '1px solid var(--btn-border)', fontSize: 14,
                      background: 'var(--bg-card)', color: 'var(--text-body)', flexShrink: 0,
                    }}
                  />
                  <Button
                    onClick={handleSubmit}
                    disabled={!decision || submitting}
                    style={{ flexShrink: 0 }}
                    className={decision && !submitting ? 'bg-green-500 hover:bg-green-600 text-white border-transparent' : ''}
                  >
                    {submitting ? '送出中...' : '確定送出'}
                  </Button>
                </div>
              )}
            </div>
          )
        })}

        {record.status === 'approved' && (
          <p style={{ marginTop: 12, color: '#16a34a', fontWeight: 600, fontSize: 14 }}>✓ 此申請已全數核准</p>
        )}
        {record.status === 'paid' && (
          <p style={{ marginTop: 12, color: '#16a34a', fontWeight: 600, fontSize: 14 }}>✓ 此申請已全數核准，額度已用完（已付款）</p>
        )}
        {record.status === 'rejected' && (
          <p style={{ marginTop: 12, color: '#dc2626', fontWeight: 600, fontSize: 14 }}>✗ 此申請已被拒絕</p>
        )}
      </div>
    </div>
  )
}
