'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FormBlock, FormSchemaRow, FormSlot, FundAttachment } from '@/lib/types'
import { updateTempVoucherAsReviewer } from '@/app/actions/temp-voucher'
import { getAttachmentsByTempVoucherId, saveAttachments, deleteAttachmentRecord } from '@/app/actions/attachments'
import { logFieldChanges } from '@/app/actions/edit-logs'
import { attachmentSlotLabels as attachmentSlotLabelsOf, firstAttachmentSlotLabel as firstAttachmentSlotLabelOf } from '@/lib/attachmentSlots'
import { paidAmountOf } from '@/lib/voucherReturnAmount'
import VoucherReturnSummary from './VoucherReturnSummary'
import { VoucherParentPayment } from './PaymentSummaryCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import AttachmentUpload, { AttachmentItem } from '@/app/_components/AttachmentUpload'
import ErrorDialog from '@/app/_components/ErrorDialog'
import GroupEditTable from '@/app/_components/GroupEditTable'
import { DetailFieldLayout, detailRowGridStyle } from '@/app/_components/RecordDetailView'

const readonlyCls = 'bg-muted/40 cursor-default'

// 結構化欄位（temp_vouchers 自己的欄位；其餘自訂欄位以 label 存 extra_data）
const STRUCTURAL_FIELD_IDS = new Set(['date', 'apply_division', 'apply_section', 'applicant', 'apply_role', 'amount', 'note'])

// 金額欄鎖唯讀（沖銷金額＝各組總額加總，審核人不可異動；有問題退回由申請人改）
const MONEY_LABELS = new Set(['未稅金額', '稅額', '總額'])

type VoucherRecord = {
  id: number
  funds_payment_id: number
  current_step: number | null
  date: string | null
  apply_division: string | null
  apply_section: string | null
  applicant: string | null
  apply_role: string | null
  amount: number | null
  note: string | null
  extra_data: Record<string, string> | null
  funds_payment?: VoucherParentPayment | null
}

function getGroupRows(block: FormBlock): FormSchemaRow[] {
  const startIdx = block.rows.findIndex(r => r.rowGroupStart)
  if (startIdx === -1) return []
  return block.rows.slice(startIdx)
}

function isReadonlySlot(slot: NonNullable<FormSlot>): boolean {
  return ['apply_division', 'apply_section', 'applicant', 'apply_role', 'amount'].includes(slot.fieldId)
    || slot.label === '採購單號' // 唯讀帶入母付款憑單採購單號
    || slot.type === 'readonly'
}

/**
 * 暫付款沖銷憑單審核人可編輯表單（審核頁專用，比照付款憑單 PaymentEditForm mode='reviewer'）。
 * 「儲存變更」走 updateTempVoucherAsReviewer（server 端再驗審核人身分＋金額防線），
 * 每次儲存記欄位級變更歷程（temp_voucher_id，含附件增刪與群組明細逐行比對）。
 * 金額欄鎖唯讀、不可增刪明細組；附件欄位可增刪（審核階段補傳單據）。
 */
export default function VoucherEditForm({
  record,
  schema,
  userId,
  userName,
  parentAttachments,
  onSaveSuccess,
}: {
  record: VoucherRecord
  schema: FormBlock[]
  userId: number | null
  userName: string
  // 上游附件（申請單＋母付款憑單），唯讀帶入第一個附件欄位供對照
  parentAttachments: (FundAttachment & { tag?: string })[]
  onSaveSuccess?: () => void | Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  // 群組資料（key = blockId，instance key = fieldId）；只載入已存有 __group_ 資料的區塊，
  // 舊沖銷單無群組資料時不憑空生出金額列（與唯讀頁「無資料不顯示表格」一致）
  const [groupInstances, setGroupInstances] = useState<Record<string, Record<string, string>[]>>({})

  // 附件：既有列即時載入；新增的上傳即存 Storage、儲存變更時才落 fund_attachments；刪除同樣延後到儲存
  const [ownAttachmentRows, setOwnAttachmentRows] = useState<FundAttachment[]>([])
  const [newAttachments, setNewAttachments] = useState<AttachmentItem[]>([])
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([])

  // 變更歷程 diff 基準：載入完成當下的快照
  const initialFieldValuesRef = useRef<Record<string, string>>({})
  const initialGroupsRef = useRef<Record<string, Record<string, string>[]>>({})

  const attachmentSlotLabels = useMemo(() => attachmentSlotLabelsOf(schema), [schema])
  const firstAttachmentSlotLabel = useMemo(() => firstAttachmentSlotLabelOf(schema), [schema])

  const toItem = (a: FundAttachment & { tag?: string }): AttachmentItem => ({
    id: a.id, fileName: a.file_name, storagePath: a.storage_path,
    fileType: a.file_type, url: a.url ?? '', slotLabel: a.slot_label, tag: a.tag,
  })
  const ownAttachments: AttachmentItem[] = useMemo(() => ownAttachmentRows.map(toItem), [ownAttachmentRows])
  const parentItems: AttachmentItem[] = useMemo(() => parentAttachments.map(toItem), [parentAttachments])

  // slot_label 對不上任何附件欄位的舊檔一律收進第一個附件欄位（與 attachmentsForSlot 同規則）
  function ownItemsForSlot(label: string): AttachmentItem[] {
    const isFirst = label === firstAttachmentSlotLabel
    return [...ownAttachments, ...newAttachments].filter(a =>
      !deletedAttachmentIds.includes(a.id ?? -1) &&
      (a.slotLabel === label || (isFirst && !attachmentSlotLabels.has(a.slotLabel)))
    )
  }

  const initedRef = useRef(false)
  useEffect(() => {
    if (initedRef.current || !schema.length) return
    initedRef.current = true

    const allSlots: NonNullable<FormSlot>[] = schema.flatMap(b =>
      b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null))
    )
    const groupSlotIds = new Set(
      schema.flatMap(b => getGroupRows(b).flatMap(r => r.slots.filter(Boolean).map(s => s!.fieldId)))
    )

    // 從已存資料初始化欄位值（結構化欄位讀自己的欄、自訂欄位以 label 讀 extra_data）
    const structuralMap: Record<string, unknown> = {
      date: record.date,
      apply_division: record.apply_division,
      apply_section: record.apply_section,
      applicant: record.applicant,
      apply_role: record.apply_role,
      amount: record.amount,
      note: record.note,
    }
    const initial: Record<string, string> = {}
    for (const slot of allSlots) {
      if (groupSlotIds.has(slot.fieldId) || slot.type === 'attachment') continue
      if (slot.label === '採購單號') {
        initial[slot.fieldId] = record.funds_payment?.purchase_order_number ?? ''
        continue
      }
      const val = structuralMap[slot.fieldId] ?? record.extra_data?.[slot.label]
      initial[slot.fieldId] = val == null ? '' : String(val)
    }
    setFieldValues(initial)

    // 群組資料：讀 __group_{blockId}（instance key 為 label），轉成 fieldId key 供編輯
    const initGroups: Record<string, Record<string, string>[]> = {}
    for (const block of schema) {
      const groupSlots = getGroupRows(block).flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
      if (!groupSlots.length) continue
      const raw = record.extra_data?.[`__group_${block.id}`]
      if (!raw) continue
      let parsed: Record<string, string>[] = []
      try { parsed = JSON.parse(raw) } catch { parsed = [] }
      if (!Array.isArray(parsed) || !parsed.length) continue
      initGroups[block.id] = parsed.map(inst => {
        const mapped: Record<string, string> = {}
        for (const slot of groupSlots) {
          const v = inst[slot.label]
          if (v != null && v !== '') mapped[slot.fieldId] = v
        }
        return mapped
      })
    }
    setGroupInstances(initGroups)

    // 深拷貝快照當 diff 基準
    initialFieldValuesRef.current = { ...initial }
    initialGroupsRef.current = Object.fromEntries(
      Object.entries(initGroups).map(([k, arr]) => [k, arr.map(inst => ({ ...inst }))])
    )

    getAttachmentsByTempVoucherId(record.id).then(setOwnAttachmentRows)
  // 元件掛載時 record/schema 已就緒（父頁面載入完成才 render；儲存後以 key 重建）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema])

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

  function renderInput(slot: NonNullable<FormSlot>, value: string, onChange?: (v: string) => void) {
    const readonly = !onChange || isReadonlySlot(slot)
    if (slot.type === 'attachment') {
      return (
        <AttachmentUpload
          slotLabel={slot.label}
          attachments={ownItemsForSlot(slot.label)}
          lockedItems={slot.label === firstAttachmentSlotLabel && parentItems.length ? parentItems : undefined}
          onAdd={item => setNewAttachments(prev => [...prev, item])}
          onRemove={item => {
            if (item.id) setDeletedAttachmentIds(prev => [...prev, item.id!])
            else setNewAttachments(prev => prev.filter(a => a.storagePath !== item.storagePath))
          }}
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

  // 各組「總額」加總＝沖銷金額（金額鎖唯讀，僅顯示用；與後端存的 amount 一致）
  function blockGrandTotal(block: FormBlock): number {
    const groupSlots = getGroupRows(block).flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
    const totalSlot = groupSlots.find(s => s.type === 'number' && s.label === '總額')
    if (!totalSlot) return 0
    return (groupInstances[block.id] ?? []).reduce((sum, inst) => {
      const v = Number(inst[totalSlot.fieldId])
      return Number.isFinite(v) ? sum + v : sum
    }, 0)
  }

  // 以既有 extra_data 為底合併（保留表單設定改過欄位名稱等對不上 slot 的舊 key），
  // 自訂欄位以 label 覆寫、群組以 __group_{blockId} 覆寫（instance key 為 label，含空值欄）
  function buildExtraData(): Record<string, string> {
    const extraData: Record<string, string> = { ...(record.extra_data ?? {}) }
    const groupSlotIds = new Set(
      schema.flatMap(b => getGroupRows(b).flatMap(r => r.slots.filter(Boolean).map(s => s!.fieldId)))
    )
    for (const block of schema) {
      for (const row of block.rows) {
        for (const slot of row.slots) {
          if (!slot || groupSlotIds.has(slot.fieldId)) continue
          if (slot.type === 'attachment' || isReadonlySlot(slot)) continue
          if (STRUCTURAL_FIELD_IDS.has(slot.fieldId)) continue
          extraData[slot.label] = fieldValues[slot.fieldId] ?? ''
        }
      }
    }
    for (const block of schema) {
      const instances = groupInstances[block.id]
      if (!instances) continue
      const groupSlots = getGroupRows(block).flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
      const labeled = instances.map(inst => {
        const obj: Record<string, string> = {}
        for (const slot of groupSlots) obj[slot.label] = inst[slot.fieldId] ?? ''
        return obj
      })
      extraData[`__group_${block.id}`] = JSON.stringify(labeled)
    }
    return extraData
  }

  // 變更歷程：與載入快照逐欄比對（一般欄位、群組明細「第N筆 欄位」、附件增刪）
  function computeChangeLogs() {
    const changes: { fieldLabel: string; oldValue: string; newValue: string }[] = []
    const init = initialFieldValuesRef.current
    const groupSlotIds = new Set(
      schema.flatMap(b => getGroupRows(b).flatMap(r => r.slots.filter(Boolean).map(s => s!.fieldId)))
    )
    const seen = new Set<string>()
    for (const block of schema) {
      for (const row of block.rows) {
        for (const slot of row.slots) {
          if (!slot || groupSlotIds.has(slot.fieldId)) continue
          if (slot.type === 'attachment' || isReadonlySlot(slot)) continue
          if (seen.has(slot.fieldId)) continue
          seen.add(slot.fieldId)
          const oldVal = init[slot.fieldId] ?? ''
          const newVal = fieldValues[slot.fieldId] ?? ''
          if (oldVal !== newVal) changes.push({ fieldLabel: slot.label, oldValue: oldVal, newValue: newVal })
        }
      }
    }

    for (const block of schema) {
      const groupSlots = getGroupRows(block).flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
      if (!groupSlots.length) continue
      const oldArr = initialGroupsRef.current[block.id] ?? []
      const newArr = groupInstances[block.id] ?? []
      const multiRow = Math.max(oldArr.length, newArr.length) > 1
      for (let rowIdx = 0; rowIdx < Math.min(oldArr.length, newArr.length); rowIdx++) {
        for (const slot of groupSlots) {
          const oldVal = oldArr[rowIdx]?.[slot.fieldId] ?? ''
          const newVal = newArr[rowIdx]?.[slot.fieldId] ?? ''
          if (oldVal !== newVal) {
            const label = multiRow ? `第${rowIdx + 1}筆 ${slot.label}` : slot.label
            changes.push({ fieldLabel: label, oldValue: oldVal, newValue: newVal })
          }
        }
      }
    }

    const deletedItems = ownAttachmentRows.filter(a => deletedAttachmentIds.includes(a.id))
    for (const a of deletedItems) {
      changes.push({ fieldLabel: `刪除附件（${a.slot_label}）`, oldValue: a.file_name, newValue: '（已刪除）' })
    }
    for (const a of newAttachments) {
      changes.push({ fieldLabel: `新增附件（${a.slotLabel}）`, oldValue: '（無）', newValue: a.fileName })
    }
    return changes
  }

  // 審核人儲存變更：後端再驗審核人身分與金額欄未被異動，成功後記變更歷程、由父頁面重載刷新
  async function handleSaveChanges() {
    setSaving(true)
    setError(null)
    const changes = computeChangeLogs()
    const { error: saveError } = await updateTempVoucherAsReviewer(record.id, fieldValues, buildExtraData())
    if (saveError) { setError(saveError); setSaving(false); return }
    await Promise.all(deletedAttachmentIds.map(id => deleteAttachmentRecord(id)))
    if (newAttachments.length) {
      await saveAttachments(null, null, newAttachments.map(a => ({
        slotLabel: a.slotLabel, fileName: a.fileName,
        storagePath: a.storagePath, fileType: a.fileType,
      })), record.id)
    }
    if (changes.length > 0 && userId) {
      await logFieldChanges({
        tempVoucherId: record.id,
        changedBy: userId,
        changedByName: userName,
        stepNumber: record.current_step ?? null,
        changes,
      })
    }
    setSaving(false)
    await onSaveSuccess?.()
  }

  return (
    <div>
      <ErrorDialog message={error} title="無法儲存變更" onClose={() => setError(null)} />

      {schema.map(block => {
        const groupRows = getGroupRows(block)
        const groupRowIds = new Set(groupRows.map(r => r.id))
        const instances = groupInstances[block.id]
        // 有群組資料時群組列以表格呈現；舊單無群組資料時群組列照一般列渲染（與唯讀頁一致）
        const normalRows = instances ? block.rows.filter(r => !groupRowIds.has(r.id)) : block.rows
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
                {instances && record.funds_payment && (
                  <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                    <VoucherReturnSummary paidAmount={paidAmountOf(record.funds_payment)} voucherTotal={blockGrandTotal(block)} />
                  </div>
                )}
              </div>
            )}
            <div style={{ padding: '20px 20px 4px' }}>
              {normalRows.map(row => (
                <div key={row.id} style={detailRowGridStyle(row.cols, horizontal)}>
                  {row.slots.map((slot, idx) => slot ? (
                    <DetailFieldLayout key={idx} label={slot.label} required={slot.required} horizontal={horizontal} hint={slot.hint}>
                      {renderInput(slot, fieldValues[slot.fieldId] ?? '', v => setField(slot.fieldId, v))}
                    </DetailFieldLayout>
                  ) : <div key={idx} />)}
                </div>
              ))}

              {instances && (
                <GroupEditTable
                  slots={groupRows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]}
                  instances={instances}
                  renderCell={(slot, inst, instIdx) =>
                    MONEY_LABELS.has(slot.label)
                      ? <Input value={inst[slot.fieldId] ?? ''} readOnly className={readonlyCls} />
                      : renderInput(slot, inst[slot.fieldId] ?? '', v => setGroupField(block.id, instIdx, slot.fieldId, v))
                  }
                />
              )}
            </div>
          </div>
        )
      })}

      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <Button onClick={handleSaveChanges} disabled={saving}>
          {saving ? '儲存中...' : '儲存變更'}
        </Button>
      </div>
    </div>
  )
}
