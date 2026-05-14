'use client'

import { FundsPayment, StepDecision } from '@/lib/types'

type Props = {
  record: FundsPayment
  currentStep: 1 | 2 | 3 | 4
  canReview: boolean
  decision: StepDecision
  comment: string
  submitting: boolean
  onDecisionChange: (d: 'approved' | 'rejected') => void
  onCommentChange: (c: string) => void
  onSubmit: () => void
}

const STEPS: {
  label: string
  num: 1 | 2 | 3 | 4
  decisionKey: keyof FundsPayment
  commentKey: keyof FundsPayment
}[] = [
  { label: '課級審核',     num: 1, decisionKey: 'step1_decision', commentKey: 'step1_comment' },
  { label: '處級審核',     num: 2, decisionKey: 'step2_decision', commentKey: 'step2_comment' },
  { label: '第三處 支出課', num: 3, decisionKey: 'step3_decision', commentKey: 'step3_comment' },
  { label: '第三處 處長',  num: 4, decisionKey: 'step4_decision', commentKey: 'step4_comment' },
]

export default function PaymentApprovalPanel({
  record,
  currentStep,
  canReview,
  decision,
  comment,
  submitting,
  onDecisionChange,
  onCommentChange,
  onSubmit,
}: Props) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>主管審核</h2>
      <hr style={{ borderColor: '#e5e7eb', margin: 0 }} />

      {STEPS.map(({ label, num, decisionKey, commentKey }) => {
        const isActive = num === currentStep
        const savedDecision = record[decisionKey] as StepDecision
        const savedComment = (record[commentKey] as string | null) ?? ''
        const disabled = !isActive || !canReview

        const rowDecision = (isActive && canReview) ? decision : savedDecision
        const rowComment = isActive ? comment : savedComment

        const buttonActive = isActive && canReview && !!decision && !submitting

        return (
          <div
            key={num}
            style={{
              display: 'grid',
              gridTemplateColumns: '130px 200px 1fr 90px',
              gap: 12,
              alignItems: 'flex-start',
              padding: '16px 0',
              borderBottom: '1px solid #f3f4f6',
              opacity: isActive ? 1 : 0.45,
            }}
          >
            <strong style={{ paddingTop: 6, fontSize: 14 }}>{label}</strong>

            <div style={{ display: 'flex', gap: 20, paddingTop: 6 }}>
              {(['rejected', 'approved'] as const).map((val) => (
                <label
                  key={val}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 14,
                    cursor: disabled ? 'default' : 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name={`step${num}_decision`}
                    value={val}
                    disabled={disabled}
                    checked={rowDecision === val}
                    onChange={() => onDecisionChange(val)}
                  />
                  {val === 'rejected' ? '不核准' : '核准'}
                </label>
              ))}
            </div>

            <textarea
              placeholder={isActive ? '評論' : ''}
              rows={3}
              value={rowComment}
              disabled={disabled}
              onChange={(e) => onCommentChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                resize: 'vertical',
                backgroundColor: disabled ? '#f3f4f6' : '#fff',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />

            <button
              onClick={buttonActive ? onSubmit : undefined}
              disabled={!buttonActive}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: buttonActive ? '#22c55e' : '#e5e7eb',
                color: buttonActive ? '#fff' : '#9ca3af',
                cursor: buttonActive ? 'pointer' : 'default',
                fontWeight: 500,
                fontSize: 14,
                whiteSpace: 'nowrap',
                height: 36,
              }}
            >
              {isActive && submitting ? '送出中...' : '確定送出'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
