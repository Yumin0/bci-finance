'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsAllocation, FormBlock, FormSchemaRow, FormSlot, DropdownOption, TaxRateOption, FundAttachment } from '@/lib/types'
import { applyTaxFormula, computeBlockTax, formatTaxNumber } from '@/lib/taxUtils'
import { getTaxRateOptions } from '@/app/actions/tax-rates'
import { createPayment, submitMyPayment, nextPurchaseOrderNumber } from '@/app/actions/payment'
import { validateFeePositive } from '@/lib/feeValidation'
import { taipeiToday } from '@/lib/dateUtils'
import { getAllocationRemainingInfo, type AllocationRemainingInfo } from '@/app/actions/fund-budget'
import { getFormSchemas } from '@/app/actions/form-schema'
import { getAttachmentsByAllocationId, saveAttachments } from '@/app/actions/attachments'
import { firstAttachmentSlotLabel as firstAttachmentSlotLabelOf } from '@/lib/attachmentSlots'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import AttachmentUpload, { AttachmentItem } from '@/app/_components/AttachmentUpload'
import AllocationSummaryCard from '@/app/_components/AllocationSummaryCard'
import GroupEditTable from '@/app/_components/GroupEditTable'
import ErrorDialog from '@/app/_components/ErrorDialog'
import { DetailFieldLayout, FieldHint, detailRowGridStyle } from '@/app/_components/RecordDetailView'


// fieldId-based: known default fieldIds that are direct allocation columns → always readonly
// 注意：category（類型：一般/預支）不在此列 — 自 2026-07 起改在付款憑單階段由使用者選擇
const ALLOCATION_READONLY_FIELD_IDS = new Set([
  'purchase_order_number', 'date',
  'apply_division', 'apply_section', 'applicant', 'apply_role',
  'institution', 'payment_account', 'expense_item',
  'amount',
])

// 類型欄位（一般/預支）：在付款憑單建立時選擇，存入 funds_payment.category 結構化欄位
// 表單設定中的類型欄位可能是預設 fieldId 或自訂 fieldId（以 label 比對相容）
// 畫面以單一勾選框呈現：勾＝預支、不勾＝一般（資料仍存「一般/預支」，下游判斷不變）
const isCategorySlot = (slot: NonNullable<FormSlot>) =>
  slot.fieldId === 'category' || slot.label === '類型'

// 付款方式欄位：存入 funds_payment.payment_method 結構化欄位（列表「付款方式」欄的來源）
// 以 label 比對備援——2026-07-14 曾發生表單設定把此欄掛到 note fieldId，導致付款方式全數存空
const isPaymentMethodSlot = (slot: NonNullable<FormSlot>) =>
  slot.fieldId === 'payment_method' || slot.label === '付款方式'

// Label-based fallback: catches fields whose Supabase fieldId differs from the default
// (e.g. 職稱/類型 in a customised schema). Also covers extra_data-only fields.
const ALLOCATION_READONLY_LABEL_MAP: Record<string, (r: FundsAllocation) => string> = {
  // 採購單號實際值由 nextPurchaseOrderNumber 取得（renderField 特例處理），這裡留空當保底
  '採購單號':     () => '',
  // 日期＝實際建單日（2026-07-14 Yumin 拍板），不再顯示母單申請日期（母單日期看頁首摘要卡）
  '申請日期':     () => taipeiToday(),
  '日期':         () => taipeiToday(),
  '申請處別':     r => r.apply_division ?? '',
  '申請課別':     r => r.apply_section ?? '',
  '申請人':       r => r.applicant ?? '',
  '職稱':         r => r.apply_role ?? '',
  '是否為國外費用？': r => r.extra_data?.['是否為國外費用？'] ?? '',
  '機構':         r => r.institution ?? '',
  '出款帳戶':     r => r.payment_account ?? '',
  '費用項目':     r => r.expense_item ?? '',
  '金額':         r => r.amount != null ? String(r.amount) : '',
}

// Fields to pre-fill as initial value but keep editable (by fieldId or by label)
// 注意：'note' 不可加入 — 2026-07-14 前表單設定「付款方式」曾掛 note fieldId（已修正為 payment_method），
// 若未來又有欄位掛到 note，預填會把申請單備註帶進去（應保持空白讓使用者自填）
const ALLOCATION_PREFILL_FIELD_IDS = new Set(['name'])

function getGroupRows(block: FormBlock): FormSchemaRow[] {
  const startIdx = block.rows.findIndex(r => r.rowGroupStart)
  if (startIdx === -1) return []
  return block.rows.slice(startIdx)
}

function getAllocFieldValue(fieldId: string, record: FundsAllocation): string {
  const map: Record<string, unknown> = {
    purchase_order_number: '', // 實際值由 nextPurchaseOrderNumber 取得（renderField 特例處理）
    date: taipeiToday(), // 日期＝實際建單日，不再繼承母單申請日期
    apply_division: record.apply_division,
    apply_section: record.apply_section,
    applicant: record.applicant,
    apply_role: record.apply_role,
    institution: record.institution,
    payment_account: record.payment_account,
    expense_item: record.expense_item,
    amount: record.amount,
    name: record.name,
    note: record.note,
  }
  const val = map[fieldId]
  if (val == null || val === '') return ''
  return String(val)
}

export default function AddPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<FundsAllocation | null>(null)
  const [allocationId, setAllocationId] = useState<number | null>(null)
  const [schema, setSchema] = useState<FormBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [allocationAttachments, setAllocationAttachments] = useState<FundAttachment[]>([])
  const [pendingAttachments, setPendingAttachments] = useState<Record<string, AttachmentItem[]>>({})

  // 申請單附件唯讀帶入第一個附件欄位（要換位置就在表單設定調欄位順序）
  const allocationAttachmentItems: AttachmentItem[] = useMemo(
    () => allocationAttachments.map(a => ({ id: a.id, fileName: a.file_name, storagePath: a.storage_path, fileType: a.file_type, url: a.url ?? '', slotLabel: a.slot_label })),
    [allocationAttachments]
  )
  const firstAttachmentSlotLabel = useMemo(() => firstAttachmentSlotLabelOf(schema), [schema])
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, DropdownOption[]>>({})
  const [dynamicSelectOptions, setDynamicSelectOptions] = useState<Record<string, { value: string; label: string }[]>>({})
  const [payeeFullRecords, setPayeeFullRecords] = useState<Record<string, Array<{ label: string; searchKey: string; fieldValuesByLabel: Record<string, string> }>>>({})
  const [payeeSearch, setPayeeSearch] = useState<Record<string, string>>({})
  const [openPayeeId, setOpenPayeeId] = useState<string | null>(null)
  const [payeeAutoFillLabels, setPayeeAutoFillLabels] = useState<Set<string>>(new Set())
  const [taxRateOptions, setTaxRateOptions] = useState<TaxRateOption[]>([])
  // 群組重複資料（key = blockId）：由申請單的 __group_ 資料帶入，可增刪修改
  const [groupInstances, setGroupInstances] = useState<Record<string, Record<string, string>[]>>({})
  // 使用者手動改過「總額」欄位的鍵集合（不再被費用/稅額變動自動覆寫）；
  // key 格式：群組實例 `${blockId}:${instIdx}:${totalFieldId}`，非群組欄位 `root:${fieldId}`
  const [manualTotalKeys, setManualTotalKeys] = useState<Set<string>>(new Set())
  const [remainingInfo, setRemainingInfo] = useState<AllocationRemainingInfo | null>(null)
  // 這張憑單建立後會拿到的採購單號（母單號＋下一個 3 碼流水），僅供畫面預覽
  const [nextPoNumber, setNextPoNumber] = useState<string>('')

  const setField = useCallback((id: string, val: string) => {
    setFieldValues(prev => ({ ...prev, [id]: val }))
  }, [])

  function addGroupInstance(blockId: string) {
    setGroupInstances(prev => ({ ...prev, [blockId]: [...(prev[blockId] ?? [{}]), {}] }))
  }
  function removeGroupInstance(blockId: string, instIdx: number) {
    setGroupInstances(prev => {
      const instances = (prev[blockId] ?? [{}]).filter((_, i) => i !== instIdx)
      return { ...prev, [blockId]: instances.length ? instances : [{}] }
    })
  }

  useEffect(() => {
    async function load() {
      const { id } = await params
      const numId = Number(id)
      setAllocationId(numId)

      const [{ data, error: fetchError }, schemas, remaining] = await Promise.all([
        supabase.from('funds_allocation').select('*').eq('id', numId).single(),
        getFormSchemas(),
        getAllocationRemainingInfo(numId),
      ])
      if (fetchError) { setError(fetchError.message); setLoading(false); return }
      setRemainingInfo(remaining)
      setRecord(data as FundsAllocation)
      nextPurchaseOrderNumber(numId, (data as FundsAllocation).serial_number).then(po => setNextPoNumber(po ?? ''))

      const paymentSchema = schemas.payment_voucher
      setSchema(paymentSchema)

      const rec = data as FundsAllocation
      const schemaGroupSlotIds = new Set(
        paymentSchema.flatMap(b => getGroupRows(b).flatMap(r => r.slots.filter(Boolean).map(s => s!.fieldId)))
      )
      // 申請單付款明細「第一組」的值（label → 值）：申請單把單據種類/幣別存在明細組裡，
      // 而付款憑單這兩欄在組外（整張填一次），對不到頂層值時退回帶第一組的值
      // （2026-07-14 Yumin 拍板：多組值不同時帶第一組，可修改）
      const firstGroupByLabel: Record<string, string> = {}
      for (const [key, raw] of Object.entries(rec.extra_data ?? {})) {
        if (!key.startsWith('__group_')) continue
        try {
          const parsed = JSON.parse(raw)
          const first = Array.isArray(parsed) ? parsed[0] : null
          if (first && typeof first === 'object') {
            for (const [label, v] of Object.entries(first)) {
              if (firstGroupByLabel[label] === undefined && typeof v === 'string' && v !== '') firstGroupByLabel[label] = v
            }
          }
        } catch { /* 忽略解析錯誤 */ }
      }

      const initValues: Record<string, string> = {}
      paymentSchema.flatMap(b => b.rows.flatMap(r => r.slots)).forEach(slot => {
        if (!slot) return
        // Group slots are pre-filled per-instance from the allocation's __group_ data below
        if (schemaGroupSlotIds.has(slot.fieldId)) return
        // Skip readonly fields (they read directly from rec, not from fieldValues)
        if (ALLOCATION_READONLY_FIELD_IDS.has(slot.fieldId)) return
        if (slot.label in ALLOCATION_READONLY_LABEL_MAP) return
        // 類型：預設「一般」；舊申請單仍存有類型時帶入舊值
        if (isCategorySlot(slot)) {
          initValues[slot.fieldId] = rec.category || '一般'
          return
        }
        // Pre-fill known editable fields by fieldId
        if (ALLOCATION_PREFILL_FIELD_IDS.has(slot.fieldId)) {
          const val = getAllocFieldValue(slot.fieldId, rec)
          if (val) initValues[slot.fieldId] = val
          return
        }
        // Pre-fill other editable fields from allocation.extra_data by label (e.g. 幣別, 會計科目)
        // 頂層沒有時退回申請單付款明細第一組的值（單據種類/幣別存在組裡）
        const extraVal = rec.extra_data?.[slot.label] ?? firstGroupByLabel[slot.label]
        if (extraVal) initValues[slot.fieldId] = extraVal
      })
      if (Object.keys(initValues).length > 0) setFieldValues(initValues)

      // 從申請單的群組資料（extra_data.__group_*，label 為 key）帶入付款明細各組
      const allocGroupArrays: Record<string, string>[][] = []
      for (const [key, raw] of Object.entries(rec.extra_data ?? {})) {
        if (!key.startsWith('__group_')) continue
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed) && parsed.length) allocGroupArrays.push(parsed)
        } catch { /* 忽略解析錯誤 */ }
      }
      const initGroups: Record<string, Record<string, string>[]> = {}
      let groupArrayIdx = 0
      // 「總額」預帶母單目前的剩餘額度（可改小）：一張分配單能分次開多張憑單陸續扣款，
      // 所以帶的是剩餘、不是核准金額——額度已用掉一部分時帶核准金額必定超額被擋，
      // 等於預帶一個系統自己保證會擋掉的數字。第一張憑單時剩餘＝核准金額，結果一樣。
      const initTotal = remaining && remaining.remaining > 0 ? String(remaining.remaining) : ''
      for (const block of paymentSchema) {
        const groupSlots = getGroupRows(block).flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
        if (!groupSlots.length) continue
        // 三個金額欄（未稅金額/稅額/總額）不從申請單帶入：付款憑單金額由承辦人依實際單據逐張填寫，
        // 與申請單的費用/稅額脫鉤（付款憑單稅務設定用全新 fieldId，這裡以 taxConfig 認出金額欄一律略過帶入）
        const taxSelectSlot = groupSlots.find(s => s.dataSource === 'tax_rates' && s.taxConfig)
        const totalFieldId = taxSelectSlot?.taxConfig?.totalFieldId
        const amountFieldIds = new Set(
          [taxSelectSlot?.taxConfig?.baseFieldId, taxSelectSlot?.taxConfig?.taxAmountFieldId, totalFieldId]
            .filter(Boolean) as string[]
        )
        // 只有第一組帶剩餘額度：多組全帶的話光預帶值加總就爆掉母單額度
        const totalForIdx = (idx: number) => (idx === 0 && totalFieldId && initTotal ? initTotal : '')
        const allocInstances = allocGroupArrays[groupArrayIdx++]
        if (allocInstances) {
          initGroups[block.id] = allocInstances.map((inst, idx) => {
            const mapped: Record<string, string> = {}
            for (const slot of groupSlots) {
              if (amountFieldIds.has(slot.fieldId)) {
                if (slot.fieldId === totalFieldId && totalForIdx(idx)) mapped[slot.fieldId] = initTotal
                continue
              }
              const v = inst[slot.label]
              if (v != null && v !== '') mapped[slot.fieldId] = v
            }
            return mapped
          })
        } else {
          // 舊資料（無群組格式）：以一般標籤值帶入單一組
          const single: Record<string, string> = {}
          for (const slot of groupSlots) {
            if (amountFieldIds.has(slot.fieldId)) {
              if (slot.fieldId === totalFieldId && initTotal) single[slot.fieldId] = initTotal
              continue
            }
            const v = rec.extra_data?.[slot.label]
            if (v) single[slot.fieldId] = v
          }
          initGroups[block.id] = [single]
        }
      }
      if (Object.keys(initGroups).length > 0) setGroupInstances(initGroups)

      const allSlots: NonNullable<FormSlot>[] = paymentSchema.flatMap(b =>
        b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null))
      )
      const neededSources = new Set(allSlots.map(s => s.dataSource))

      const fetches: Promise<void>[] = []

      const dropdownFields: string[] = []
      if (neededSources.has('dropdown_options:institution')) dropdownFields.push('institution')
      if (neededSources.has('dropdown_options:payment_account')) dropdownFields.push('payment_account')
      if (dropdownFields.length) {
        fetches.push(
          (async () => {
            const { data: opts } = await supabase.from('dropdown_options').select('*').in('field', dropdownFields).order('sort_order')
            if (opts) {
              const grouped: Record<string, DropdownOption[]> = {}
              for (const opt of opts as DropdownOption[]) {
                if (!grouped[opt.field]) grouped[opt.field] = []
                grouped[opt.field].push(opt)
              }
              setDropdownOptions(grouped)
            }
          })()
        )
      }

      for (const src of neededSources) {
        if (src === 'payee_records:all') {
          fetches.push(
            (async () => {
              const { data: cats } = await supabase.from('payee_categories').select('id').order('sort_order')
              const options: { value: string; label: string }[] = []
              const fullRecords: Array<{ label: string; searchKey: string; fieldValuesByLabel: Record<string, string> }> = []
              const autoFillLabels = new Set<string>()
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
                fields.slice(1).forEach(f => autoFillLabels.add(f.label))
              }
              options.sort((a, b) => parseFloat(a.label) - parseFloat(b.label))
              setDynamicSelectOptions(prev => ({ ...prev, [src]: options }))
              setPayeeFullRecords(prev => ({ ...prev, [src]: fullRecords }))
              if (autoFillLabels.size) setPayeeAutoFillLabels(prev => new Set([...prev, ...autoFillLabels]))
            })()
          )
        } else if (src.startsWith('fee_records:') || src.startsWith('payee_records:')) {
          fetches.push(
            (async () => {
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
                const autoFillLabels = fields.slice(1).map(f => f.label)
                if (autoFillLabels.length) setPayeeAutoFillLabels(prev => new Set([...prev, ...autoFillLabels]))
              }
            })()
          )
        }
      }

      if (neededSources.has('tax_rates')) {
        fetches.push(getTaxRateOptions().then(data => setTaxRateOptions(data)))
      }

      await Promise.all(fetches)
      getAttachmentsByAllocationId(numId).then(setAllocationAttachments)
      setLoading(false)
    }
    load()
  }, [params])

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
          required={slot.required}
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

  function renderField(slot: NonNullable<FormSlot>, rec: FundsAllocation) {
    const { fieldId, type, dataSource, staticOptions, required } = slot

    // 採購單號：顯示建立後會拿到的單號（母單號＋下一個流水碼，由 server 算）
    if (fieldId === 'purchase_order_number' || slot.label === '採購單號') {
      return <Input value={nextPoNumber} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
    }

    // Fields inherited from allocation: always readonly regardless of schema type
    // Check by fieldId first, then fall back to label map (handles Supabase-customised schemas)
    const isAllocReadonlyById = type === 'readonly' || ALLOCATION_READONLY_FIELD_IDS.has(fieldId)
    const isAllocReadonlyByLabel = !isAllocReadonlyById && (slot.label in ALLOCATION_READONLY_LABEL_MAP)
    if (isAllocReadonlyById || isAllocReadonlyByLabel) {
      const allocVal = isAllocReadonlyById
        ? getAllocFieldValue(fieldId, rec)
        : ALLOCATION_READONLY_LABEL_MAP[slot.label](rec)
      // Radio fields: keep radio UI but disabled
      if (type === 'radio' && staticOptions?.length) {
        return (
          <div style={{ display: 'flex', gap: 20, padding: '8px 0' }}>
            {staticOptions.map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'not-allowed', opacity: allocVal === opt ? 1 : 0.45 }}>
                <input type="radio" name={fieldId} value={opt} checked={allocVal === opt} disabled readOnly />
                {opt}
              </label>
            ))}
          </div>
        )
      }
      return <Input value={allocVal} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
    }

    // 類型：單一勾選框（勾＝預支、不勾＝一般）
    if (isCategorySlot(slot)) {
      return (
        <div style={{ padding: '8px 0' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', width: 'fit-content' }}>
            <input
              type="checkbox"
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
                required={required && !fieldValues[fieldId]}
              />
              {opt}
            </label>
          ))}
        </div>
      )
    }

    // 受款人自動帶入欄位：唯讀，只能由選取受款人後填入
    if (payeeAutoFillLabels.has(slot.label)) {
      return <Input value={fieldValues[fieldId] ?? ''} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
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
      return <Input value={computedTotals[fieldId]} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
    }

    if (type === 'select') {
      if (dataSource === 'tax_rates') {
        return (
          <SearchableSelect
            value={fieldValues[fieldId] ?? ''}
            onChange={v => setField(fieldId, v)}
            options={taxRateOptions.map(o => ({ value: o.label, label: o.label }))}
            required={required}
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
          required={required}
        />
      )
    }

    if (type === 'attachment') {
      const items = pendingAttachments[slot.label] ?? []
      return (
        <AttachmentUpload
          slotLabel={slot.label}
          attachments={items}
          lockedItems={slot.label === firstAttachmentSlotLabel ? allocationAttachmentItems : undefined}
          lockedTag="來自申請單"
          onAdd={item => setPendingAttachments(prev => ({ ...prev, [slot.label]: [...(prev[slot.label] ?? []), item] }))}
          onRemove={item => setPendingAttachments(prev => ({ ...prev, [slot.label]: (prev[slot.label] ?? []).filter(a => a.storagePath !== item.storagePath) }))}
        />
      )
    }

    if (type === 'textarea') {
      return (
        <Textarea
          value={fieldValues[fieldId] ?? ''}
          onChange={e => setField(fieldId, e.target.value)}
          required={required}
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
        required={required}
      />
    )
  }

  // 群組內欄位渲染（讀寫該組的 instValues，而非 fieldValues）
  function renderGroupField(slot: NonNullable<FormSlot>, instValues: Record<string, string>, setInstField: (fieldId: string, val: string) => void) {
    const { fieldId, type, dataSource, staticOptions, required } = slot
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
          required={required}
          portal
        />
      )
    }
    if (type === 'textarea') {
      return <Textarea value={instValues[fieldId] ?? ''} onChange={e => setInstField(fieldId, e.target.value)} required={required} rows={4} />
    }
    const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'
    return (
      <Input type={inputType} value={instValues[fieldId] ?? ''} onChange={e => setInstField(fieldId, e.target.value)} required={required} />
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

  // 群組區塊：逐組渲染（帶入自申請單，仍可增刪修改），與申請單表單行為一致
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

  // 組出送給 createPayment 的欄位資料（extraData／類型／付款方式），儲存草稿與確定送出共用
  function buildPaymentData(): { extraData: Record<string, string>; categoryValue: string | null; paymentMethodValue: string } {
    const allSlots: NonNullable<FormSlot>[] = schema.flatMap(b =>
      b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null))
    )
    const groupSlotFieldIds = new Set(
      schema.flatMap(b => getGroupRows(b).flatMap(r => r.slots.filter(Boolean).map(s => s!.fieldId)))
    )
    const extraData: Record<string, string> = {}
    for (const slot of allSlots) {
      if (groupSlotFieldIds.has(slot.fieldId)) continue
      if (slot.type === 'readonly') continue
      if (slot.type === 'attachment') continue
      if (ALLOCATION_READONLY_FIELD_IDS.has(slot.fieldId)) continue
      if (slot.label in ALLOCATION_READONLY_LABEL_MAP) continue
      if (isPaymentMethodSlot(slot)) continue
      // 類型存入 funds_payment.category 結構化欄位（沖銷憑單判斷依據），不重複存進動態欄位資料
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

    const categorySlot = allSlots.find(isCategorySlot)
    const categoryValue = categorySlot ? (fieldValues[categorySlot.fieldId] || '一般') : null

    // 付款方式以欄位（含 label 備援）解析，存入結構化欄位
    const paymentMethodSlot = allSlots.find(isPaymentMethodSlot)
    const paymentMethodValue = (paymentMethodSlot ? fieldValues[paymentMethodSlot.fieldId] : fieldValues['payment_method']) ?? ''

    return { extraData, categoryValue, paymentMethodValue }
  }

  // 建立付款憑單（草稿或送審共用）：建立→存附件；submit=true 時再送審。回傳是否成功
  async function createAndOptionallySubmit(submit: boolean): Promise<boolean> {
    if (!allocationId || !record) return false
    const { extraData, categoryValue, paymentMethodValue } = buildPaymentData()

    // 超額檢查交給 createPayment 的存檔驗證：伺服器會回點名式訊息
    // （核准金額、底下已有哪幾張憑單各佔多少、這次最多能填多少），比前端只知道剩餘數字更清楚
    // 儲存草稿（!submit）放寬金額下限（允許 0），送出時嚴格（必須 > 0）
    const { id: newPaymentId, error: insertError } = await createPayment(
      allocationId,
      paymentMethodValue,
      extraData,
      categoryValue,
      grandTotal,
      !submit,
    )
    if (insertError) { setError(insertError); return false }

    const allAttachments = Object.values(pendingAttachments).flat()
    if (newPaymentId && allAttachments.length > 0) {
      await saveAttachments(null, newPaymentId, allAttachments)
    }

    if (submit && newPaymentId) {
      const { error: submitError } = await submitMyPayment(newPaymentId)
      if (submitError) { setError(submitError); return false }
    }
    return true
  }

  async function handleSaveDraft() {
    if (!allocationId || !record) return
    setSavingDraft(true)
    setError(null)
    const ok = await createAndOptionallySubmit(false)
    if (!ok) { setSavingDraft(false); return }
    router.push('/funds-payment/my-payment')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allocationId || !record) return
    // 送出才跑費用檢查：付款明細每組總額必須 > 0（草稿不擋）
    const feeError = validateFeePositive(schema, fieldValues, {}, groupInstances)
    if (feeError) { setError(feeError); return }
    setSubmitting(true)
    setError(null)
    const ok = await createAndOptionallySubmit(true)
    if (!ok) { setSubmitting(false); return }
    router.push('/funds-payment/my-payment')
  }

  if (loading) return <p>載入中...</p>
  if (!record) return <p style={{ color: 'red' }}>找不到資金分配申請單</p>

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>建立付款憑單</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>資金分配申請單 #{record.id}</p>

      {remainingInfo && (
        <AllocationSummaryCard info={remainingInfo} remainingLabel="目前剩餘" submitPreview={grandTotal} />
      )}

      {/* 送出被擋（金額 0/超額等）改用中央彈窗：建立按鈕在長表單底部，頁頂紅字使用者看不到 */}
      <ErrorDialog message={error} title="無法建立付款憑單" onClose={() => setError(null)} />

      <form onSubmit={handleSubmit}>
        {schema.map(block => {
          if (block.showWhen && fieldValues[block.showWhen.fieldId] !== block.showWhen.value) return null
          const groupRows = getGroupRows(block)
          const preGroupRows = block.rows.filter(r => !groupRows.includes(r))
          const groupSummary = groupBlockSummary[block.id]
          // 版面比照唯讀詳細頁：無群組/可重複列＝橫式（標籤在左），有群組列（付款明細）＝直式
          const horizontal = !block.rows.some(r => r.repeatable || r.rowGroupStart)
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
                  <div key={row.id} style={detailRowGridStyle(row.cols, horizontal)}>
                    {row.slots.map((slot, idx) => {
                      if (slot && slot.showWhen && !slot.showWhen.values.includes(fieldValues[slot.showWhen.fieldId] ?? '')) {
                        return <div key={idx} />
                      }
                      if (!slot) return <div key={idx} />
                      const required = slot.required && slot.type !== 'readonly'
                      // 橫式（無群組區塊）用共用 DetailFieldLayout；直式（群組區塊）維持原本含總額提示的排版
                      if (horizontal) {
                        return (
                          <DetailFieldLayout key={idx} label={slot.label} required={required} horizontal hint={slot.hint}>
                            {renderField(slot, record)}
                          </DetailFieldLayout>
                        )
                      }
                      return (
                        <div key={idx}>
                          <label style={labelStyle}>
                            {slot.label}
                            {required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                            {computedTotalHints[slot.fieldId] && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, fontWeight: 400 }}>{computedTotalHints[slot.fieldId]}</span>}
                          </label>
                          <FieldHint hint={slot.hint} />
                          {renderField(slot, record)}
                        </div>
                      )
                    })}
                  </div>
                ))}
                {renderGroupInstances(block)}
              </div>
            </div>
          )
        })}

        {/* 申請單附件顯示在第一個附件欄位內（唯讀帶入），不再是底部的獨立區塊——
            讓「母單有什麼、我還缺什麼」在同一格看得完，且只有一個地方能傳檔 */}

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

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
