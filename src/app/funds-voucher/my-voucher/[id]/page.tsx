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
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/dateUtils'

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
  funds_payment: { purchase_order_number: string | null } | null
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const readonlyCls = 'bg-[var(--bg-page)] cursor-default'

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
  if (slot.type === 'textarea') {
    return <Textarea value={value} readOnly rows={4} className={readonlyCls} />
  }
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
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>#</th>
            {groupSlots.map(s => (
              <th key={s.fieldId} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((inst, i) => (
            <tr key={i}>
              <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>{i + 1}</td>
              {groupSlots.map(s => (
                <td key={s.fieldId} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-body)' }}>
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

export default function VoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<TempVoucher | null>(null)
  const [schema, setSchema] = useState<FormBlock[]>([])
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([])
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
          .select(`*, funds_payment:funds_payment_id(purchase_order_number), approval_flow_templates(name, approval_flow_steps(step_name, step_number)), approval_records!temp_voucher_id(step_name, decision)`)
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
      setApprovalHistory((histRes.data as ApprovalRecord[]) ?? [])
      setLabelConfig(config)
      setSchema(schemas.temp_voucher)
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
    const { data } = await supabase
      .from('temp_vouchers')
      .select(`*, approval_flow_templates(name, approval_flow_steps(step_name, step_number)), approval_records!temp_voucher_id(step_name, decision)`)
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

      <div style={{ marginBottom: 24 }}>
        {schema.map(block => (
          <div key={block.id} style={{
            marginBottom: 16,
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            {block.title && (
              <div style={{ padding: '10px 20px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>{block.title}</span>
              </div>
            )}
            <div style={{ padding: '20px 20px 4px' }}>
              {/* 群組區塊（付款明細多組）：有群組資料時以表格逐組顯示，非群組列照常 */}
              {(() => {
                const groupRowIds = new Set(getGroupRows(block).map(r => r.id))
                const hasGroupData = getGroupData(block, record!) != null
                const rowsToRender = hasGroupData ? block.rows.filter(r => !groupRowIds.has(r.id)) : block.rows
                return (
                  <>
                    {rowsToRender.map(row => (
                      <div key={row.id} style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${row.cols}, 1fr)`,
                        gap: 20,
                        marginBottom: 20,
                      }}>
                        {row.slots.map((slot, idx) => slot ? (
                          <div key={idx}>
                            <label style={labelStyle}>{slot.label}</label>
                            {renderSlot(slot, record!)}
                          </div>
                        ) : <div key={idx} />)}
                      </div>
                    ))}
                    {hasGroupData && <GroupTable block={block} record={record!} />}
                  </>
                )
              })()}
            </div>
          </div>
        ))}
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>錯誤：{error}</p>}

      {isDraft && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '送出中...' : '確定送出'}
          </Button>
        </div>
      )}

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
