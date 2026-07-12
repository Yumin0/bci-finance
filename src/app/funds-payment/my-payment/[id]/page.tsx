'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsPayment, ApprovalRecord, FormBlock, FormSchemaRow, FormSlot, DropdownOption, FundAttachment, TaxRateOption } from '@/lib/types'
import { applyTaxFormula, computeBlockTax, formatTaxNumber } from '@/lib/taxUtils'
import { validateFeePositive } from '@/lib/feeValidation'
import { getTaxRateOptions } from '@/app/actions/tax-rates'
import { PAYMENT_STATUS } from '@/lib/constants'
import { submitMyPayment, updateDraftPayment } from '@/app/actions/payment'
import { getFormSchemas } from '@/app/actions/form-schema'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { DEFAULT_STATUS_LABEL_CONFIG, type StatusLabelConfig } from '@/lib/status-label-config'
import { getAttachmentsByAllocationId, getAttachmentsByPaymentId, saveAttachments, deleteAttachmentRecord } from '@/app/actions/attachments'
import FundsPaymentDetail from '@/app/funds-payment/_components/FundsPaymentDetail'
import StatusBadge from '@/app/_components/StatusBadge'
import AttachmentUpload, { AttachmentItem } from '@/app/_components/AttachmentUpload'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatDateTime } from '@/lib/dateUtils'

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const readonlyCls = 'bg-[var(--bg-page)] cursor-default'

// 從 allocation 複製過來的直接欄位，付款憑單階段不可修改
// 注意：name/note 在此表單被挪用為「摘要/用途說明」和「付款方式」，屬於可編輯的付款欄位，不列入
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

function getGroupRows(block: FormBlock): FormSchemaRow[] {
  const startIdx = block.rows.findIndex(r => r.rowGroupStart)
  if (startIdx === -1) return []
  return block.rows.slice(startIdx)
}

type RecordWithTemplate = FundsPayment & {
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
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

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<RecordWithTemplate | null>(null)
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([])
  const [schema, setSchema] = useState<FormBlock[]>([])
  const [labelConfig, setLabelConfig] = useState<StatusLabelConfig>(DEFAULT_STATUS_LABEL_CONFIG)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  // allocation extra_data fallback（舊資料未複製到 payment 的欄位）
  const [allocExtraData, setAllocExtraData] = useState<Record<string, string> | null>(null)

  // 草稿編輯用 state
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
  const [ownAttachments, setOwnAttachments] = useState<AttachmentItem[]>([])
  const [newPaymentAttachments, setNewPaymentAttachments] = useState<AttachmentItem[]>([])
  const [deletedPaymentAttachmentIds, setDeletedPaymentAttachmentIds] = useState<number[]>([])

  function setField(fieldId: string, value: string) {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }))
  }

  useEffect(() => {
    async function load() {
      const { id } = await params
      const numId = Number(id)

      const [[recordRes, histRes, config], schemas] = await Promise.all([
        Promise.all([
          supabase.from('funds_payment')
            .select(`*, approval_flow_templates(name, approval_flow_steps(step_name, step_number)), approval_records!funds_payment_id(step_name, decision)`)
            .eq('id', numId).single(),
          supabase.from('approval_records')
            .select('*').eq('funds_payment_id', numId).order('step_number'),
          getStatusLabelConfig(),
        ]),
        getFormSchemas(),
      ])

      const { data, error: fetchError } = recordRes
      if (fetchError || !data) { setNotFound(true); setLoading(false); return }

      const rec = data as RecordWithTemplate
      setRecord(rec)
      setApprovalHistory((histRes.data as ApprovalRecord[]) ?? [])
      setLabelConfig(config)
      const paymentSchema = schemas.payment_voucher
      setSchema(paymentSchema)

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

      if (rec.status === PAYMENT_STATUS.DRAFT) {
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
        for (const slot of allSlots) {
          if (!isReadonlySlot(slot) && slot.dataSource?.startsWith('payee_records:')) {
            payeeCatIds.add(Number(slot.dataSource.replace('payee_records:', '')))
          }
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
        for (const slot of allSlots) {
          if (groupSlotIds.has(slot.fieldId)) continue
          if (isReadonlySlot(slot) || slot.fieldId === 'payment_method') continue
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
      }

      // 載入附件
      if (rec.funds_allocation_id) {
        getAttachmentsByAllocationId(rec.funds_allocation_id).then(setInheritedAttachments)
      }
      getAttachmentsByPaymentId(numId).then(items => {
        setOwnAttachments(items.map(a => ({ id: a.id, fileName: a.file_name, storagePath: a.storage_path, fileType: a.file_type, url: a.url ?? '', slotLabel: a.slot_label })))
      })

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

  function renderDraftField(slot: NonNullable<FormSlot>) {
    const { fieldId, type, dataSource, staticOptions } = slot

    // 從 allocation 繼承的欄位：永遠唯讀
    if (type === 'readonly' || ALLOCATION_READONLY_FIELDS.has(fieldId) || ALLOCATION_READONLY_LABELS.has(slot.label)) {
      // radio 型別保留視覺，用 disabled 呈現選取狀態
      if (type === 'radio') {
        const currentVal = getRecordFieldValue(slot, record!, allocExtraData)
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
      return <Input value={getRecordFieldValue(slot, record!, allocExtraData)} readOnly className={readonlyCls} />
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
                    if (totalFieldId && slot.fieldId === totalFieldId && slot.type === 'number') {
                      return (
                        <div key={slotIdx}>
                          <label style={labelStyle}>{slot.label}</label>
                          <Input value={String(computedTotal)} readOnly className={readonlyCls} />
                        </div>
                      )
                    }
                    return (
                      <div key={slotIdx}>
                        <label style={labelStyle}>{slot.label}</label>
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
      if (slot.type === 'readonly' || ALLOCATION_READONLY_FIELDS.has(slot.fieldId) || ALLOCATION_READONLY_LABELS.has(slot.label) || slot.fieldId === 'payment_method') continue
      // 類型存入 funds_payment.category 結構化欄位，不重複存進動態欄位資料
      if (isCategorySlot(slot)) continue
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

  // 目前表單裡類型欄位的選擇值（schema 沒有類型欄位時回傳 undefined，不更新該欄位）
  function getCategoryValue(): string | undefined {
    const categorySlot = schema
      .flatMap(b => b.rows.flatMap(r => r.slots))
      .find((s): s is NonNullable<FormSlot> => s !== null && isCategorySlot(s))
    if (!categorySlot) return undefined
    return fieldValues[categorySlot.fieldId] || '一般'
  }

  async function handleSave() {
    if (!record) return
    setSaving(true)
    setError(null)
    const { error: saveError } = await updateDraftPayment(record.id, fieldValues['payment_method'] ?? '', buildExtraData(), getCategoryValue())
    if (saveError) { setError(saveError); setSaving(false); return }
    await persistPaymentAttachments(record.id)
    setSaving(false)
  }

  async function handleSubmit() {
    if (!record) return
    // 付款憑單表單沒有可重複列，repeatableValues 傳空物件
    const feeError = validateFeePositive(schema, fieldValues, {}, groupInstances)
    if (feeError) { setError(feeError); return }
    setSubmitting(true)
    setError(null)
    const { error: saveError } = await updateDraftPayment(record.id, fieldValues['payment_method'] ?? '', buildExtraData(), getCategoryValue())
    if (saveError) { setError(saveError); setSubmitting(false); return }
    await persistPaymentAttachments(record.id)
    const { error: submitError } = await submitMyPayment(record.id)
    if (submitError) { setError(submitError); setSubmitting(false); return }
    router.push('/funds-payment/my-payment')
  }

  if (loading) return <p>載入中...</p>
  if (notFound) return (
    <div>
      <p style={{ color: '#dc2626' }}>找不到此付款憑單，或你沒有權限檢視。</p>
      <Link href="/funds-payment/my-payment" style={{ fontSize: 14, color: '#2563eb' }}>返回列表</Link>
    </div>
  )

  const isDraft = record!.status === PAYMENT_STATUS.DRAFT

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

  return (
    <div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Link href="/funds-payment/my-payment" className={buttonVariants({ variant: 'outline' })}>← 返回列表</Link>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>付款憑單</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          <span>狀態：</span>
          <StatusBadge module="payment_voucher" status={record!.status} stepName={getStepName()} labelConfig={labelConfig} />
          <span>　資金分配申請單 #</span>
          <Link href={`/funds-allocation/my-funds/edit/${record!.funds_allocation_id}`} style={{ color: '#2563eb' }}>
            {record!.funds_allocation_id}
          </Link>
        </div>

        {/* 草稿：內嵌可編輯表單 */}
        {isDraft ? (
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
                          if (slot?.showWhen && !slot.showWhen.values.includes(fieldValues[slot.showWhen.fieldId] ?? '')) {
                            return <div key={idx} />
                          }
                          return slot ? (
                            <div key={idx}>
                              <label style={labelStyle}>
                                {slot.label}
                                {computedTotalHints[slot.fieldId] && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, fontWeight: 400 }}>{computedTotalHints[slot.fieldId]}</span>}
                              </label>
                              {renderDraftField(slot)}
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
        ) : (
          <FundsPaymentDetail record={record!} schema={schema} />
        )}

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 16 }}>錯誤：{error}</p>}

        {isDraft && (
          <div style={{ marginTop: 32, display: 'flex', gap: 8 }}>
            <Button variant="outline" onClick={handleSave} disabled={saving || submitting}>
              {saving ? '儲存中...' : '儲存草稿'}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || saving}>
              {submitting ? '送出中...' : '確定送出'}
            </Button>
          </div>
        )}

        {/* 附件區塊 */}
        {(inheritedAttachments.length > 0 || ownAttachments.length > 0 || newPaymentAttachments.length > 0 || isDraft) && (
          <div style={{ marginTop: 16, border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)' }}>
            <div style={{ padding: '10px 20px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>附件</span>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {inheritedAttachments.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>來自申請單的附件</p>
                  <AttachmentUpload
                    slotLabel="inherited"
                    attachments={inheritedAttachments.map(a => ({ id: a.id, fileName: a.file_name, storagePath: a.storage_path, fileType: a.file_type, url: a.url ?? '', slotLabel: a.slot_label }))}
                    onAdd={() => {}} onRemove={() => {}} readOnly
                  />
                </div>
              )}
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>本憑單附件</p>
                <AttachmentUpload
                  slotLabel="payment"
                  attachments={[
                    ...ownAttachments.filter(a => !deletedPaymentAttachmentIds.includes(a.id ?? -1)),
                    ...newPaymentAttachments,
                  ]}
                  readOnly={!isDraft}
                  onAdd={item => setNewPaymentAttachments(prev => [...prev, item])}
                  onRemove={item => {
                    if (item.id) setDeletedPaymentAttachmentIds(prev => [...prev, item.id!])
                    else setNewPaymentAttachments(prev => prev.filter(a => a.storagePath !== item.storagePath))
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {record!.status === PAYMENT_STATUS.PAID && record!.category === '預支' && (
          <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border-color)' }}>
            <Link href={`/funds-voucher/my-voucher/add/${record!.id}`} className={buttonVariants({ variant: 'default' })}>
              建立暫付款沖銷憑單
            </Link>
          </div>
        )}
      </div>

      {/* 審核歷程 */}
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
