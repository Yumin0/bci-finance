'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsAllocation, FormBlock, FormSchemaRow, FormSlot, DropdownOption, TaxRateOption, FundAttachment } from '@/lib/types'
import { applyTaxFormula, computeBlockTax, formatTaxNumber } from '@/lib/taxUtils'
import { getTaxRateOptions } from '@/app/actions/tax-rates'
import { createPayment } from '@/app/actions/payment'
import { getFormSchemas } from '@/app/actions/form-schema'
import { getAttachmentsByAllocationId, saveAttachments } from '@/app/actions/attachments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import AttachmentUpload, { AttachmentItem } from '@/app/_components/AttachmentUpload'


// fieldId-based: known default fieldIds that are direct allocation columns → always readonly
const ALLOCATION_READONLY_FIELD_IDS = new Set([
  'purchase_order_number', 'date',
  'apply_division', 'apply_section', 'applicant', 'apply_role',
  'institution', 'payment_account', 'expense_item',
  'amount', 'category',
])

// Label-based fallback: catches fields whose Supabase fieldId differs from the default
// (e.g. 職稱/類型 in a customised schema). Also covers extra_data-only fields.
const ALLOCATION_READONLY_LABEL_MAP: Record<string, (r: FundsAllocation) => string> = {
  '採購單號':     r => r.serial_number ? `${r.serial_number}001` : '',
  '申請日期':     r => r.date ?? '',
  '日期':         r => r.date ?? '',
  '申請處別':     r => r.apply_division ?? '',
  '申請課別':     r => r.apply_section ?? '',
  '申請人':       r => r.applicant ?? '',
  '職稱':         r => r.apply_role ?? '',
  '類型':         r => r.category ?? '',
  '是否為國外費用？': r => r.extra_data?.['是否為國外費用？'] ?? '',
  '機構':         r => r.institution ?? '',
  '出款帳戶':     r => r.payment_account ?? '',
  '費用項目':     r => r.expense_item ?? '',
  '金額':         r => r.amount != null ? String(r.amount) : '',
}

// Fields to pre-fill as initial value but keep editable (by fieldId or by label)
// 注意：'note' 不可加入 — 表單設定中「付款方式」select 掛的是 note fieldId，
// 預填會把申請單備註帶進付款方式下拉（應保持空白讓使用者自選）
const ALLOCATION_PREFILL_FIELD_IDS = new Set(['name'])

function getGroupRows(block: FormBlock): FormSchemaRow[] {
  const startIdx = block.rows.findIndex(r => r.rowGroupStart)
  if (startIdx === -1) return []
  return block.rows.slice(startIdx)
}

function getAllocFieldValue(fieldId: string, record: FundsAllocation): string {
  const map: Record<string, unknown> = {
    purchase_order_number: record.serial_number ? `${record.serial_number}001` : '',
    date: record.date,
    apply_division: record.apply_division,
    apply_section: record.apply_section,
    applicant: record.applicant,
    apply_role: record.apply_role,
    institution: record.institution,
    payment_account: record.payment_account,
    expense_item: record.expense_item,
    category: record.category,
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
  const [error, setError] = useState<string | null>(null)

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [allocationAttachments, setAllocationAttachments] = useState<FundAttachment[]>([])
  const [pendingAttachments, setPendingAttachments] = useState<Record<string, AttachmentItem[]>>({})
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, DropdownOption[]>>({})
  const [dynamicSelectOptions, setDynamicSelectOptions] = useState<Record<string, { value: string; label: string }[]>>({})
  const [payeeFullRecords, setPayeeFullRecords] = useState<Record<string, Array<{ label: string; searchKey: string; fieldValuesByLabel: Record<string, string> }>>>({})
  const [payeeSearch, setPayeeSearch] = useState<Record<string, string>>({})
  const [openPayeeId, setOpenPayeeId] = useState<string | null>(null)
  const [payeeAutoFillLabels, setPayeeAutoFillLabels] = useState<Set<string>>(new Set())
  const [taxRateOptions, setTaxRateOptions] = useState<TaxRateOption[]>([])
  // 群組重複資料（key = blockId）：由申請單的 __group_ 資料帶入，可增刪修改
  const [groupInstances, setGroupInstances] = useState<Record<string, Record<string, string>[]>>({})

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

      const [{ data, error: fetchError }, schemas] = await Promise.all([
        supabase.from('funds_allocation').select('*').eq('id', numId).single(),
        getFormSchemas(),
      ])
      if (fetchError) { setError(fetchError.message); setLoading(false); return }
      setRecord(data as FundsAllocation)

      const paymentSchema = schemas.payment_voucher
      setSchema(paymentSchema)

      const rec = data as FundsAllocation
      const schemaGroupSlotIds = new Set(
        paymentSchema.flatMap(b => getGroupRows(b).flatMap(r => r.slots.filter(Boolean).map(s => s!.fieldId)))
      )
      const initValues: Record<string, string> = {}
      paymentSchema.flatMap(b => b.rows.flatMap(r => r.slots)).forEach(slot => {
        if (!slot) return
        // Group slots are pre-filled per-instance from the allocation's __group_ data below
        if (schemaGroupSlotIds.has(slot.fieldId)) return
        // Skip readonly fields (they read directly from rec, not from fieldValues)
        if (ALLOCATION_READONLY_FIELD_IDS.has(slot.fieldId)) return
        if (slot.label in ALLOCATION_READONLY_LABEL_MAP) return
        // Pre-fill known editable fields by fieldId
        if (ALLOCATION_PREFILL_FIELD_IDS.has(slot.fieldId)) {
          const val = getAllocFieldValue(slot.fieldId, rec)
          if (val) initValues[slot.fieldId] = val
          return
        }
        // Pre-fill other editable fields from allocation.extra_data by label (e.g. 幣別, 會計科目)
        const extraVal = rec.extra_data?.[slot.label]
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
      for (const block of paymentSchema) {
        const groupSlots = getGroupRows(block).flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
        if (!groupSlots.length) continue
        const allocInstances = allocGroupArrays[groupArrayIdx++]
        if (allocInstances) {
          initGroups[block.id] = allocInstances.map(inst => {
            const mapped: Record<string, string> = {}
            for (const slot of groupSlots) {
              const v = inst[slot.label]
              if (v != null && v !== '') mapped[slot.fieldId] = v
            }
            return mapped
          })
        } else {
          // 舊資料（無群組格式）：以一般標籤值帶入單一組
          const single: Record<string, string> = {}
          for (const slot of groupSlots) {
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
        if (src.startsWith('fee_records:') || src.startsWith('payee_records:')) {
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
  // 群組區塊的彙總顯示（key = blockId）：加總所有組（與申請單表單一致）
  const groupBlockSummary: Record<string, { taxBase: number; handling: number; taxAmount: number; total: number }> = {}
  for (const block of schema) {
    const groupRows = getGroupRows(block)
    if (groupRows.length > 0) {
      const groupSlots = groupRows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
      const taxSelectSlot = groupSlots.find(s => s.dataSource === 'tax_rates' && s.taxConfig)
      const baseFieldId = taxSelectSlot?.taxConfig?.baseFieldId ?? ''
      const taxAmtFieldId = taxSelectSlot?.taxConfig?.taxAmountFieldId
      const totalFieldId = taxSelectSlot?.taxConfig?.totalFieldId
      const handlingSlots = groupSlots.filter(s =>
        s.type === 'number' &&
        s.fieldId !== baseFieldId &&
        (!taxAmtFieldId || s.fieldId !== taxAmtFieldId) &&
        (!totalFieldId || s.fieldId !== totalFieldId)
      )
      const instances = groupInstances[block.id] ?? [{}]
      let totalBase = 0, totalHandling = 0, totalTax = 0
      for (const inst of instances) {
        totalBase += parseFloat(inst[baseFieldId] ?? '0') || 0
        totalHandling += handlingSlots.reduce((acc, s) => acc + (parseFloat(inst[s.fieldId] ?? '0') || 0), 0)
        totalTax += taxAmtFieldId ? (parseFloat(inst[taxAmtFieldId] ?? '0') || 0) : 0
      }
      groupBlockSummary[block.id] = { taxBase: totalBase, handling: totalHandling, taxAmount: totalTax, total: totalBase + totalHandling + totalTax }
      continue
    }
    const info = computeBlockTax(block, fieldValues, taxRateOptions)
    if (info) blockTaxMap[block.id] = info
  }
  const computedTotals: Record<string, string> = {}
  const computedTotalHints: Record<string, string> = {}
  for (const [blockId, info] of Object.entries(blockTaxMap)) {
    if (!info) continue
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

  function renderField(slot: NonNullable<FormSlot>, rec: FundsAllocation) {
    const { fieldId, type, dataSource, staticOptions, required } = slot

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

    return (
      <div>
        {instances.map((instValues, instIdx) => {
          const setInstField = (fid: string, val: string) => setInstFieldWithAutoTax(instIdx, fid, val)

          const totalFieldId = taxSelectSlot?.taxConfig?.totalFieldId
          const taxAmountFieldId = taxSelectSlot?.taxConfig?.taxAmountFieldId
          const storedTax = taxAmountFieldId ? (parseFloat(instValues[taxAmountFieldId] ?? '0') || 0) : 0
          const otherNums = taxSelectSlot?.taxConfig
            ? groupSlots.filter(s => s.type === 'number' && s.fieldId !== totalFieldId && s.fieldId !== taxAmountFieldId)
            : []
          const computedTotal = otherNums.reduce((sum, s) => sum + (parseFloat(instValues[s.fieldId] ?? '0') || 0), 0) + storedTax

          return (
            <div key={instIdx} style={{
              position: 'relative',
              paddingBottom: 16,
              marginBottom: instances.length > 1 && instIdx < instances.length - 1 ? 16 : 0,
              borderBottom: instances.length > 1 && instIdx < instances.length - 1 ? '1px dashed var(--border-color)' : undefined,
            }}>
              {groupRows.map(row => (
                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: `repeat(${row.cols}, 1fr)`, gap: 20, marginBottom: 20 }}>
                  {row.slots.map((slot, slotIdx) => {
                    if (!slot) return <div key={slotIdx} />
                    // 合計唯讀（稅額 + 其他數字加總）
                    if (totalFieldId && slot.fieldId === totalFieldId && slot.type === 'number') {
                      return (
                        <div key={slotIdx}>
                          <label style={labelStyle}>{slot.label}</label>
                          <Input value={String(computedTotal)} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
                        </div>
                      )
                    }
                    return (
                      <div key={slotIdx}>
                        <label style={labelStyle}>
                          {slot.label}
                          {slot.required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                        </label>
                        {renderGroupField(slot, instValues, setInstField)}
                      </div>
                    )
                  })}
                </div>
              ))}
              {instances.length > 1 && (
                <button type="button" onClick={() => removeGroupInstance(block.id, instIdx)}
                  style={{ position: 'absolute', right: -76, top: 0, width: 56, padding: '4px 8px', fontSize: 12,
                    border: '1px solid #fca5a5', borderRadius: 6, background: 'var(--bg-card)', color: '#dc2626', cursor: 'pointer' }}>
                  刪除
                </button>
              )}
            </div>
          )
        })}
        <button type="button" onClick={() => addGroupInstance(block.id)}
          style={{ padding: '6px 14px', fontSize: 13, border: '1.5px dashed #d1d5db',
            borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: 4 }}>
          ＋ 新增項目
        </button>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allocationId || !record) return
    setSubmitting(true)
    setError(null)

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
      if (slot.fieldId === 'payment_method') continue
      extraData[slot.label] = computedTotals[slot.fieldId] ?? fieldValues[slot.fieldId] ?? ''
    }
    // 群組重複資料：以 label 為 key 存成 JSON（與申請單格式一致）
    for (const block of schema) {
      const groupRows = getGroupRows(block)
      if (groupRows.length === 0) continue
      const groupSlots = groupRows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
      const instances = groupInstances[block.id] ?? [{}]
      const taxSelectSlot = groupSlots.find(s => s.dataSource === 'tax_rates' && s.taxConfig)
      const totalFieldId = taxSelectSlot?.taxConfig?.totalFieldId
      const taxAmtFieldId = taxSelectSlot?.taxConfig?.taxAmountFieldId
      const otherNums = taxSelectSlot?.taxConfig
        ? groupSlots.filter(s => s.type === 'number' && s.fieldId !== totalFieldId && s.fieldId !== taxAmtFieldId)
        : []
      const labeled = instances.map(inst => {
        const storedTax = taxAmtFieldId ? (parseFloat(inst[taxAmtFieldId] ?? '0') || 0) : 0
        const numsSum = otherNums.reduce((sum, s) => sum + (parseFloat(inst[s.fieldId] ?? '0') || 0), 0)
        const total = numsSum + storedTax
        const obj: Record<string, string> = {}
        for (const slot of groupSlots) {
          if (totalFieldId && slot.fieldId === totalFieldId && slot.type === 'number') {
            obj[slot.label] = String(total)
          } else {
            obj[slot.label] = inst[slot.fieldId] ?? ''
          }
        }
        return obj
      })
      extraData[`__group_${block.id}`] = JSON.stringify(labeled)
    }

    const { id: newPaymentId, error: insertError } = await createPayment(
      allocationId,
      fieldValues['payment_method'] ?? '',
      extraData,
    )
    if (insertError) { setError(insertError); setSubmitting(false); return }

    const allAttachments = Object.values(pendingAttachments).flat()
    if (newPaymentId && allAttachments.length > 0) {
      await saveAttachments(null, newPaymentId, allAttachments)
    }

    router.push('/funds-payment/my-payment')
  }

  if (loading) return <p>載入中...</p>
  if (!record) return <p style={{ color: 'red' }}>找不到資金分配申請單</p>

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>建立付款憑單</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>資金分配申請單 #{record.id}</p>

      {error && <p style={errorStyle}>錯誤：{error}</p>}

      <form onSubmit={handleSubmit}>
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
                      <span style={{ color: 'var(--text-muted)' }}>費用 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(groupSummary.taxBase)}</strong></span>
                      <span style={{ color: 'var(--text-muted)' }}>手續費 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(groupSummary.handling)}</strong></span>
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
                      if (slot && slot.showWhen && !slot.showWhen.values.includes(fieldValues[slot.showWhen.fieldId] ?? '')) {
                        return <div key={idx} />
                      }
                      return slot ? (
                        <div key={idx}>
                          <label style={labelStyle}>
                            {slot.label}
                            {slot.required && slot.type !== 'readonly' && (
                              <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>
                            )}
                            {computedTotalHints[slot.fieldId] && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, fontWeight: 400 }}>{computedTotalHints[slot.fieldId]}</span>}
                          </label>
                          {renderField(slot, record)}
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

        {allocationAttachments.length > 0 && (
          <div style={{ marginBottom: 16, border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)' }}>
            <div style={{ padding: '10px 20px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>附件</span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>來自資金分配申請單的附件</p>
              <AttachmentUpload
                slotLabel="inherited"
                attachments={allocationAttachments.map(a => ({ id: a.id, fileName: a.file_name, storagePath: a.storage_path, fileType: a.file_type, url: a.url ?? '', slotLabel: a.slot_label }))}
                onAdd={() => {}} onRemove={() => {}} readOnly
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? '建立中...' : '建立付款憑單'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
        </div>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginBottom: 8 }
