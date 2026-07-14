'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ApprovalRecord, FormBlock, FormSchemaRow, FormSlot, StepDecision } from '@/lib/types'
import { submitApprovalDecision, checkCanReviewStep } from '@/app/actions/approval-flow'
import { getMySession } from '@/app/actions/auth'
import { getFormSchemas } from '@/app/actions/form-schema'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/dateUtils'
import ErrorDialog from '@/app/_components/ErrorDialog'

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

type TempVoucher = {
  id: number
  funds_payment_id: number
  serial_number: string | null
  date: string | null
  apply_division: string | null
  apply_section: string | null
  applicant: string | null
  apply_role: string | null
  amount: number | null
  note: string | null
  extra_data: Record<string, string> | null
  status: string
  current_step: number | null
  flow_template_id: number | null
  funds_payment?: { purchase_order_number: string | null } | null
  approval_flow_templates: { id: number; name: string; approval_flow_steps: StepDef[] } | null
}

const readonlyCls = 'bg-muted/40 cursor-default'

function getFieldValue(slot: NonNullable<FormSlot>, record: TempVoucher): string {
  // 採購單號＝母付款憑單的採購單號（表單欄位是自訂欄位，用欄位名稱對應）
  if (slot.label === '採購單號') return record.funds_payment?.purchase_order_number ?? '-'
  const map: Record<string, unknown> = {
    date: record.date,
    apply_division: record.apply_division,
    apply_section: record.apply_section,
    applicant: record.applicant,
    apply_role: record.apply_role,
    amount: record.amount,
    note: record.note,
  }
  const val = map[slot.fieldId] ?? record.extra_data?.[slot.label]
  if (val == null || val === '') return '-'
  return String(val)
}

function renderSlot(slot: NonNullable<FormSlot>, record: TempVoucher) {
  const value = getFieldValue(slot, record)
  if (slot.type === 'textarea') return <Textarea value={value} readOnly rows={4} className={readonlyCls} />
  return <Input value={value} readOnly className={readonlyCls} />
}

// 付款明細群組：從標記 rowGroupStart 的列起整組可重複（與建立頁同一約定）
function getGroupRows(block: FormBlock): FormSchemaRow[] {
  const startIdx = block.rows.findIndex(r => r.rowGroupStart)
  if (startIdx === -1) return []
  return block.rows.slice(startIdx)
}

function getGroupData(block: FormBlock, record: TempVoucher): Record<string, string>[] | null {
  const raw = record.extra_data?.[`__group_${block.id}`]
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? parsed : null
  } catch { return null }
}

// 群組區塊以表格逐組唯讀顯示（欄＝群組欄位、列＝各組）
function GroupTable({ block, record }: { block: FormBlock; record: TempVoucher }) {
  const groupSlots = getGroupRows(block).flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
  const data = getGroupData(block, record)
  if (!data) return null
  return (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="whitespace-nowrap border-b border-border px-2.5 py-2 text-left font-medium text-muted-foreground">#</th>
            {groupSlots.map(s => (
              <th key={s.fieldId} className="whitespace-nowrap border-b border-border px-2.5 py-2 text-left font-medium text-muted-foreground">{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((inst, i) => (
            <tr key={i}>
              <td className="border-b border-border px-2.5 py-2 text-muted-foreground">{i + 1}</td>
              {groupSlots.map(s => (
                <td key={s.fieldId} className="border-b border-border px-2.5 py-2 text-foreground">
                  {inst[s.label] != null && inst[s.label] !== '' ? (s.type === 'number' ? Number(inst[s.label]).toLocaleString() : inst[s.label]) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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
        supabase.from('temp_vouchers').select('*, funds_payment:funds_payment_id(purchase_order_number)').eq('id', numId).single(),
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
          supabase.from('approval_flow_steps').select('id, step_number, step_name, reviewer_type, role_type_id, org_unit_type, system_role_id, approval_group_id').eq('template_id', voucher.flow_template_id).order('step_number'),
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
          // 課長/處長（org_role）步驟需回溯付款憑單→申請單的處別/課別才能解析審核人
          let applyDivisionId: number | null = null
          let applySectionId: number | null = null
          if (voucher.funds_payment_id) {
            const { data: relatedPayment } = await supabase
              .from('funds_payment')
              .select('funds_allocation_id')
              .eq('id', voucher.funds_payment_id)
              .single()
            if (relatedPayment?.funds_allocation_id) {
              const { data: alloc } = await supabase
                .from('funds_allocation')
                .select('apply_division_id, apply_section_id')
                .eq('id', relatedPayment.funds_allocation_id)
                .single()
              applyDivisionId = alloc?.apply_division_id ?? null
              applySectionId = alloc?.apply_section_id ?? null
            }
          }
          const canReview = await checkCanReviewStep({ userId: session.userId, stepDef, applyDivisionId, applySectionId })
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
      const result = await submitApprovalDecision({
        tempVoucherId: record.id,
        stepNumber: currentStep,
        stepName: stepDef.step_name,
        decision,
        comment,
        reviewerId: String(userId ?? ''),
        totalSteps: steps.length,
      })
      if (result?.error) {
        setError(result.error)
        setSubmitting(false)
        return
      }
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
        <h1 className="text-xl font-bold text-foreground">審核暫付款沖銷憑單{record.serial_number ? ` ${record.serial_number}` : ''}</h1>
      </div>

      {/* 審核送出被擋改用全站共用中央彈窗 */}
      <ErrorDialog message={error} title="無法送出審核結果" onClose={() => setError(null)} />

      {/* Schema 欄位區塊 */}
      {schema.map(block => (
        <Card key={block.id}>
          {block.title && (
            <CardHeader>
              <CardTitle>{block.title}</CardTitle>
            </CardHeader>
          )}
          <CardContent className={block.title ? '' : 'pt-4'}>
            {/* 群組區塊（付款明細多組）：有群組資料時以表格逐組顯示，非群組列照常 */}
            {(() => {
              const groupRowIds = new Set(getGroupRows(block).map(r => r.id))
              const hasGroupData = getGroupData(block, record) != null
              const rowsToRender = hasGroupData ? block.rows.filter(r => !groupRowIds.has(r.id)) : block.rows
              return (
                <>
                  {rowsToRender.map(row => (
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
                  {hasGroupData && <GroupTable block={block} record={record} />}
                </>
              )
            })()}
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
