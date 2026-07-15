'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ApprovalRecord, FormBlock, FormSchemaRow, FormSlot } from '@/lib/types'
import { getFormSchemas } from '@/app/actions/form-schema'
import { submitTempVoucher } from '@/app/actions/temp-voucher'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { DEFAULT_STATUS_LABEL_CONFIG, type StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import ReviewProgressBlock, { type ReviewStepDef } from '@/app/_components/ReviewProgressBlock'
import { Button, buttonVariants } from '@/components/ui/button'
import { DetailBlock, GroupDetailTable, ReadOnlyField, detailRowGridStyle } from '@/app/_components/RecordDetailView'
import PaymentSummaryCard, { VoucherParentPayment, VOUCHER_PARENT_PAYMENT_COLUMNS } from '@/app/funds-voucher/_components/PaymentSummaryCard'
import VoucherReturnSummary from '@/app/funds-voucher/_components/VoucherReturnSummary'
import { paidAmountOf, voucherAmountOf } from '@/lib/voucherReturnAmount'

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
  created_at: string
  funds_payment: VoucherParentPayment | null
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ id: number; step_name: string; step_number: number; reviewer_type?: string }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

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

// 群組區塊以表格逐組唯讀顯示（欄＝群組欄位、列＝各組）；表格樣式與付款憑單/資金分配共用
function GroupTable({ block, record }: { block: FormBlock; record: TempVoucher }) {
  const groupSlots = getGroupRows(block).flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
  const data = getGroupData(block, record)
  if (!data) return null
  return <GroupDetailTable slots={groupSlots} instances={data} />
}

export default function VoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<TempVoucher | null>(null)
  const [schema, setSchema] = useState<FormBlock[]>([])
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([])
  const [reviewerNames, setReviewerNames] = useState<Record<string, string>>({})
  const [labelConfig, setLabelConfig] = useState<StatusLabelConfig>(DEFAULT_STATUS_LABEL_CONFIG)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { id } = await params
      const numId = Number(id)

      const [{ data, error: fetchError }, histRes, config, schemas] = await Promise.all([
        supabase
          .from('temp_vouchers')
          .select(`*, funds_payment:funds_payment_id(${VOUCHER_PARENT_PAYMENT_COLUMNS}), approval_flow_templates(name, approval_flow_steps(id, step_name, step_number, reviewer_type)), approval_records!temp_voucher_id(step_name, decision)`)
          .eq('id', numId)
          .single(),
        supabase
          .from('approval_records')
          .select('*')
          .eq('temp_voucher_id', numId)
          .order('step_number'),
        getStatusLabelConfig(),
        getFormSchemas(),
      ])

      if (fetchError || !data) { setNotFound(true) }
      else { setRecord(data as TempVoucher) }
      const histRecords = (histRes.data as ApprovalRecord[]) ?? []
      setApprovalHistory(histRecords)
      setLabelConfig(config)
      setSchema(schemas.temp_voucher)

      // 審核進度共用元件：已完成階段顯示審核人名（key = reviewer_id）
      const reviewerIds = histRecords
        .map(r => r.reviewer_id)
        .filter((rid): rid is string => !!rid && !isNaN(Number(rid)))
      if (reviewerIds.length > 0) {
        const { data: users } = await supabase
          .from('app_users')
          .select('id, name')
          .in('id', reviewerIds.map(Number))
        const names: Record<string, string> = {}
        for (const u of users ?? []) names[String(u.id)] = u.name
        setReviewerNames(names)
      }
      setLoading(false)
    }
    load()
  }, [params])

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

  async function handleSubmit() {
    if (!record) return
    setSubmitting(true)
    setError(null)
    const { error: updateError } = await submitTempVoucher(record.id)
    if (updateError) { setError(updateError); setSubmitting(false); return }
    // embed 要與初次載入一致，否則送出後 funds_payment 變 undefined，
    // 採購單號會掉成「-」、母憑單對照卡片會整塊消失
    const { data } = await supabase
      .from('temp_vouchers')
      .select(`*, funds_payment:funds_payment_id(${VOUCHER_PARENT_PAYMENT_COLUMNS}), approval_flow_templates(name, approval_flow_steps(id, step_name, step_number, reviewer_type)), approval_records!temp_voucher_id(step_name, decision)`)
      .eq('id', record.id)
      .single()
    if (data) setRecord(data as TempVoucher)
    setSubmitting(false)
  }

  if (loading) return <p>載入中...</p>
  if (notFound) return (
    <div>
      <p style={{ color: '#dc2626' }}>找不到此暫付款沖銷憑單，或你沒有權限檢視。</p>
      <Link href="/funds-voucher/my-voucher" style={{ fontSize: 14, color: '#2563eb' }}>返回列表</Link>
    </div>
  )

  const isDraft = record!.status === 'draft'
  const voucherTotal = voucherAmountOf(record!)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/funds-voucher/my-voucher" className={buttonVariants({ variant: 'outline' })}>← 返回列表</Link>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>
          暫付款沖銷憑單{record!.serial_number ? ` ${record!.serial_number}` : ''}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        <span>狀態：</span>
        <StatusBadge module="temp_voucher" status={record!.status} stepName={getStepName()} labelConfig={labelConfig} />
        <span>　關聯付款憑單</span>
        <Link href={`/funds-payment/my-payment/${record!.funds_payment_id}`} style={{ color: '#2563eb' }}>
          {record!.funds_payment?.purchase_order_number ?? `#${record!.funds_payment_id}`}
        </Link>
      </div>

      {/* 母付款憑單對照：當初預支多少、這次沖銷多少、要回存多少 */}
      {record!.funds_payment && (
        <PaymentSummaryCard payment={record!.funds_payment} voucherTotal={voucherTotal} />
      )}

      <div style={{ marginBottom: 24 }}>
        {schema.map(block => {
          // 群組區塊（付款明細多組）：有群組資料時以表格逐組顯示，非群組列照常
          const groupRowIds = new Set(getGroupRows(block).map(r => r.id))
          const hasGroupData = getGroupData(block, record!) != null
          const rowsToRender = hasGroupData ? block.rows.filter(r => !groupRowIds.has(r.id)) : block.rows
          // 含群組/可重複列的區塊維持直式；其餘區塊橫式（標籤在左），與資金分配申請表單一致
          const verticalLayout = block.rows.some(r => r.repeatable || r.rowGroupStart)
          return (
            <DetailBlock
              key={block.id}
              title={block.title}
              summary={hasGroupData && record!.funds_payment
                ? <VoucherReturnSummary paidAmount={paidAmountOf(record!.funds_payment)} voucherTotal={voucherTotal} />
                : undefined}
            >
              {rowsToRender.map(row => (
                <div key={row.id} style={detailRowGridStyle(row.cols, !verticalLayout)}>
                  {row.slots.map((slot, idx) => slot ? (
                    <ReadOnlyField key={idx} label={slot.label} value={getFieldValue(slot, record!)} textarea={slot.type === 'textarea'} horizontal={!verticalLayout} />
                  ) : <div key={idx} />)}
                </div>
              ))}
              {hasGroupData && <GroupTable block={block} record={record!} />}
            </DetailBlock>
          )
        })}
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>錯誤：{error}</p>}

      {isDraft && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '送出中...' : '確定送出'}
          </Button>
        </div>
      )}

      {/* 審核進度：申請人唯讀一列式排版（比照資金分配編輯頁，共用 ReviewProgressBlock；沖銷憑單不顯示核准金額欄） */}
      {record && record.status !== 'draft' && (record.approval_flow_templates?.approval_flow_steps?.length ?? 0) > 0 && (
        <div style={{ marginTop: 40 }}>
          <ReviewProgressBlock
            readOnly
            steps={[...(record.approval_flow_templates!.approval_flow_steps)]
              .sort((a, b) => a.step_number - b.step_number)
              .map(s => ({
                id: s.id,
                step_number: s.step_number,
                step_name: s.step_name,
                reviewer_type: s.reviewer_type as ReviewStepDef['reviewer_type'],
              }))}
            pastRecords={approvalHistory}
            currentStep={record.current_step}
            status={record.status}
            canReview={false}
            reviewerNames={reviewerNames}
            completionMessages={{
              approved: '✓ 此憑單已全數核准',
              rejected: '✗ 此憑單已被退回',
            }}
          />
        </div>
      )}
    </div>
  )
}
