'use client'

import { Button } from '@/components/ui/button'
import { ApprovalRecord, StepDecision } from '@/lib/types'
import { formatDateTime } from '@/lib/dateUtils'

// 審核步驟定義（三個審核頁共用同一形狀；申請人唯讀檢視只需 id/step_number/step_name）
export type ReviewStepDef = {
  id: number
  step_number: number
  step_name: string
  reviewer_type?: 'org_role' | 'system_role' | 'approval_group'
  role_type_id?: number | null
  org_unit_type?: string | null
  system_role_id?: number | null
  approval_group_id?: number | null
}

type Props = {
  steps: ReviewStepDef[]
  pastRecords: ApprovalRecord[]
  currentStep: number | null
  status: string
  canReview: boolean

  // 唯讀檢視（申請人自行查看審核進度）：只顯示不核准/核准與核准金額，無評論框、無送出鈕
  readOnly?: boolean

  // 進行中階段的表單狀態（由各頁 controlled；readOnly 時不需要）
  decision?: StepDecision
  onDecisionChange?: (d: StepDecision) => void
  comment?: string
  onCommentChange?: (c: string) => void
  submitting?: boolean
  onSubmit?: () => void

  // 核准金額欄（資金分配／付款憑單有；暫付款沖銷沒有）
  showApprovedAmount?: boolean
  approvedAmount?: string
  onApprovedAmountChange?: (v: string) => void
  // 逐項核准模式（資金分配）：總核准金額由逐項明細自動加總、進行中關卡不可手改
  approvedAmountReadOnly?: boolean
  // 各關卡列下方的補充內容（逐項核准明細表格）：進行中關卡為可編輯表格、已完成關卡為收合式檢視
  renderStepExtra?: (step: ReviewStepDef, ctx: { editable: boolean; past: ApprovalRecord | null }) => React.ReactNode

  // 付款分類下拉（付款憑單／暫付款沖銷；僅「審核群組」步驟顯示）
  enablePaymentCategory?: boolean
  paymentCategory?: string
  onPaymentCategoryChange?: (v: string) => void
  categoryOptions?: string[]

  // 已完成階段顯示審核人名（key = reviewer_id 字串）
  reviewerNames?: Record<string, string>

  // 全數核准／已付款／被退回時的結案訊息（各頁措辭不同）
  completionMessages?: { approved?: string; paid?: string; rejected?: string }
}

// 一列的欄位樣式：階段名｜不核准○核准○｜評論(＋付款分類)｜核准金額｜確定送出（比照筑今）
export default function ReviewProgressBlock({
  steps,
  pastRecords,
  currentStep,
  status,
  canReview,
  readOnly = false,
  decision = null,
  onDecisionChange,
  comment = '',
  onCommentChange,
  submitting = false,
  onSubmit,
  showApprovedAmount = false,
  approvedAmount = '',
  onApprovedAmountChange,
  approvedAmountReadOnly = false,
  renderStepExtra,
  enablePaymentCategory = false,
  paymentCategory = '',
  onPaymentCategoryChange,
  categoryOptions = [],
  reviewerNames,
  completionMessages,
}: Props) {
  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid var(--btn-border)',
    fontSize: 14,
    background: 'var(--bg-card)',
    color: 'var(--text-body)',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ marginBottom: 32, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '20px 24px' }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>審核進度</h2>

      {steps.map((step, idx) => {
        const past = pastRecords.find(r => r.step_number === step.step_number)
        const isDone = !!past
        const isActive = step.step_number === currentStep && status === 'pending'
        const editable = !readOnly && isActive && canReview
        const isLast = idx === steps.length - 1

        // 各欄目前值：進行中吃 controlled state，已完成吃歷史紀錄，其餘留空
        const rowDecision: StepDecision = editable ? decision : (isDone ? past!.decision : null)
        const rowComment = editable ? comment : (isDone ? (past!.comment ?? '') : '')
        const rowAmount = editable
          ? approvedAmount
          : (isDone && past!.approved_amount != null ? String(past!.approved_amount) : '')
        const rowCategory = editable ? paymentCategory : (isDone ? (past!.payment_category ?? '') : '')
        const showCategory = enablePaymentCategory && step.reviewer_type === 'approval_group'
        const reviewerName = isDone && past!.reviewer_id ? reviewerNames?.[past!.reviewer_id] : undefined

        // 不核准 / 核准 兩顆 radio（比照筑今順序：不核准在前）
        // 選中時上色（核准＝綠、不核准＝紅，沿用 QuickReviewButtons 色票），已完成關卡一眼看得出結果（2026-07-21 列32）
        const radios = (['rejected', 'approved'] as const).map(val => {
          const isSelected = rowDecision === val
          const selectedColor = val === 'approved' ? '#50cd89' : '#f1416c'
          return (
            <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: editable ? 'pointer' : 'default' }}>
              <input
                type="radio"
                name={`decision-${step.step_number}`}
                value={val}
                checked={isSelected}
                disabled={!editable}
                onChange={() => editable && onDecisionChange?.(val)}
                style={isSelected ? { accentColor: selectedColor } : undefined}
              />
              <span style={isSelected ? { color: selectedColor, fontWeight: 600 } : undefined}>
                {val === 'approved' ? '核准' : '不核准'}
              </span>
            </label>
          )
        })

        return (
          <div
            key={step.step_number}
            style={{
              padding: '16px 0',
              borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
              opacity: !isDone && !isActive ? 0.45 : 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {/* 階段名（僅進行中深色，已核准／尚未輪到皆灰字；比照筑今，不再顯示「待審核」字樣） */}
              <div style={{ width: 150, flexShrink: 0 }}>
                <strong style={{ fontSize: 14, color: isActive ? 'var(--text-title)' : 'var(--text-muted)' }}>{step.step_number}. {step.step_name}</strong>
              </div>

              {readOnly ? (
                <>
                  {/* 申請人唯讀檢視：四個固定欄位對齊——階段名｜不核准/核准｜審核人＋評論｜核准金額 */}
                  <div style={{ width: 220, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
                    {radios}
                  </div>
                  <div style={{ flex: 1, minWidth: 160, fontSize: 13, color: 'var(--text-body)', whiteSpace: 'pre-line' }}>
                    {reviewerName && <span style={{ color: 'var(--text-muted)' }}>{reviewerName}　</span>}
                    {isDone && rowComment && (
                      <><span style={{ color: 'var(--text-muted)' }}>評論：</span>{rowComment}</>
                    )}
                  </div>
                  {showApprovedAmount && (
                    <div style={{ width: 120, flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>核准金額</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: rowAmount ? 'var(--text-body)' : 'var(--text-muted)' }}>
                        {rowAmount ? Number(rowAmount).toLocaleString() : '—'}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* 不核准 / 核准 */}
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
                    {radios}
                  </div>

                  {/* 內容欄：付款分類（審核群組步驟）在上、評論在下 */}
                  <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {showCategory && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>付款分類</span>
                        <select
                          value={rowCategory}
                          disabled={!editable}
                          onChange={e => editable && onPaymentCategoryChange?.(e.target.value)}
                          style={{ ...inputStyle, width: 200 }}
                        >
                          <option value="">（未選擇）</option>
                          {/* 承接的舊選值若已被財務移除仍保留可見 */}
                          {rowCategory && !categoryOptions.includes(rowCategory) && (
                            <option value={rowCategory}>{rowCategory}</option>
                          )}
                          {categoryOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <textarea
                      placeholder="評論（選填）"
                      value={rowComment}
                      readOnly={!editable}
                      onChange={e => editable && onCommentChange?.(e.target.value)}
                      style={{ ...inputStyle, width: '100%', height: 56, resize: 'vertical' }}
                    />
                    {isDone && (reviewerName || past!.reviewed_at) && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {reviewerName ? reviewerName : ''}
                        {reviewerName && past!.reviewed_at ? ' · ' : ''}
                        {past!.reviewed_at ? formatDateTime(past!.reviewed_at) : ''}
                      </span>
                    )}
                  </div>

                  {/* 核准金額（逐項核准模式下＝逐項明細自動加總，不可手改） */}
                  {showApprovedAmount && (editable && approvedAmountReadOnly ? (
                    <div style={{
                      width: 130, height: 56, flexShrink: 0, boxSizing: 'border-box',
                      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end',
                      padding: '0 10px', borderRadius: 6, border: '1px solid var(--btn-border)', background: 'var(--bg-page)',
                    }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>核准金額（自動加總）</span>
                      <strong style={{ fontSize: 15, color: 'var(--text-title)' }}>{(Number(rowAmount) || 0).toLocaleString()}</strong>
                    </div>
                  ) : (
                    <input
                      type="number"
                      value={rowAmount}
                      readOnly={!editable}
                      onChange={e => editable && onApprovedAmountChange?.(e.target.value)}
                      onWheel={e => e.currentTarget.blur()}
                      min={0}
                      placeholder="核准金額"
                      style={{ ...inputStyle, width: 130, height: 56, flexShrink: 0 }}
                    />
                  ))}

                  {/* 確定送出（僅進行中可按，其餘反灰以維持一列版面） */}
                  <Button
                    onClick={editable ? onSubmit : undefined}
                    disabled={!editable || !decision || submitting}
                    style={{ flexShrink: 0 }}
                    className={editable && decision && !submitting ? 'bg-green-500 hover:bg-green-600 text-white border-transparent' : ''}
                  >
                    {editable && submitting ? '送出中...' : '確定送出'}
                  </Button>
                </>
              )}
            </div>

            {/* 逐項核准明細（資金分配）：進行中關卡為可編輯表格、已完成關卡為收合式檢視 */}
            {!readOnly && renderStepExtra?.(step, { editable, past: isDone ? past! : null })}
          </div>
        )
      })}

      {status === 'approved' && completionMessages?.approved && (
        <p style={{ marginTop: 12, color: '#16a34a', fontWeight: 600, fontSize: 14 }}>{completionMessages.approved}</p>
      )}
      {status === 'paid' && completionMessages?.paid && (
        <p style={{ marginTop: 12, color: '#16a34a', fontWeight: 600, fontSize: 14 }}>{completionMessages.paid}</p>
      )}
      {status === 'rejected' && completionMessages?.rejected && (
        <p style={{ marginTop: 12, color: '#dc2626', fontWeight: 600, fontSize: 14 }}>{completionMessages.rejected}</p>
      )}
    </div>
  )
}
