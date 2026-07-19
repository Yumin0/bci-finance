'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsPayment, FormBlock, FormSchemaRow, FormSlot, DropdownOption, FundAttachment, TaxRateOption } from '@/lib/types'
import { applyTaxFormula, computeBlockTax, formatTaxNumber } from '@/lib/taxUtils'
import { validateFeePositive } from '@/lib/feeValidation'
import { getTaxRateOptions } from '@/app/actions/tax-rates'
import { submitMyPayment, updateDraftPayment, updatePaymentAsReviewer } from '@/app/actions/payment'
import { logFieldChanges } from '@/app/actions/edit-logs'
import GroupEditTable from '@/app/_components/GroupEditTable'
import { getAttachmentsByAllocationId, getAttachmentsByPaymentId, saveAttachments, deleteAttachmentRecord } from '@/app/actions/attachments'
import { attachmentSlotLabels as attachmentSlotLabelsOf, firstAttachmentSlotLabel as firstAttachmentSlotLabelOf } from '@/lib/attachmentSlots'
import { FieldHint } from '@/app/_components/RecordDetailView'
import AttachmentUpload, { AttachmentItem } from '@/app/_components/AttachmentUpload'
import ErrorDialog from '@/app/_components/ErrorDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const readonlyCls = 'bg-[var(--bg-page)] cursor-default'

// 從 allocation 複製過來的直接欄位，付款憑單階段不可修改
// 注意：name 在此表單被挪用為「摘要/用途說明」，屬於可編輯的付款欄位，不列入
//（付款方式已於 2026-07-14 自 note fieldId 修正為 payment_method 結構化欄位）
const ALLOCATION_READONLY_FIELDS = new Set([
  'purchase_order_number', 'apply_division', 'apply_section',
  'applicant', 'apply_role', 'institution', 'payment_account',
  'expense_item', 'amount',
])

// 透過 label 比對來認定唯讀：這些欄位在表單設定中使用了 custom fieldId，
// 但語意上屬於從申請單帶入的資訊，送出前不應修改
// 注意：「類型」（一般/預支）不在此列 — 自 2026-07 起改在付款憑單階段選擇，草稿可修改
const ALLOCATION_READONLY_LABELS = new Set([
  '日期', '職稱', '是否為國外費用？',
])

// 類型欄位（一般/預支）：存入 funds_payment.category 結構化欄位（沖銷憑單判斷依據）
// 表單設定中的類型欄位可能是預設 fieldId 或自訂 fieldId（以 label 比對相容）
// 畫面以單一勾選框呈現：勾＝預支、不勾＝一般（資料仍存「一般/預支」，下游判斷不變）
const isCategorySlot = (slot: NonNullable<FormSlot>) =>
  slot.fieldId === 'category' || slot.label === '類型'

// 付款方式欄位：存入 funds_payment.payment_method 結構化欄位（列表「付款方式」欄的來源）
// 以 label 比對備援——2026-07-14 曾發生表單設定把此欄掛到 note fieldId，導致付款方式全數存空
const isPaymentMethodSlot = (slot: NonNullable<FormSlot>) =>
  slot.fieldId === 'payment_method' || slot.label === '付款方式'

function getGroupRows(block: FormBlock): FormSchemaRow[] {
  const startIdx = block.rows.findIndex(r => r.rowGroupStart)
  if (startIdx === -1) return []
  return block.rows.slice(startIdx)
}

function getRecordFieldValue(
  slot: NonNullable<FormSlot>,
  record: FundsPayment,
  allocExtraData?: Record<string, string> | null
): string {
  const map: Record<string, unknown> = {
    purchase_order_number: record.purchase_order_number,
    date: record.date,
    apply_division: record.apply_division,
    apply_section: record.apply_section,
    applicant: record.applicant,
    apply_role: record.apply_role,
    institution: record.institution,
    payment_account: record.payment_account,
    expense_item: record.expense_item,
    name: record.name,
    amount: record.amount,
    category: record.category,
    note: record.note,
    payment_method: record.payment_method,
  }
  // 1. fieldId 對應直接欄位
  const val = map[slot.fieldId]
  if (val != null && val !== '') return String(val)

  // 2. payment 自身的 extra_data
  if (record.extra_data) {
    const extra = record.extra_data[slot.label]
    if (extra != null && extra !== '') return extra
  }

  // 3. label → 直接欄位 fallback（custom fieldId 但語意對應直接欄位）
  const labelToColumn: Record<string, unknown> = {
    '日期': record.date,
    '職稱': record.apply_role,
    '類型': record.category,
  }
  const colFallback = labelToColumn[slot.label]
  if (colFallback != null && colFallback !== '') return String(colFallback)

  // 4. allocation 的 extra_data（處理舊資料未複製的欄位）
  if (allocExtraData) {
    const allocExtra = allocExtraData[slot.label]
    if (allocExtra != null && allocExtra !== '') return allocExtra
  }

  return '-'
}

/**
 * 付款憑單可編輯表單（自草稿編輯頁抽出的共用元件）。
 * mode='draft'：申請人編輯草稿——「儲存草稿／確定送出」，行為與原草稿編輯頁一致。
 * mode='reviewer'：目前關卡審核人於審核頁直接修改——「儲存變更」寫入 updatePaymentAsReviewer
 *   並記錄欄位級變更歷程（含附件與付款明細群組逐行比對）；類型（一般/預支）送審後鎖定不可改。
 */
export default function PaymentEditForm({
  record,
  schema,
  mode,
  userId,
  userName,
  onGrandTotalChange,
  onSaveSuccess,
}: {
  record: FundsPayment
  schema: FormBlock[]
  mode: 'draft' | 'reviewer'
  userId?: number | null
  userName?: string
  onGrandTotalChange?: (total: number) => void
  onSaveSuccess?: () => void | Promise<void>
}) {
  const router = useRouter()
  const isReviewer = mode === 'reviewer'
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // allocation extra_data fallback（舊資料未複製到 payment 的欄位）
  const [allocExtraData, setAllocExtraData] = useState<Record<string, string> | null>(null)

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, DropdownOption[]>>({})
  const [dynamicSelectOptions, setDynamicSelectOptions] = useState<Record<string, { value: string; label: string }[]>>({})
  const [payeeFullRecords, setPayeeFullRecords] = useState<Record<string, Array<{ label: string; searchKey: string; fieldValuesByLabel: Record<string, string> }>>>({})
  const [payeeSearch, setPayeeSearch] = useState<Record<string, string>>({})
  const [openPayeeId, setOpenPayeeId] = useState<string | null>(null)
  // 受款人自動帶入的欄位 label 集合（只能由選取受款人填入，不可手動輸入）
  const [payeeAutoFillLabels, setPayeeAutoFillLabels] = useState<Set<string>>(new Set())
  const [taxRateOptions, setTaxRateOptions] = useState<TaxRateOption[]>([])
  // 群組重複資料（key = blockId）：從已存的 __group_ 資料載入，可增刪修改
  const [groupInstances, setGroupInstances] = useState<Record<string, Record<string, string>[]>>({})
  // 使用者手動改過「總額」欄位的鍵集合（不再被費用/稅額變動自動覆寫）
  const [manualTotalKeys, setManualTotalKeys] = useState<Set<string>>(new Set())

  // 審核人變更歷程用：載入完成時的欄位值快照（diff 基準）
  const initialFieldValuesRef = useRef<Record<string, string>>({})
  const initialGroupsRef = useRef<Record<string, Record<string, string>[]>>({})

  function addGroupInstance(blockId: string) {
    setGroupInstances(prev => ({ ...prev, [blockId]: [...(prev[blockId] ?? [{}]), {}] }))
  }
  function removeGroupInstance(blockId: string, instIdx: number) {
    setGroupInstances(prev => {
      const instances = (prev[blockId] ?? [{}]).filter((_, i) => i !== instIdx)
      return { ...prev, [blockId]: instances.length ? instances : [{}] }
    })
  }

  // 附件
  const [inheritedAttachments, setInheritedAttachments] = useState<FundAttachment[]>([])
  const [ownAttachmentRows, setOwnAttachmentRows] = useState<FundAttachment[]>([])
  const [newPaymentAttachments, setNewPaymentAttachments] = useState<AttachmentItem[]>([])
  const [deletedPaymentAttachmentIds, setDeletedPaymentAttachmentIds] = useState<number[]>([])

  const toItem = (a: FundAttachment): AttachmentItem => ({
    id: a.id, fileName: a.file_name, storagePath: a.storage_path,
    fileType: a.file_type, url: a.url ?? '', slotLabel: a.slot_label,
  })
  const ownAttachments: AttachmentItem[] = useMemo(() => ownAttachmentRows.map(toItem), [ownAttachmentRows])
  const inheritedAttachmentItems: AttachmentItem[] = useMemo(() => inheritedAttachments.map(toItem), [inheritedAttachments])

  // 申請單附件帶入的位置＝表單第一個附件欄位（要換位置就在表單設定調欄位順序）
  const attachmentSlotLabels = useMemo(() => attachmentSlotLabelsOf(schema), [schema])
  const firstAttachmentSlotLabel = useMemo(() => firstAttachmentSlotLabelOf(schema), [schema])

  // 該附件欄位要顯示的本憑單附件。舊憑單的檔案存在寫死的 slot_label='payment'（底部附件區塊時代），
  // 表單裡沒有這個欄位，會對不到而看不見 → 一律收進第一個附件欄位（與 attachmentsForSlot 同規則）。
  function ownItemsForSlot(label: string): AttachmentItem[] {
    const isFirst = label === firstAttachmentSlotLabel
    return [...ownAttachments, ...newPaymentAttachments].filter(a =>
      !deletedPaymentAttachmentIds.includes(a.id ?? -1) &&
      (a.slotLabel === label || (isFirst && !attachmentSlotLabels.has(a.slotLabel)))
    )
  }

  function setField(fieldId: string, value: string) {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }))
  }

  const initedRef = useRef(false)
  useEffect(() => {
    if (initedRef.current || !schema.length) return
    initedRef.current = true

    async function init() {
      const paymentSchema = schema
      const rec = record

      // 撈 allocation 的 extra_data，補足舊 payment 未複製的欄位
      // 必須在初始化 fieldValues 之前取得，才能作為 fallback
      let allocExtra: Record<string, string> | null = null
      if (rec.funds_allocation_id) {
        const { data: allocData } = await supabase
          .from('funds_allocation')
          .select('extra_data')
          .eq('id', rec.funds_allocation_id)
          .single()
        if (allocData?.extra_data) {
          allocExtra = allocData.extra_data as Record<string, string>
          setAllocExtraData(allocExtra)
        }
      }

      const allSlots: NonNullable<FormSlot>[] = paymentSchema.flatMap(b =>
        b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null))
      )

      const isReadonlySlot = (slot: NonNullable<FormSlot>) =>
        slot.type === 'readonly' ||
        ALLOCATION_READONLY_FIELDS.has(slot.fieldId) ||
        ALLOCATION_READONLY_LABELS.has(slot.label)

      // 在建 initial 之前先查出所有 payee auto-fill label（第 2 個欄位起），
      // 才能在初始化時跳過 allocExtra fallback（避免 allocation 選過受款人的值污染）
      const payeeAutoFillLabelSet = new Set<string>()
      const payeeCatIds = new Set<number>()
      let needsAllPayeeCats = false
      for (const slot of allSlots) {
        if (!isReadonlySlot(slot) && slot.dataSource?.startsWith('payee_records:')) {
          if (slot.dataSource === 'payee_records:all') {
            needsAllPayeeCats = true
          } else {
            payeeCatIds.add(Number(slot.dataSource.replace('payee_records:', '')))
          }
        }
      }
      if (needsAllPayeeCats) {
        const { data: cats } = await supabase.from('payee_categories').select('id')
        for (const cat of (cats ?? [])) payeeCatIds.add(cat.id)
      }
      for (const catId of payeeCatIds) {
        const { data: pFields } = await supabase
          .from('payee_category_fields').select('label').eq('category_id', catId).order('sort_order')
        if (pFields && pFields.length > 1) pFields.slice(1).forEach(f => payeeAutoFillLabelSet.add(f.label))
      }
      setPayeeAutoFillLabels(payeeAutoFillLabelSet)

      // 從已存資料初始化欄位值。
      // 其他欄位：|| 而非 ?? ，因為舊資料存入的是空字串 '' 而非 null/undefined
      const groupSlotIds = new Set(
        paymentSchema.flatMap(b => getGroupRows(b).flatMap(r => r.slots.filter(Boolean).map(s => s!.fieldId)))
      )
      const initial: Record<string, string> = { payment_method: rec.payment_method ?? '' }
      // 付款方式（含 label 備援）：從結構化欄位載入，舊資料退回 extra_data 裡以欄位名稱存的值
      const pmSlot = allSlots.find(isPaymentMethodSlot)
      if (pmSlot) initial[pmSlot.fieldId] = rec.payment_method || rec.extra_data?.['付款方式'] || ''
      for (const slot of allSlots) {
        if (groupSlotIds.has(slot.fieldId)) continue
        if (isReadonlySlot(slot) || isPaymentMethodSlot(slot)) continue
        if (isCategorySlot(slot)) {
          // 類型從結構化欄位載入，預設「一般」
          initial[slot.fieldId] = rec.category || '一般'
        } else if (payeeAutoFillLabelSet.has(slot.label)) {
          initial[slot.fieldId] = rec.extra_data?.[slot.label] || ''
        } else {
          initial[slot.fieldId] = rec.extra_data?.[slot.label] || allocExtra?.[slot.label] || ''
        }
      }

      // 受款人 combobox 為空時，清除所有 auto-fill 欄位（避免歷史存檔污染顯示）
      for (const slot of allSlots) {
        if (!isReadonlySlot(slot) && slot.dataSource?.startsWith('payee_records:')) {
          if (!initial[slot.fieldId]) {
            for (const s of allSlots) {
              if (payeeAutoFillLabelSet.has(s.label)) initial[s.fieldId] = ''
            }
          }
        }
      }

      setFieldValues(initial)

      // 初始化群組資料：優先讀本憑單已存的 __group_{blockId}，
      // 沒有時退回其他 __group_ key（申請單合併進來的資料，舊憑單相容）
      const initGroups: Record<string, Record<string, string>[]> = {}
      for (const block of paymentSchema) {
        const groupSlots = getGroupRows(block).flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
        if (!groupSlots.length) continue
        let raw = rec.extra_data?.[`__group_${block.id}`]
        if (!raw) {
          const fallbackKey = Object.keys(rec.extra_data ?? {}).find(k => k.startsWith('__group_'))
            ?? (allocExtra ? Object.keys(allocExtra).find(k => k.startsWith('__group_')) : undefined)
          if (fallbackKey) raw = rec.extra_data?.[fallbackKey] ?? allocExtra?.[fallbackKey]
        }
        let parsed: Record<string, string>[] = []
        try { parsed = JSON.parse(raw ?? '[]') } catch { parsed = [] }
        initGroups[block.id] = parsed.length
          ? parsed.map(inst => {
              const mapped: Record<string, string> = {}
              for (const slot of groupSlots) {
                const v = inst[slot.label]
                if (v != null && v !== '') mapped[slot.fieldId] = v
              }
              return mapped
            })
          : [{}]
      }
      if (Object.keys(initGroups).length > 0) setGroupInstances(initGroups)

      // 變更歷程 diff 基準：載入完成當下的快照（深拷貝群組，避免之後編輯共用同一物件）
      initialFieldValuesRef.current = { ...initial }
      initialGroupsRef.current = Object.fromEntries(
        Object.entries(initGroups).map(([k, arr]) => [k, arr.map(inst => ({ ...inst }))])
      )

      // 收集需要的資料來源（只針對可編輯欄位）
      const neededSources = new Set<string>()
      for (const slot of allSlots) {
        if (isReadonlySlot(slot) || slot.type !== 'select') continue
        if (slot.dataSource) neededSources.add(slot.dataSource)
      }

      const fetches: Promise<void>[] = []

      if ([...neededSources].some(s => s.startsWith('dropdown_options:'))) {
        fetches.push((async () => {
          const { data: opts } = await supabase.from('dropdown_options').select('*')
          if (opts) {
            const grouped: Record<string, DropdownOption[]> = {}
            for (const opt of opts as DropdownOption[]) {
              if (!grouped[opt.field]) grouped[opt.field] = []
              grouped[opt.field].push(opt)
            }
            setDropdownOptions(grouped)
          }
        })())
      }

      for (const src of neededSources) {
        if (src === 'payee_records:all') {
          fetches.push((async () => {
            const { data: cats } = await supabase.from('payee_categories').select('id').order('sort_order')
            const options: { value: string; label: string }[] = []
            const fullRecords: Array<{ label: string; searchKey: string; fieldValuesByLabel: Record<string, string> }> = []
            for (const cat of (cats ?? [])) {
              const [fieldsRes, recordsRes] = await Promise.all([
                supabase.from('payee_category_fields').select('id, label, sort_order').eq('category_id', cat.id).order('sort_order'),
                supabase.from('payee_records').select('field_values').eq('category_id', cat.id).order('sort_order'),
              ])
              const fields = (fieldsRes.data ?? []) as { id: number; label: string }[]
              const fieldIds = fields.map(f => String(f.id))
              for (const r of recordsRes.data ?? []) {
                const fv = r.field_values as Record<string, string>
                const vals = fieldIds.map(fId => fv[fId]).filter(Boolean)
                const searchKey = vals.join(' ')
                const label = fv[fieldIds[0]] ?? vals[0] ?? ''
                if (!label) continue
                options.push({ value: label, label })
                const fieldValuesByLabel: Record<string, string> = {}
                for (const f of fields) {
                  const v = fv[String(f.id)]
                  if (v) fieldValuesByLabel[f.label] = v
                }
                fullRecords.push({ label, searchKey, fieldValuesByLabel })
              }
            }
            options.sort((a, b) => parseFloat(a.label) - parseFloat(b.label))
            setDynamicSelectOptions(prev => ({ ...prev, [src]: options }))
            setPayeeFullRecords(prev => ({ ...prev, [src]: fullRecords }))
          })())
          continue
        }
        if (!src.startsWith('fee_records:') && !src.startsWith('payee_records:')) continue
        fetches.push((async () => {
          const isPayee = src.startsWith('payee_records:')
          const [table, idStr] = isPayee
            ? ['payee_records', src.replace('payee_records:', '')] as const
            : ['fee_records', src.replace('fee_records:', '')] as const
          const fieldsTable = isPayee ? 'payee_category_fields' : 'fee_category_fields'
          const categoryId = Number(idStr)
          const [fieldsRes, recordsRes] = await Promise.all([
            supabase.from(fieldsTable).select('id, label, sort_order').eq('category_id', categoryId).order('sort_order'),
            supabase.from(table).select('field_values').eq('category_id', categoryId).order('sort_order'),
          ])
          const fields = (fieldsRes.data ?? []) as { id: number; label: string }[]
          const fieldIds = fields.map(f => String(f.id))
          const options: { value: string; label: string }[] = []
          const fullRecords: Array<{ label: string; searchKey: string; fieldValuesByLabel: Record<string, string> }> = []
          for (const r of recordsRes.data ?? []) {
            const fv = r.field_values as Record<string, string>
            const vals = fieldIds.map(fId => fv[fId]).filter(Boolean)
            const searchKey = vals.join(' ')
            const label = fv[fieldIds[0]] ?? vals[0] ?? ''
            if (!label) continue
            options.push({ value: label, label })
            if (isPayee) {
              const fieldValuesByLabel: Record<string, string> = {}
              for (const f of fields) {
                const v = fv[String(f.id)]
                if (v) fieldValuesByLabel[f.label] = v
              }
              fullRecords.push({ label, searchKey, fieldValuesByLabel })
            }
          }
          options.sort((a, b) => parseFloat(a.label) - parseFloat(b.label))
          setDynamicSelectOptions(prev => ({ ...prev, [src]: options }))
          if (isPayee) {
            setPayeeFullRecords(prev => ({ ...prev, [src]: fullRecords }))
          }
        })())
      }

      if (neededSources.has('tax_rates')) {
        fetches.push(getTaxRateOptions().then(data => setTaxRateOptions(data)))
      }

      await Promise.all(fetches)

      // 載入附件
      if (rec.funds_allocation_id) {
        getAttachmentsByAllocationId(rec.funds_allocation_id).then(setInheritedAttachments)
      }
      getAttachmentsByPaymentId(rec.id).then(setOwnAttachmentRows)

      setReady(true)
    }
    init()
  // 元件掛載時 record/schema 已就緒（父頁面載入完成才 render；審核頁儲存後以 key 重建）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema])

  function handlePayeeSelect(fieldId: string, chosen: { label: string; fieldValuesByLabel: Record<string, string> }) {
    setField(fieldId, chosen.label)
    setPayeeSearch(prev => ({ ...prev, [fieldId]: chosen.label }))
    setOpenPayeeId(null)
    const allSlots: NonNullable<FormSlot>[] = schema.flatMap(b =>
      b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null))
    )
    for (const slot of allSlots) {
      if (slot.fieldId === fieldId) continue
      const val = chosen.fieldValuesByLabel[slot.label]
      if (val !== undefined) setField(slot.fieldId, val)
    }
  }

  function renderPayeeCombobox(slot: NonNullable<FormSlot>, src: string) {
    const records = payeeFullRecords[src] ?? []
    const searchText = payeeSearch[slot.fieldId] ?? fieldValues[slot.fieldId] ?? ''
    const filtered = records.filter(r => r.searchKey.toLowerCase().includes(searchText.toLowerCase()))
    const isOpen = openPayeeId === slot.fieldId
    return (
      <div style={{ position: 'relative' }}>
        <Input
          value={searchText}
          onChange={e => {
            setPayeeSearch(prev => ({ ...prev, [slot.fieldId]: e.target.value }))
            setField(slot.fieldId, e.target.value)
            setOpenPayeeId(slot.fieldId)
          }}
          onFocus={() => setOpenPayeeId(slot.fieldId)}
          onBlur={() => setTimeout(() => setOpenPayeeId(null), 150)}
          placeholder="輸入姓名搜尋..."
        />
        {isOpen && filtered.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            zIndex: 50, maxHeight: 200, overflowY: 'auto',
            color: 'var(--text-body)',
          }}>
            {filtered.map((r, i) => (
              <div
                key={i}
                onMouseDown={() => handlePayeeSelect(slot.fieldId, r)}
                style={{ padding: '8px 12px', fontSize: 14, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-page)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
              >
                {r.label}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const blockTaxMap: Record<string, ReturnType<typeof computeBlockTax>> = {}
  // 群組區塊的彙總顯示（key = blockId）：加總所有組
  // 付款憑單「總額」為純手動填寫、不自動加總，彙總的總額＝各組「總額」欄位加總
  const groupBlockSummary: Record<string, { taxBase: number; taxAmount: number; total: number }> = {}
  for (const block of schema) {
    const groupRows = getGroupRows(block)
    if (groupRows.length > 0) {
      const groupSlots = groupRows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
      const taxSelectSlot = groupSlots.find(s => s.dataSource === 'tax_rates' && s.taxConfig)
      const baseFieldId = taxSelectSlot?.taxConfig?.baseFieldId ?? ''
      const taxAmtFieldId = taxSelectSlot?.taxConfig?.taxAmountFieldId
      const totalFieldId = taxSelectSlot?.taxConfig?.totalFieldId
      const instances = groupInstances[block.id] ?? [{}]
      let totalBase = 0, totalTax = 0, totalAmount = 0
      instances.forEach((inst) => {
        totalBase += parseFloat(inst[baseFieldId] ?? '0') || 0
        totalTax += taxAmtFieldId ? (parseFloat(inst[taxAmtFieldId] ?? '0') || 0) : 0
        totalAmount += totalFieldId ? (parseFloat(inst[totalFieldId] ?? '0') || 0) : 0
      })
      groupBlockSummary[block.id] = { taxBase: totalBase, taxAmount: totalTax, total: totalAmount }
      continue
    }
    const info = computeBlockTax(block, fieldValues, taxRateOptions)
    if (info) blockTaxMap[block.id] = info
  }
  const computedTotals: Record<string, string> = {}
  const computedTotalHints: Record<string, string> = {}
  const editableTotalFieldIds = new Set<string>()
  for (const [blockId, info] of Object.entries(blockTaxMap)) {
    if (!info) continue
    editableTotalFieldIds.add(info.totalFieldId)
    computedTotals[info.totalFieldId] = String(Math.floor(info.total))
    if (info.taxAmountFieldId) computedTotals[info.taxAmountFieldId] = String(Math.floor(info.taxAmount))
    const blk = schema.find(b => b.id === blockId)
    if (blk) {
      const allBlockSlots = blk.rows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
      const sumParts = allBlockSlots
        .filter(s => s.type === 'number' && s.fieldId !== info.totalFieldId && (!info.taxAmountFieldId || s.fieldId !== info.taxAmountFieldId))
        .map(s => s.label)
      if (sumParts.length > 0) computedTotalHints[info.totalFieldId] = `（${[...sumParts, '稅額'].join('＋')}）`
    }
  }

  // 這張憑單的總金額 = 所有區塊（群組彙總 或 單一稅務區塊）的總額加總
  const grandTotal = schema.reduce((sum, block) => {
    const groupSummary = groupBlockSummary[block.id]
    if (groupSummary) return sum + groupSummary.total
    const info = blockTaxMap[block.id]
    if (info) return sum + info.total
    return sum
  }, 0)

  useEffect(() => {
    onGrandTotalChange?.(grandTotal)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grandTotal])

  function renderEditField(slot: NonNullable<FormSlot>) {
    const { fieldId, type, dataSource, staticOptions } = slot

    // 從 allocation 繼承的欄位：永遠唯讀
    if (type === 'readonly' || ALLOCATION_READONLY_FIELDS.has(fieldId) || ALLOCATION_READONLY_LABELS.has(slot.label)) {
      // radio 型別保留視覺，用 disabled 呈現選取狀態
      if (type === 'radio') {
        const currentVal = getRecordFieldValue(slot, record, allocExtraData)
        return (
          <div style={{ display: 'flex', gap: 20, padding: '8px 0' }}>
            {(staticOptions ?? []).map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-muted)', cursor: 'default' }}>
                <input type="radio" disabled checked={opt === currentVal} readOnly />
                {opt}
              </label>
            ))}
          </div>
        )
      }
      return <Input value={getRecordFieldValue(slot, record, allocExtraData)} readOnly className={readonlyCls} />
    }

    // 類型：單一勾選框（勾＝預支、不勾＝一般）；送審後鎖定（影響沖銷資格），審核人不可改
    if (isCategorySlot(slot)) {
      return (
        <div style={{ padding: '8px 0' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: isReviewer ? 'default' : 'pointer', width: 'fit-content', color: isReviewer ? 'var(--text-muted)' : undefined }}>
            <input
              type="checkbox"
              disabled={isReviewer}
              checked={fieldValues[fieldId] === '預支'}
              onChange={e => setField(fieldId, e.target.checked ? '預支' : '一般')}
            />
            預支（需事後沖銷）
          </label>
        </div>
      )
    }

    if (type === 'radio') {
      return (
        <div style={{ display: 'flex', gap: 20, padding: '8px 0' }}>
          {(staticOptions ?? []).map(opt => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
              <input
                type="radio"
                name={fieldId}
                value={opt}
                checked={fieldValues[fieldId] === opt}
                onChange={e => setField(fieldId, e.target.value)}
              />
              {opt}
            </label>
          ))}
        </div>
      )
    }

    // 受款人自動帶入欄位：唯讀，只能由選取受款人後填入
    if (payeeAutoFillLabels.has(slot.label)) {
      return <Input value={fieldValues[fieldId] ?? ''} readOnly className={readonlyCls} />
    }

    if (computedTotals[fieldId] !== undefined) {
      if (editableTotalFieldIds.has(fieldId)) {
        const manualKey = `root:${fieldId}`
        const isManual = manualTotalKeys.has(manualKey)
        return (
          <Input
            type="number"
            value={isManual ? (fieldValues[fieldId] ?? '') : computedTotals[fieldId]}
            onChange={e => {
              setManualTotalKeys(prev => new Set(prev).add(manualKey))
              setField(fieldId, e.target.value)
            }}
          />
        )
      }
      return <Input value={computedTotals[fieldId]} readOnly className={readonlyCls} />
    }

    if (type === 'select') {
      if (dataSource === 'tax_rates') {
        return (
          <SearchableSelect
            value={fieldValues[fieldId] ?? ''}
            onChange={v => setField(fieldId, v)}
            options={taxRateOptions.map(o => ({ value: o.label, label: o.label }))}
          />
        )
      }
      if (dataSource.startsWith('payee_records:') && payeeFullRecords[dataSource]) {
        return renderPayeeCombobox(slot, dataSource)
      }
      let options: { value: string; label: string }[] = []
      if (dataSource === 'static') {
        options = (staticOptions ?? []).map(o => ({ value: o, label: o }))
      } else if (dataSource.startsWith('dropdown_options:')) {
        const field = dataSource.replace('dropdown_options:', '')
        options = (dropdownOptions[field] ?? []).map(o => ({ value: o.label, label: o.label }))
      } else if (dataSource.startsWith('fee_records:') || dataSource.startsWith('payee_records:')) {
        options = dynamicSelectOptions[dataSource] ?? []
      }
      return (
        <SearchableSelect
          value={fieldValues[fieldId] ?? ''}
          onChange={v => setField(fieldId, v)}
          options={options}
        />
      )
    }

    if (type === 'attachment') {
      return (
        <AttachmentUpload
          slotLabel={slot.label}
          attachments={ownItemsForSlot(slot.label)}
          lockedItems={slot.label === firstAttachmentSlotLabel ? inheritedAttachmentItems : undefined}
          lockedTag="來自申請單"
          onAdd={item => setNewPaymentAttachments(prev => [...prev, item])}
          onRemove={item => {
            if (item.id) setDeletedPaymentAttachmentIds(prev => [...prev, item.id!])
            else setNewPaymentAttachments(prev => prev.filter(a => a.storagePath !== item.storagePath))
          }}
        />
      )
    }

    if (type === 'textarea') {
      return (
        <Textarea
          value={fieldValues[fieldId] ?? ''}
          onChange={e => setField(fieldId, e.target.value)}
          rows={4}
        />
      )
    }

    const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'
    return (
      <Input
        type={inputType}
        value={fieldValues[fieldId] ?? ''}
        onChange={e => setField(fieldId, e.target.value)}
      />
    )
  }

  // 群組內欄位渲染（讀寫該組的 instValues，而非 fieldValues）
  function renderGroupField(slot: NonNullable<FormSlot>, instValues: Record<string, string>, setInstField: (fieldId: string, val: string) => void) {
    const { fieldId, type, dataSource, staticOptions } = slot
    if (type === 'select') {
      let options: { value: string; label: string }[] = []
      if (dataSource === 'tax_rates') {
        options = taxRateOptions.map(o => ({ value: o.label, label: o.label }))
      } else if (dataSource === 'static') {
        options = (staticOptions ?? []).map(o => ({ value: o, label: o }))
      } else if (dataSource.startsWith('dropdown_options:')) {
        const field = dataSource.replace('dropdown_options:', '')
        options = (dropdownOptions[field] ?? []).map(o => ({ value: o.label, label: o.label }))
      } else if (dataSource.startsWith('fee_records:') || dataSource.startsWith('payee_records:')) {
        options = dynamicSelectOptions[dataSource] ?? []
      }
      return (
        <SearchableSelect
          value={instValues[fieldId] ?? ''}
          onChange={v => setInstField(fieldId, v)}
          options={options}
          portal
        />
      )
    }
    if (type === 'textarea') {
      return <Textarea value={instValues[fieldId] ?? ''} onChange={e => setInstField(fieldId, e.target.value)} rows={4} />
    }
    const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'
    return (
      <Input type={inputType} value={instValues[fieldId] ?? ''} onChange={e => setInstField(fieldId, e.target.value)} />
    )
  }

  // 供 GroupEditTable 依「最長選項」自動配置下拉欄寬（選項短的欄變窄、長的加寬）
  function groupSelectOptionLabels(slot: NonNullable<FormSlot>): string[] | undefined {
    if (slot.type !== 'select') return undefined
    if (slot.dataSource === 'tax_rates') return taxRateOptions.map(o => o.label)
    if (slot.dataSource === 'static') return slot.staticOptions ?? []
    if (slot.dataSource.startsWith('dropdown_options:')) {
      return (dropdownOptions[slot.dataSource.replace('dropdown_options:', '')] ?? []).map(o => o.label)
    }
    if (slot.dataSource.startsWith('fee_records:') || slot.dataSource.startsWith('payee_records:')) {
      return (dynamicSelectOptions[slot.dataSource] ?? []).map(o => o.label)
    }
    return undefined
  }

  // 群組區塊：逐組渲染（可增刪修改），與付款憑單建立頁行為一致
  function renderGroupInstances(block: FormBlock) {
    const groupRows = getGroupRows(block)
    if (groupRows.length === 0) return null
    const groupSlots = groupRows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
    const taxSelectSlot = groupSlots.find(s => s.dataSource === 'tax_rates' && s.taxConfig)
    const instances = groupInstances[block.id] ?? [{}]

    // 費用或稅額選擇改變時，自動帶入稅額（不鎖定，使用者仍可手動覆寫）
    function setInstFieldWithAutoTax(instIdx: number, fieldId: string, val: string) {
      setGroupInstances(prev => {
        const allInst = [...(prev[block.id] ?? [{}])]
        const newInst = { ...allInst[instIdx], [fieldId]: val }
        if (taxSelectSlot?.taxConfig) {
          const { baseFieldId, taxAmountFieldId } = taxSelectSlot.taxConfig
          if (taxAmountFieldId && (fieldId === baseFieldId || fieldId === taxSelectSlot.fieldId)) {
            const fee = parseFloat(fieldId === baseFieldId ? val : (newInst[baseFieldId] ?? '0')) || 0
            const label = fieldId === taxSelectSlot.fieldId ? val : (newInst[taxSelectSlot.fieldId] ?? '')
            const opt = taxRateOptions.find(o => o.label === label)
            newInst[taxAmountFieldId] = String(opt ? Math.floor(applyTaxFormula(fee, opt.formula_steps)) : 0)
          }
        }
        allInst[instIdx] = newInst
        return { ...prev, [block.id]: allInst }
      })
    }

    // 未稅金額/稅額/總額 皆為一般數字欄：稅額於選稅或改未稅金額時自動帶入，總額純手動填寫、不自動加總
    return (
      <GroupEditTable
        slots={groupSlots}
        instances={instances}
        selectOptionLabels={groupSelectOptionLabels}
        onAdd={() => addGroupInstance(block.id)}
        onRemove={instIdx => removeGroupInstance(block.id, instIdx)}
        renderCell={(slot, instValues, instIdx) =>
          renderGroupField(slot, instValues, (fid, val) => setInstFieldWithAutoTax(instIdx, fid, val))
        }
      />
    )
  }

  function buildExtraData(): Record<string, string> {
    const allSlots: NonNullable<FormSlot>[] = schema.flatMap(b =>
      b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null))
    )
    const groupSlotFieldIds = new Set(
      schema.flatMap(b => getGroupRows(b).flatMap(r => r.slots.filter(Boolean).map(s => s!.fieldId)))
    )
    const extraData: Record<string, string> = {}
    for (const slot of allSlots) {
      if (groupSlotFieldIds.has(slot.fieldId)) continue
      // 附件欄位的檔案存在 fund_attachments（以 slot_label 對應），不是 extra_data 的文字值
      if (slot.type === 'attachment') continue
      if (slot.type === 'readonly' || ALLOCATION_READONLY_FIELDS.has(slot.fieldId) || ALLOCATION_READONLY_LABELS.has(slot.label) || isPaymentMethodSlot(slot)) continue
      // 類型存入 funds_payment.category 結構化欄位，不重複存進動態欄位資料
      if (isCategorySlot(slot)) continue
      extraData[slot.label] = computedTotals[slot.fieldId] ?? fieldValues[slot.fieldId] ?? ''
    }
    // 群組重複資料：以 label 為 key 存成 JSON（與申請單格式一致）
    // 各欄位（含總額）直接存使用者填寫值：總額為純手動填寫、不自動加總
    for (const block of schema) {
      const groupRows = getGroupRows(block)
      if (groupRows.length === 0) continue
      const groupSlots = groupRows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
      const instances = groupInstances[block.id] ?? [{}]
      const labeled = instances.map(inst => {
        const obj: Record<string, string> = {}
        for (const slot of groupSlots) obj[slot.label] = inst[slot.fieldId] ?? ''
        return obj
      })
      extraData[`__group_${block.id}`] = JSON.stringify(labeled)
    }
    return extraData
  }

  async function persistPaymentAttachments(paymentId: number) {
    await Promise.all(deletedPaymentAttachmentIds.map(id => deleteAttachmentRecord(id)))
    if (newPaymentAttachments.length) {
      await saveAttachments(null, paymentId, newPaymentAttachments.map(a => ({
        slotLabel: a.slotLabel, fileName: a.fileName,
        storagePath: a.storagePath, fileType: a.fileType,
      })))
    }
  }

  // 目前表單裡付款方式欄位的選擇值（含 label 備援；schema 沒有此欄位時退回 payment_method key）
  function getPaymentMethodValue(): string {
    const pmSlot = schema
      .flatMap(b => b.rows.flatMap(r => r.slots))
      .find((s): s is NonNullable<FormSlot> => s !== null && isPaymentMethodSlot(s))
    return (pmSlot ? fieldValues[pmSlot.fieldId] : fieldValues['payment_method']) ?? ''
  }

  // 目前表單裡類型欄位的選擇值（schema 沒有類型欄位時回傳 undefined，不更新該欄位）
  function getCategoryValue(): string | undefined {
    const categorySlot = schema
      .flatMap(b => b.rows.flatMap(r => r.slots))
      .find((s): s is NonNullable<FormSlot> => s !== null && isCategorySlot(s))
    if (!categorySlot) return undefined
    return fieldValues[categorySlot.fieldId] || '一般'
  }

  // 審核人變更歷程：與載入快照逐欄比對（比照資金分配 EditFundsForm 的呈現：
  // 一般欄位「欄位：舊→新」、群組明細「第N筆 欄位」與「新增/刪除第N筆」）
  function computeChangeLogs() {
    const changes: { fieldLabel: string; oldValue: string; newValue: string }[] = []
    const init = initialFieldValuesRef.current
    const allSlots: NonNullable<FormSlot>[] = schema.flatMap(b =>
      b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null))
    )
    const groupSlotFieldIds = new Set(
      schema.flatMap(b => getGroupRows(b).flatMap(r => r.slots.filter(Boolean).map(s => s!.fieldId)))
    )
    const seen = new Set<string>()
    for (const slot of allSlots) {
      if (groupSlotFieldIds.has(slot.fieldId)) continue
      if (slot.type === 'attachment' || slot.type === 'readonly') continue
      if (ALLOCATION_READONLY_FIELDS.has(slot.fieldId) || ALLOCATION_READONLY_LABELS.has(slot.label)) continue
      if (seen.has(slot.fieldId)) continue
      seen.add(slot.fieldId)
      const oldVal = init[slot.fieldId] ?? ''
      const newVal = computedTotals[slot.fieldId] ?? fieldValues[slot.fieldId] ?? ''
      if (oldVal !== newVal) changes.push({ fieldLabel: slot.label, oldValue: oldVal, newValue: newVal })
    }

    for (const block of schema) {
      const groupSlots = getGroupRows(block).flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
      if (!groupSlots.length) continue
      const oldArr = initialGroupsRef.current[block.id] ?? [{}]
      const newArr = groupInstances[block.id] ?? [{}]
      const multiRow = Math.max(oldArr.length, newArr.length) > 1
      const minLen = Math.min(oldArr.length, newArr.length)
      for (let rowIdx = 0; rowIdx < minLen; rowIdx++) {
        for (const slot of groupSlots) {
          const oldVal = oldArr[rowIdx]?.[slot.fieldId] ?? ''
          const newVal = newArr[rowIdx]?.[slot.fieldId] ?? ''
          if (oldVal !== newVal) {
            const label = multiRow ? `第${rowIdx + 1}筆 ${slot.label}` : slot.label
            changes.push({ fieldLabel: label, oldValue: oldVal, newValue: newVal })
          }
        }
      }
      for (let i = minLen; i < newArr.length; i++) {
        const row = newArr[i]
        const summary = groupSlots.map(s => `${s.label}：${row[s.fieldId] ?? ''}`).filter(s => !s.endsWith('：')).join('、')
        changes.push({ fieldLabel: `新增第${i + 1}筆`, oldValue: '（無）', newValue: summary || '（新增）' })
      }
      for (let i = minLen; i < oldArr.length; i++) {
        const row = oldArr[i]
        const summary = groupSlots.map(s => `${s.label}：${row[s.fieldId] ?? ''}`).filter(s => !s.endsWith('：')).join('、')
        changes.push({ fieldLabel: `刪除第${i + 1}筆`, oldValue: summary || '（已刪除）', newValue: '（已刪除）' })
      }
    }

    // 憑單金額（各組總額加總）變動也記一筆，審核人一眼看得出金額被改過
    if (grandTotal !== (record.amount ?? 0)) {
      changes.push({ fieldLabel: '憑單金額', oldValue: String(record.amount ?? 0), newValue: String(grandTotal) })
    }

    // 附件增刪
    const deletedItems = ownAttachmentRows.filter(a => deletedPaymentAttachmentIds.includes(a.id))
    for (const a of deletedItems) {
      changes.push({ fieldLabel: `刪除附件（${a.slot_label}）`, oldValue: a.file_name, newValue: '（已刪除）' })
    }
    for (const a of newPaymentAttachments) {
      changes.push({ fieldLabel: `新增附件（${a.slotLabel}）`, oldValue: '（無）', newValue: a.fileName })
    }
    return changes
  }

  async function handleSaveDraft() {
    // 超額檢查交給 updateDraftPayment 的存檔驗證（伺服器回點名式訊息）
    setSaving(true)
    setError(null)
    const { error: saveError } = await updateDraftPayment(record.id, getPaymentMethodValue(), buildExtraData(), getCategoryValue(), grandTotal)
    if (saveError) { setError(saveError); setSaving(false); return }
    await persistPaymentAttachments(record.id)
    setSaving(false)
  }

  async function handleSubmitDraft() {
    // 付款憑單表單沒有可重複列，repeatableValues 傳空物件
    const feeError = validateFeePositive(schema, fieldValues, {}, groupInstances)
    if (feeError) { setError(feeError); return }
    // 超額檢查交給 updateDraftPayment 的存檔驗證（伺服器回點名式訊息）
    setSubmitting(true)
    setError(null)
    const { error: saveError } = await updateDraftPayment(record.id, getPaymentMethodValue(), buildExtraData(), getCategoryValue(), grandTotal)
    if (saveError) { setError(saveError); setSubmitting(false); return }
    await persistPaymentAttachments(record.id)
    const { error: submitError } = await submitMyPayment(record.id)
    if (submitError) { setError(submitError); setSubmitting(false); return }
    router.push('/funds-payment/my-payment')
  }

  // 審核人儲存變更：後端再驗證審核人身分與金額上限，成功後記變更歷程、由父頁面重載刷新
  async function handleSaveChanges() {
    const feeError = validateFeePositive(schema, fieldValues, {}, groupInstances)
    if (feeError) { setError(feeError); return }
    setSaving(true)
    setError(null)
    const changes = computeChangeLogs()
    const { error: saveError } = await updatePaymentAsReviewer(record.id, getPaymentMethodValue(), buildExtraData(), grandTotal)
    if (saveError) { setError(saveError); setSaving(false); return }
    await persistPaymentAttachments(record.id)
    if (changes.length > 0 && userId) {
      await logFieldChanges({
        fundsPaymentId: record.id,
        changedBy: userId,
        changedByName: userName ?? '',
        stepNumber: record.current_step ?? null,
        changes,
      })
    }
    setSaving(false)
    await onSaveSuccess?.()
  }

  if (!ready) return <p style={{ padding: 24 }}>載入中...</p>

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        {schema.map(block => {
          if (block.showWhen && fieldValues[block.showWhen.fieldId] !== block.showWhen.value) return null
          const groupRows = getGroupRows(block)
          const preGroupRows = block.rows.filter(r => !groupRows.includes(r))
          const groupSummary = groupBlockSummary[block.id]
          return (
            <div key={block.id} style={{
              marginBottom: 16,
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              background: 'var(--bg-card)',
            }}>
              {(block.title || blockTaxMap[block.id] || groupSummary) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)', borderRadius: '9px 9px 0 0' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>{block.title ?? ''}</span>
                  {groupSummary ? (
                    <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>未稅金額 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(groupSummary.taxBase)}</strong></span>
                      <span style={{ color: 'var(--text-muted)' }}>稅額 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(groupSummary.taxAmount)}</strong></span>
                      <span style={{ color: 'var(--text-muted)' }}>總額 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(groupSummary.total)}</strong></span>
                    </div>
                  ) : blockTaxMap[block.id] && (() => {
                    const info = blockTaxMap[block.id]!
                    return (
                      <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>費用 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(info.taxBase)}</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>稅額 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(info.taxAmount)}</strong></span>
                      </div>
                    )
                  })()}
                </div>
              )}
              <div style={{ padding: '20px 20px 4px' }}>
                {preGroupRows.map(row => (
                  <div key={row.id} style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${row.cols}, 1fr)`,
                    gap: 20,
                    marginBottom: 20,
                  }}>
                    {row.slots.map((slot, idx) => {
                      if (slot?.showWhen && !slot.showWhen.values.includes(fieldValues[slot.showWhen.fieldId] ?? '')) {
                        return <div key={idx} />
                      }
                      return slot ? (
                        <div key={idx}>
                          <label style={labelStyle}>
                            {slot.label}
                            {computedTotalHints[slot.fieldId] && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, fontWeight: 400 }}>{computedTotalHints[slot.fieldId]}</span>}
                          </label>
                          <FieldHint hint={slot.hint} />
                          {renderEditField(slot)}
                        </div>
                      ) : <div key={idx} />
                    })}
                  </div>
                ))}
                {renderGroupInstances(block)}
              </div>
            </div>
          )
        })}
      </div>

      {/* 儲存/送出被擋（費用檢查、超額、審核人身分等）改用全站共用中央彈窗 */}
      <ErrorDialog message={error} title="無法儲存或送出" onClose={() => setError(null)} />

      {mode === 'draft' ? (
        <div style={{ marginTop: 32, display: 'flex', gap: 8 }}>
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving || submitting}>
            {saving ? '儲存中...' : '儲存草稿'}
          </Button>
          <Button onClick={handleSubmitDraft} disabled={submitting || saving}>
            {submitting ? '送出中...' : '確定送出'}
          </Button>
        </div>
      ) : (
        <div style={{ marginTop: 32, display: 'flex', gap: 8 }}>
          <Button onClick={handleSaveChanges} disabled={saving}>
            {saving ? '儲存中...' : '儲存變更'}
          </Button>
        </div>
      )}
    </div>
  )
}
