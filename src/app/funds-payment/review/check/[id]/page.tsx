'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsPayment, ApprovalRecord, StepDecision, FormBlock, FundAttachment } from '@/lib/types'
import { submitApprovalDecision, checkCanReviewStep, getPaymentCategoryOptions } from '@/app/actions/approval-flow'
import { getMySession } from '@/app/actions/auth'
import { getFormSchemas } from '@/app/actions/form-schema'
import { getAttachmentsByAllocationId, getAttachmentsByPaymentId } from '@/app/actions/attachments'
import { getAllocationRemainingInfo, type AllocationRemainingInfo } from '@/app/actions/fund-budget'
import { getPaymentOccupiedAmount } from '@/lib/fundsAllocationRemaining'
import FundsPaymentDetail from '@/app/funds-payment/_components/FundsPaymentDetail'
import AllocationSummaryCard from '@/app/_components/AllocationSummaryCard'
import AttachmentUpload from '@/app/_components/AttachmentUpload'
import ErrorDialog from '@/app/_components/ErrorDialog'
import ReviewProgressBlock from '@/app/_components/ReviewProgressBlock'

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

type RecordWithTemplate = FundsPayment & {
  approval_flow_templates: {
    id: number
    name: string
    approval_flow_steps: StepDef[]
  } | null
}

export default function PaymentReviewCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<RecordWithTemplate | null>(null)
  const [pastRecords, setPastRecords] = useState<ApprovalRecord[]>([])
  const [schema, setSchema] = useState<FormBlock[]>([])
  const [userId, setUserId] = useState<number | null>(null)
  const [canReviewStep, setCanReviewStep] = useState(false)
  const [loading, setLoading] = useState(true)
  const [decision, setDecision] = useState<StepDecision>(null)
  const [comment, setComment] = useState('')
  const [approvedAmount, setApprovedAmount] = useState<string>('')
  // 付款分類（審核群組步驟才顯示）：預設承接前面關卡最新選的值，本關可調整
  const [paymentCategory, setPaymentCategory] = useState<string>('')
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allocationAttachments, setAllocationAttachments] = useState<FundAttachment[]>([])
  const [paymentAttachments, setPaymentAttachments] = useState<FundAttachment[]>([])
  const [remainingInfo, setRemainingInfo] = useState<AllocationRemainingInfo | null>(null)

  useEffect(() => {
    async function load() {
      const { id } = await params
      const numId = Number(id)

      const [recRes, pastRes, session] = await Promise.all([
        supabase.from('funds_payment').select('*').eq('id', numId).single(),
        supabase.from('approval_records').select('*').eq('funds_payment_id', numId).order('step_number'),
        getMySession(),
      ])
      setUserId(session.userId)

      if (recRes.error) { setError(recRes.error.message); setLoading(false); return }

      const payment = recRes.data as FundsPayment
      const past = (pastRes.data as ApprovalRecord[]) ?? []
      setPastRecords(past)

      // 付款分類預設值：承接前面關卡最新選的值（比照核准金額的承接邏輯）
      const inherited = [...past].reverse().find(r => r.payment_category)?.payment_category
      if (inherited) setPaymentCategory(inherited)

      let steps: StepDef[] = []
      if (payment.flow_template_id) {
        const [tmplRes, stepsRes] = await Promise.all([
          supabase.from('approval_flow_templates').select('id, name').eq('id', payment.flow_template_id).single(),
          supabase.from('approval_flow_steps').select('id, step_number, step_name, reviewer_type, role_type_id, org_unit_type, system_role_id, approval_group_id').eq('template_id', payment.flow_template_id).order('step_number'),
        ])
        steps = (stepsRes.data ?? []) as StepDef[]
        setRecord({
          ...payment,
          approval_flow_templates: tmplRes.data
            ? { id: tmplRes.data.id, name: tmplRes.data.name, approval_flow_steps: steps }
            : null,
        })
      } else {
        setRecord({ ...payment, approval_flow_templates: null })
      }

      // 預填核准金額：優先承接上一步審核人核准的最新金額，沒有審過就用建立時填的金額
      setApprovedAmount(String(payment.approved_amount ?? payment.amount ?? ''))

      if (payment.funds_allocation_id) {
        const [{ data: alloc }, remaining] = await Promise.all([
          supabase.from('funds_allocation').select('apply_division_id, apply_section_id, approved_amount').eq('id', payment.funds_allocation_id).single(),
          getAllocationRemainingInfo(payment.funds_allocation_id, payment.id),
        ])
        setRemainingInfo(remaining)

        if (session.userId && payment.status === 'pending' && payment.current_step !== null) {
          const stepDef = steps.find(s => s.step_number === payment.current_step)
          if (stepDef) {
            // 課長/處長（org_role）步驟需要申請單的處別/課別才能解析審核人
            const canReview = await checkCanReviewStep({
              userId: session.userId, stepDef,
              applyDivisionId: alloc?.apply_division_id ?? null,
              applySectionId: alloc?.apply_section_id ?? null,
            })
            setCanReviewStep(canReview)
          }
        }
      }

      // 載入附件
      getAttachmentsByPaymentId(numId).then(setPaymentAttachments)
      if (payment.funds_allocation_id) {
        getAttachmentsByAllocationId(payment.funds_allocation_id).then(setAllocationAttachments)
      }

      setLoading(false)
    }
    load()
    getFormSchemas().then(s => setSchema(s.payment_voucher))
    getPaymentCategoryOptions().then(setCategoryOptions)
  }, [params])

  const steps = record?.approval_flow_templates?.approval_flow_steps
    ?.slice().sort((a, b) => a.step_number - b.step_number) ?? []

  const currentStep = record?.current_step ?? null
  const canReview = record?.status === 'pending' && currentStep !== null && canReviewStep

  // 付款分類只在「審核群組」步驟（財務人員、第三處處長等）顯示，課長/處長等組織步驟不顯示
  const currentStepDef = steps.find(s => s.step_number === currentStep)
  const showPaymentCategory = currentStepDef?.reviewer_type === 'approval_group'

  // 這張憑單目前佔用的金額（審核中用建立時填的金額）——核准金額上限 = 剩餘（已排除本張）+ 本張目前佔用
  const ownOccupied = record ? getPaymentOccupiedAmount(record) : 0
  const approvedAmountCap = remainingInfo ? remainingInfo.remaining + ownOccupied : null

  async function handleSubmit() {
    if (!record || !decision || !currentStep) return
    const stepDef = steps.find(s => s.step_number === currentStep)
    if (!stepDef) return
    if (decision === 'approved') {
      const amt = approvedAmount === '' ? null : Number(approvedAmount)
      if (amt != null && approvedAmountCap != null && amt > approvedAmountCap) {
        setError(`核准金額超過剩餘可用額度（上限 NT$${approvedAmountCap.toLocaleString()}）`)
        return
      }
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await submitApprovalDecision({
        fundsPaymentId: record.id,
        stepNumber: currentStep,
        stepName: stepDef.step_name,
        decision,
        comment,
        reviewerId: String(userId ?? ''),
        totalSteps: steps.length,
        approvedAmount: decision === 'approved' && approvedAmount !== '' ? Number(approvedAmount) : null,
        paymentCategory: showPaymentCategory ? paymentCategory || null : null,
      })
      // 存檔驗證擋下（核准金額 0/超過剩餘額度等）：以中央彈窗顯示
      if (result?.error) {
        setError(result.error)
        setSubmitting(false)
        return
      }
      router.push('/funds-payment/review')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '送出失敗')
      setSubmitting(false)
    }
  }

  if (loading) return <p style={{ padding: 24 }}>載入中...</p>
  if (!record) return <p style={{ padding: 24, color: '#dc2626' }}>找不到此付款憑單</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid var(--btn-border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
          ← 返回
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>審核付款憑單</h1>
      </div>

      {/* 審核送出被擋（核准金額驗證等）改用全站共用中央彈窗 */}
      <ErrorDialog message={error} title="無法送出審核結果" onClose={() => setError(null)} />

      {remainingInfo && (
        <AllocationSummaryCard
          info={remainingInfo}
          remainingLabel="剩餘（不含本張）"
          extraAmounts={[['本張憑單金額', ownOccupied.toLocaleString()]]}
        />
      )}

      <FundsPaymentDetail record={record} schema={schema} />

      {(allocationAttachments.length > 0 || paymentAttachments.length > 0) && (
        <div style={{ marginBottom: 24, border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)' }}>
          <div style={{ padding: '10px 20px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>附件</span>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {allocationAttachments.length > 0 && (
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>來自資金分配申請單的附件</p>
                <AttachmentUpload
                  slotLabel="inherited"
                  attachments={allocationAttachments.map(a => ({ id: a.id, fileName: a.file_name, storagePath: a.storage_path, fileType: a.file_type, url: a.url ?? '', slotLabel: a.slot_label }))}
                  onAdd={() => {}} onRemove={() => {}} readOnly
                />
              </div>
            )}
            {paymentAttachments.length > 0 && (
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>付款憑單附件</p>
                <AttachmentUpload
                  slotLabel="payment"
                  attachments={paymentAttachments.map(a => ({ id: a.id, fileName: a.file_name, storagePath: a.storage_path, fileType: a.file_type, url: a.url ?? '', slotLabel: a.slot_label }))}
                  onAdd={() => {}} onRemove={() => {}} readOnly
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 審核進度（比照筑今一列式排版，共用元件；付款群組步驟顯示付款分類） */}
      <ReviewProgressBlock
        steps={steps}
        pastRecords={pastRecords}
        currentStep={currentStep}
        status={record.status}
        canReview={canReview}
        decision={decision}
        onDecisionChange={setDecision}
        comment={comment}
        onCommentChange={setComment}
        submitting={submitting}
        onSubmit={handleSubmit}
        showApprovedAmount
        approvedAmount={approvedAmount}
        onApprovedAmountChange={setApprovedAmount}
        enablePaymentCategory
        paymentCategory={paymentCategory}
        onPaymentCategoryChange={setPaymentCategory}
        categoryOptions={categoryOptions}
        completionMessages={{
          approved: '✓ 此憑單已全數核准',
          rejected: '✗ 此憑單已被拒絕',
        }}
      />
    </div>
  )
}
