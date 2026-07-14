'use client'

import { FundsAllocation, StepDecision } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Props = {
  record: FundsAllocation
  currentStep: 1 | 2 | 3 | 4 | 5
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
  num: 1 | 2 | 3 | 4 | 5
  decisionKey: keyof FundsAllocation
  commentKey: keyof FundsAllocation
}[] = [
  { label: '課級審核',        num: 1, decisionKey: 'step1_decision', commentKey: 'step1_comment' },
  { label: '處級審核',        num: 2, decisionKey: 'step2_decision', commentKey: 'step2_comment' },
  { label: '諮詢議會主席審核', num: 3, decisionKey: 'step3_decision', commentKey: 'step3_comment' },
  { label: '執行長審核', num: 4, decisionKey: 'step4_decision', commentKey: 'step4_comment' },
  { label: '財務長審核',      num: 5, decisionKey: 'step5_decision', commentKey: 'step5_comment' },
]

export default function ApprovalPanel({
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
      <hr style={{ borderColor: 'var(--border-color)', margin: 0 }} />

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
              padding: '16px 0',
              borderBottom: '1px solid var(--border-color)',
              opacity: isActive ? 1 : 0.45,
            }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: '130px 1fr 120px 90px',
              gap: 12,
              alignItems: 'center',
              marginBottom: 8,
            }}>
              <strong style={{ fontSize: 14 }}>{label}</strong>

              <div style={{ display: 'flex', gap: 20 }}>
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

              <Input
                type="number"
                value={record.amount}
                readOnly
                className="bg-[var(--bg-page)] cursor-default"
              />

              <Button
                onClick={buttonActive ? onSubmit : undefined}
                disabled={!buttonActive}
                className={cn(
                  'whitespace-nowrap border-transparent',
                  buttonActive
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-400'
                )}
              >
                {isActive && submitting ? '送出中...' : '確定送出'}
              </Button>
            </div>

            <Textarea
              placeholder={isActive ? '評論' : ''}
              rows={3}
              value={rowComment}
              disabled={disabled}
              onChange={(e) => onCommentChange(e.target.value)}
              className={disabled ? 'bg-[var(--bg-page)]' : ''}
            />
          </div>
        )
      })}
    </div>
  )
}
