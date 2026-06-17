'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ApprovalRecord, FormBlock, FormSlot, StepDecision } from '@/lib/types'
import { submitApprovalDecision, checkCanReviewStep } from '@/app/actions/approval-flow'
import { getMySession } from '@/app/actions/auth'
import { getFormSchemas } from '@/app/actions/form-schema'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/dateUtils'

type StepDef = {
  id: number
  step_number: number
  step_name: string
  reviewer_type: 'org_role' | 'system_role'
  role_type_id: number | null
  system_role_id: number | null
}

type TempVoucher = {
  id: number
  funds_payment_id: number
  date: string | null
  apply_division: string | null
  apply_section: string | null
  applicant: string | null
  apply_role: string | null
  amount: number | null
  note: string | null
  status: string
  current_step: number | null
  flow_template_id: number | null
  approval_flow_templates: { id: number; name: string; approval_flow_steps: StepDef[] } | null
}

const readonlyCls = 'bg-muted/40 cursor-default'

function getFieldValue(fieldId: string, record: TempVoucher): string {
  const map: Record<string, unknown> = {
    date: record.date,
    apply_division: record.apply_division,
    apply_section: record.apply_section,
    applicant: record.applicant,
    apply_role: record.apply_role,
    amount: record.amount,
    note: record.note,
  }
  const val = map[fieldId]
  if (val == null || val === '') return '-'
  return String(val)
}

function renderSlot(slot: NonNullable<FormSlot>, record: TempVoucher) {
  const value = getFieldValue(slot.fieldId, record)
  if (slot.type === 'textarea') return <Textarea value={value} readOnly rows={4} className={readonlyCls} />
  return <Input value={value} readOnly className={readonlyCls} />
}

export default function VoucherReviewCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<TempVoucher | null>(null)
  const [pastRecords, setPastRecords] = useState<ApprovalRecord[]>([])
  const [schema, setSchema] = useState<FormBlock[]>([])
  const [userId, setUserId] = useState<number | null>(null)
  const [canReviewStep, setCanReviewStep] = useState(false)
  const [loading, setLoading] = useState(true)
  const [decision, setDecision] = useState<StepDecision>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { id } = await params
      const numId = Number(id)

      const [recRes, pastRes, session] = await Promise.all([
        supabase.from('temp_vouchers').select('*').eq('id', numId).single(),
        supabase.from('approval_records').select('*').eq('temp_voucher_id', numId).order('step_number'),
        getMySession(),
      ])
      setUserId(session.userId)

      if (recRes.error) { setError(recRes.error.message); setLoading(false); return }

      const voucher = recRes.data as TempVoucher
      setPastRecords((pastRes.data as ApprovalRecord[]) ?? [])

      let steps: StepDef[] = []
      if (voucher.flow_template_id) {
        const [tmplRes, stepsRes] = await Promise.all([
          supabase.from('approval_flow_templates').select('id, name').eq('id', voucher.flow_template_id).single(),
          supabase.from('approval_flow_steps').select('id, step_number, step_name, reviewer_type, role_type_id, system_role_id').eq('template_id', voucher.flow_template_id).order('step_number'),
        ])
        steps = (stepsRes.data ?? []) as StepDef[]
        setRecord({
          ...voucher,
          approval_flow_templates: tmplRes.data
            ? { id: tmplRes.data.id, name: tmplRes.data.name, approval_flow_steps: steps }
            : null,
        })
      } else {
        setRecord({ ...voucher, approval_flow_templates: null })
      }

      if (session.userId && voucher.status === 'pending' && voucher.current_step !== null) {
        const stepDef = steps.find(s => s.step_number === voucher.current_step)
        if (stepDef) {
          const canReview = await checkCanReviewStep({ userId: session.userId, stepDef })
          setCanReviewStep(canReview)
        }
      }

      setLoading(false)
    }
    load()
    getFormSchemas().then(s => setSchema(s.temp_voucher))
  }, [params])

  const steps = record?.approval_flow_templates?.approval_flow_steps?.slice().sort((a, b) => a.step_number - b.step_number) ?? []
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
        tempVoucherId: record.id,
        stepNumber: currentStep,
        stepName: stepDef.step_name,
        decision,
        comment,
        reviewerId: String(userId ?? ''),
        totalSteps: steps.length,
      })
      router.push('/funds-voucher/review')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '送出失敗')
      setSubmitting(false)
    }
  }

  if (loading) return <p className="text-muted-foreground">載入中...</p>
  if (!record) return <p className="text-destructive">找不到此暫付款沖銷憑單</p>

  return (
    <div className="flex flex-col gap-6">
      {/* 頁面標題 */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>← 返回</Button>
        <h1 className="text-xl font-bold text-foreground">審核暫付款沖銷憑單</h1>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Schema 欄位區塊 */}
      {schema.map(block => (
        <Card key={block.id}>
          {block.title && (
            <CardHeader>
              <CardTitle>{block.title}</CardTitle>
            </CardHeader>
          )}
          <CardContent className={block.title ? '' : 'pt-4'}>
            {block.rows.map(row => (
              <div
                key={row.id}
                className="mb-5 grid gap-5"
                style={{ gridTemplateColumns: `repeat(${row.cols}, 1fr)` }}
              >
                {row.slots.map((slot, idx) => slot ? (
                  <div key={idx}>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">{slot.label}</label>
                    {renderSlot(slot, record)}
                  </div>
                ) : <div key={idx} />)}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* 審核進度 */}
      <Card>
        <CardHeader>
          <CardTitle>審核進度</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {steps.map(step => {
            const past = pastRecords.find(r => r.step_number === step.step_number)
            const isActive = step.step_number === currentStep && record.status === 'pending'
            const isDone = !!past

            return (
              <div key={step.step_number} className={`py-4 ${!isDone && !isActive ? 'opacity-40' : ''}`}>
                <div className="mb-2 grid items-start gap-3" style={{ gridTemplateColumns: '160px 1fr' }}>
                  <strong className="text-sm">{step.step_number}. {step.step_name}</strong>
                  {isDone && (
                    <span className={`text-sm font-medium ${past.decision === 'approved' ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                      {past.decision === 'approved' ? '✓ 核准' : '✗ 不核准'}
                      {past.reviewed_at && <span className="ml-2 text-xs font-normal text-muted-foreground">{formatDateTime(past.reviewed_at)}</span>}
                      {past.comment && <span className="mt-1 block text-xs font-normal text-muted-foreground">{past.comment}</span>}
                    </span>
                  )}
                  {isActive && !isDone && <span className="text-sm font-medium text-primary">待審核</span>}
                </div>

                {isActive && canReview && (
                  <div className="flex flex-col gap-3 pt-1">
                    <div className="flex gap-5">
                      {(['approved', 'rejected'] as const).map(val => (
                        <label key={val} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                          <input type="radio" name="decision" value={val} checked={decision === val} onChange={() => setDecision(val)} />
                          {val === 'approved' ? '核准' : '不核准'}
                        </label>
                      ))}
                    </div>
                    <Textarea
                      placeholder="評論（選填）"
                      rows={3}
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                    />
                    <div>
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

          {record.status === 'approved' && <p className="pt-4 font-semibold text-green-600 dark:text-green-400">✓ 此憑單已全數核准</p>}
          {record.status === 'rejected' && <p className="pt-4 font-semibold text-destructive">✗ 此憑單已被拒絕</p>}
        </CardContent>
      </Card>
    </div>
  )
}
