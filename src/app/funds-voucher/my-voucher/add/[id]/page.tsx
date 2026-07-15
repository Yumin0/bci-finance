'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsPayment, FormBlock, FormSchemaRow, FormSlot } from '@/lib/types'
import { getFormSchemas } from '@/app/actions/form-schema'
import { createTempVoucher, submitTempVoucher } from '@/app/actions/temp-voucher'
import { taipeiToday } from '@/lib/dateUtils'
import { paidAmountOf } from '@/lib/voucherReturnAmount'
import VoucherReturnSummary from '@/app/funds-voucher/_components/VoucherReturnSummary'
import PaymentSummaryCard from '@/app/funds-voucher/_components/PaymentSummaryCard'
import { saveAttachments } from '@/app/actions/attachments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { buttonVariants } from '@/components/ui/button'
import AttachmentUpload, { AttachmentItem } from '@/app/_components/AttachmentUpload'
import ErrorDialog from '@/app/_components/ErrorDialog'
import { DetailFieldLayout, detailRowGridStyle } from '@/app/_components/RecordDetailView'

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6,
}
const readonlyCls = 'bg-[var(--bg-page)] cursor-not-allowed'

// 沖銷表單欄位 ← 付款憑單付款明細欄位的名稱對應（兩邊 label 不同）
// 「總額」不在此表：預帶值改依實際撥款金額決定，見 buildInitGroupTotals
const GROUP_INHERIT_LABEL_MAP: Record<string, string> = {
  '摘要用途': '摘要/用途說明',
  '未稅金額': '未稅金額',
  '稅額': '稅額',
}

const TOTAL_LABEL = '總額'

// 沖銷「總額」的預帶值：目標是讓預帶的各組總額加總 ===「母憑單實際撥款金額」。
// 撥款金額＝審核核准金額（approved_amount），不是母憑單當初填寫的金額（amount）——
// 只要審核有下修過，照抄原填寫值就必定超過 createTempVoucher 的上限驗證，
// 等於預帶一個系統自己保證會擋掉的數字（2026-07-15 修正）。
function buildInitGroupTotals(
  paymentGroups: Record<string, string>[],
  paidAmount: number
): (string | null)[] {
  const sumOriginal = paymentGroups.reduce((sum, inst) => sum + (Number(inst[TOTAL_LABEL]) || 0), 0)
  // 原組值加總剛好等於實撥（＝審核沒調整過金額，最常見）：逐組照帶，維持逐組對應關係
  if (paidAmount > 0 && Math.abs(sumOriginal - paidAmount) < 0.01) {
    return paymentGroups.map(inst => inst[TOTAL_LABEL] ?? null)
  }
  // 金額被審核調整過：逐組原值加總已對不上實撥，第一組帶實撥全額、其餘留白，
  // 由承辦人依實際單據自行分配（全額沖銷時不用改，這是最常見的情況）
  return paymentGroups.map((_, idx) => (idx === 0 && paidAmount > 0 ? String(paidAmount) : null))
}

function getPrefilledValue(slot: NonNullable<FormSlot>, payment: FundsPayment): string {
  // 採購單號＝母付款憑單的採購單號（表單欄位是自訂欄位，用欄位名稱對應）
  if (slot.label === '採購單號') return payment.purchase_order_number ?? ''
  // 申請日期預設建立當天（可改）
  if (slot.fieldId === 'date' || slot.label === '申請日期') return taipeiToday()
  const map: Record<string, unknown> = {
    apply_division: payment.apply_division,
    apply_section:  payment.apply_section,
    applicant:      payment.applicant,
    apply_role:     payment.apply_role,
  }
  const val = map[slot.fieldId]
  if (val == null || val === '') return ''
  return String(val)
}

function isReadonlySlot(slot: NonNullable<FormSlot>): boolean {
  return ['applicant', 'apply_division', 'apply_section', 'apply_role'].includes(slot.fieldId)
    || slot.label === '採購單號' // 唯讀帶入母付款憑單採購單號，不可手改
}

// 付款明細群組：從標記 rowGroupStart 的列起整組可重複
function getGroupRows(block: FormBlock): FormSchemaRow[] {
  const startIdx = block.rows.findIndex(r => r.rowGroupStart)
  if (startIdx === -1) return []
  return block.rows.slice(startIdx)
}

// 付款憑單自己的付款明細群組資料（extra_data 內可能同時存有申請單合併進來的
// __group_ 資料，以「instance 是否含未稅金額/總額欄」辨識出憑單自己的那組）
function getPaymentGroupInstances(payment: FundsPayment): Record<string, string>[] {
  for (const [key, raw] of Object.entries(payment.extra_data ?? {})) {
    if (!key.startsWith('__group_')) continue
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length && parsed[0] && ('未稅金額' in parsed[0] || '總額' in parsed[0])) {
        return parsed
      }
    } catch { /* 忽略解析錯誤 */ }
  }
  return []
}

export default function AddTempVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [payment, setPayment] = useState<FundsPayment | null>(null)
  const [paymentId, setPaymentId] = useState<number | null>(null)
  const [schema, setSchema] = useState<FormBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  // 群組重複資料（key = blockId）：逐組繼承自付款憑單付款明細，可增刪修改
  const [groupInstances, setGroupInstances] = useState<Record<string, Record<string, string>[]>>({})
  const [pendingAttachments, setPendingAttachments] = useState<Record<string, AttachmentItem[]>>({})

  useEffect(() => {
    async function load() {
      const { id } = await params
      const numId = Number(id)
      setPaymentId(numId)

      const [{ data, error: fetchError }, schemas] = await Promise.all([
        supabase.from('funds_payment').select('*').eq('id', numId).single(),
        getFormSchemas(),
      ])

      if (fetchError || !data) {
        setError('找不到此付款憑單')
        setLoading(false)
        return
      }

      const p = data as FundsPayment
      setPayment(p)
      setSchema(schemas.temp_voucher)

      const groupSlotIds = new Set(
        schemas.temp_voucher.flatMap(b => getGroupRows(b).flatMap(r => r.slots.filter(Boolean).map(s => s!.fieldId)))
      )
      const prefilled: Record<string, string> = {}
      for (const block of schemas.temp_voucher) {
        for (const row of block.rows) {
          for (const slot of row.slots) {
            if (slot && !groupSlotIds.has(slot.fieldId)) prefilled[slot.fieldId] = getPrefilledValue(slot, p)
          }
        }
      }
      setFieldValues(prefilled)

      // 逐組繼承付款憑單付款明細（摘要用途/未稅金額/稅額；總額另依實撥金額決定，見 buildInitGroupTotals）
      const paymentGroups = getPaymentGroupInstances(p)
      const paidAmount = paidAmountOf(p)
      const initTotals = buildInitGroupTotals(paymentGroups, paidAmount)
      const initGroups: Record<string, Record<string, string>[]> = {}
      for (const block of schemas.temp_voucher) {
        const groupSlots = getGroupRows(block).flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
        if (!groupSlots.length) continue
        if (paymentGroups.length) {
          initGroups[block.id] = paymentGroups.map((inst, idx) => {
            const mapped: Record<string, string> = {}
            for (const slot of groupSlots) {
              if (slot.label === TOTAL_LABEL) {
                const t = initTotals[idx]
                if (t != null && t !== '') mapped[slot.fieldId] = t
                continue
              }
              const srcLabel = GROUP_INHERIT_LABEL_MAP[slot.label]
              const v = srcLabel ? inst[srcLabel] : undefined
              if (v != null && v !== '') mapped[slot.fieldId] = v
            }
            return mapped
          })
        } else {
          // 舊憑單沒有群組資料：單組，總額預帶實撥全額
          const single: Record<string, string> = {}
          const totalSlot = groupSlots.find(s => s.label === TOTAL_LABEL)
          if (totalSlot && paidAmount > 0) single[totalSlot.fieldId] = String(paidAmount)
          initGroups[block.id] = [single]
        }
      }
      setGroupInstances(initGroups)
      setLoading(false)
    }
    load()
  }, [params])

  function setField(fieldId: string, value: string) {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }))
  }
  function setGroupField(blockId: string, instIdx: number, fieldId: string, value: string) {
    setGroupInstances(prev => {
      const instances = [...(prev[blockId] ?? [{}])]
      instances[instIdx] = { ...instances[instIdx], [fieldId]: value }
      return { ...prev, [blockId]: instances }
    })
  }
  function addGroupInstance(blockId: string) {
    setGroupInstances(prev => ({ ...prev, [blockId]: [...(prev[blockId] ?? [{}]), {}] }))
  }
  function removeGroupInstance(blockId: string, instIdx: number) {
    setGroupInstances(prev => {
      const instances = (prev[blockId] ?? [{}]).filter((_, i) => i !== instIdx)
      return { ...prev, [blockId]: instances.length ? instances : [{}] }
    })
  }

  function renderInput(slot: NonNullable<FormSlot>, value: string, onChange?: (v: string) => void) {
    const readonly = !onChange || isReadonlySlot(slot) || slot.type === 'readonly'
    if (slot.type === 'attachment') {
      const items = pendingAttachments[slot.label] ?? []
      return (
        <AttachmentUpload
          slotLabel={slot.label}
          attachments={items}
          onAdd={item => setPendingAttachments(prev => ({ ...prev, [slot.label]: [...(prev[slot.label] ?? []), item] }))}
          onRemove={item => setPendingAttachments(prev => ({ ...prev, [slot.label]: (prev[slot.label] ?? []).filter(a => a.storagePath !== item.storagePath) }))}
        />
      )
    }
    if (slot.type === 'textarea') {
      return (
        <Textarea
          value={value}
          readOnly={readonly}
          rows={4}
          className={readonly ? readonlyCls : ''}
          onChange={readonly ? undefined : e => onChange!(e.target.value)}
        />
      )
    }
    return (
      <Input
        type={slot.type === 'number' ? 'number' : slot.type === 'date' ? 'date' : 'text'}
        value={value}
        readOnly={readonly}
        className={readonly ? readonlyCls : ''}
        onChange={readonly ? undefined : e => onChange!(e.target.value)}
      />
    )
  }

  // 各組「總額」加總＝沖銷金額（畫面即時顯示，存檔時後端同一算法再驗一次）
  function blockGrandTotal(block: FormBlock): number {
    const groupSlots = getGroupRows(block).flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
    const totalSlot = groupSlots.find(s => s.type === 'number' && s.label === '總額')
    if (!totalSlot) return 0
    return (groupInstances[block.id] ?? []).reduce((sum, inst) => {
      const v = Number(inst[totalSlot.fieldId])
      return Number.isFinite(v) ? sum + v : sum
    }, 0)
  }

  // 群組資料以欄位 label 為 key 存入 extra_data.__group_{blockId}（與付款憑單同一約定）
  function buildExtraData(): Record<string, string> {
    const extraData: Record<string, string> = {}
    for (const block of schema) {
      const groupSlots = getGroupRows(block).flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
      if (!groupSlots.length) continue
      const instances = (groupInstances[block.id] ?? []).map(inst => {
        const byLabel: Record<string, string> = {}
        for (const slot of groupSlots) {
          const v = inst[slot.fieldId]
          if (v != null && v !== '') byLabel[slot.label] = v
        }
        return byLabel
      })
      extraData[`__group_${block.id}`] = JSON.stringify(instances)
    }
    return extraData
  }

  // 建立沖銷憑單（草稿或送審共用）：建立→存附件；submit=true 時再送審。回傳是否成功
  async function createAndOptionallySubmit(submit: boolean): Promise<boolean> {
    if (!paymentId) return false
    // 儲存草稿（!submit）放寬沖銷金額下限（允許 0），送出時嚴格（必須 > 0）
    const { id: newVoucherId, error: saveError } = await createTempVoucher(paymentId, fieldValues, buildExtraData(), !submit)
    if (saveError) { setError(saveError); return false }

    const allAttachments = Object.values(pendingAttachments).flat()
    if (newVoucherId && allAttachments.length > 0) {
      await saveAttachments(null, null, allAttachments, newVoucherId)
    }

    if (submit && newVoucherId) {
      const { error: submitError } = await submitTempVoucher(newVoucherId)
      if (submitError) { setError(submitError); return false }
    }
    return true
  }

  async function handleSaveDraft() {
    if (!paymentId) return
    setSavingDraft(true)
    setError(null)
    const ok = await createAndOptionallySubmit(false)
    if (!ok) { setSavingDraft(false); return }
    router.push('/funds-voucher/my-voucher')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentId) return
    setSubmitting(true)
    setError(null)
    const ok = await createAndOptionallySubmit(true)
    if (!ok) { setSubmitting(false); return }
    router.push('/funds-voucher/my-voucher')
  }

  if (loading) return <p>載入中...</p>
  // 只有載入不到付款憑單才整頁換成錯誤畫面；送出被擋（例如沖銷金額檢查）時
  // 表單要保留讓使用者直接修改重送，錯誤訊息以中央彈窗顯示
  if (!payment) return (
    <div>
      <p style={{ color: '#dc2626' }}>{error ?? '載入失敗'}</p>
      <Link href="/funds-payment/my-payment" className={buttonVariants({ variant: 'outline' })}>返回</Link>
    </div>
  )

  // 整張沖銷單的沖銷金額＝所有區塊各組「總額」加總（＝後端 createTempVoucher 存入 amount 的同一算法）
  const voucherGrandTotal = schema.reduce((sum, b) => sum + blockGrandTotal(b), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href={`/funds-payment/my-payment/${paymentId}`} className={buttonVariants({ variant: 'outline' })}>
          ← 返回付款憑單
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>建立暫付款沖銷憑單</h1>
      </div>

      {/* 送出被擋（沖銷金額檢查等）改用全站共用中央彈窗 */}
      <ErrorDialog message={error} title="無法建立沖銷憑單" onClose={() => setError(null)} />

      {/* 母付款憑單對照：當初預支多少、這次沖銷多少、要回存多少 */}
      <PaymentSummaryCard payment={payment} voucherTotal={voucherGrandTotal} />

      <form onSubmit={handleSubmit}>
        {schema.map(block => {
          const groupRows = getGroupRows(block)
          const groupRowIds = new Set(groupRows.map(r => r.id))
          const normalRows = block.rows.filter(r => !groupRowIds.has(r.id))
          const instances = groupInstances[block.id] ?? []
          const grandTotal = blockGrandTotal(block)
          // 版面比照唯讀詳細頁：無群組/可重複列＝橫式（標籤在左），有群組列（付款明細）＝直式
          const horizontal = !block.rows.some(r => r.repeatable || r.rowGroupStart)
          return (
            <div key={block.id} style={{
              marginBottom: 16,
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              overflow: 'hidden',
              background: 'var(--bg-card)',
            }}>
              {block.title && (
                <div style={{
                  padding: '10px 20px',
                  background: 'var(--bg-sidebar)',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>{block.title}</span>
                  {groupRows.length > 0 && payment && (
                    <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                      <VoucherReturnSummary paidAmount={paidAmountOf(payment)} voucherTotal={grandTotal} />
                    </div>
                  )}
                </div>
              )}
              <div style={{ padding: '20px 20px 4px' }}>
                {normalRows.map(row => (
                  <div key={row.id} style={detailRowGridStyle(row.cols, horizontal)}>
                    {row.slots.map((slot, idx) => slot ? (
                      <DetailFieldLayout key={idx} label={slot.label} required={slot.required} horizontal={horizontal}>
                        {renderInput(slot, fieldValues[slot.fieldId] ?? '', v => setField(slot.fieldId, v))}
                      </DetailFieldLayout>
                    ) : <div key={idx} />)}
                  </div>
                ))}

                {groupRows.length > 0 && instances.map((inst, instIdx) => (
                  <div key={instIdx} style={{
                    border: '1px dashed var(--border-color)',
                    borderRadius: 8,
                    padding: '16px 16px 0',
                    marginBottom: 16,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>項目 {instIdx + 1}</span>
                      {instances.length > 1 && (
                        <Button type="button" variant="outline" size="sm" onClick={() => removeGroupInstance(block.id, instIdx)}>
                          刪除此項
                        </Button>
                      )}
                    </div>
                    {groupRows.map(row => (
                      <div key={row.id} style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${row.cols}, 1fr)`,
                        gap: 20,
                        marginBottom: 16,
                      }}>
                        {row.slots.map((slot, idx) => slot ? (
                          <div key={idx}>
                            <label style={labelStyle}>
                              {slot.label}
                              {slot.required && <span style={{ color: '#dc2626' }}> *</span>}
                            </label>
                            {renderInput(slot, inst[slot.fieldId] ?? '', v => setGroupField(block.id, instIdx, slot.fieldId, v))}
                          </div>
                        ) : <div key={idx} />)}
                      </div>
                    ))}
                  </div>
                ))}
                {groupRows.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Button type="button" variant="outline" size="sm" onClick={() => addGroupInstance(block.id)}>
                      ＋ 新增項目
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={submitting || savingDraft}>
            {savingDraft ? '儲存中...' : '儲存草稿'}
          </Button>
          <Button type="submit" disabled={submitting || savingDraft}>
            {submitting ? '送出中...' : '確定送出'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
        </div>
      </form>
    </div>
  )
}
