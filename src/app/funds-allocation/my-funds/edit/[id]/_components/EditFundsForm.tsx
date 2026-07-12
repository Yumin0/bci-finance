'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { FUNDS_STATUS, MOCK_USER_ID } from '@/lib/constants'
import { FundsAllocation, DropdownOption, OrgUnit, FormBlock, FormSchemaRow, FormSlot, TaxRateOption, ApprovalRecord } from '@/lib/types'
import { computeBlockTax, formatTaxNumber, applyTaxFormula } from '@/lib/taxUtils'
import { allDivisionOptions, allSectionOptions } from '@/lib/orgPositions'
import { validateFeePositive } from '@/lib/feeValidation'
import { getTaxRateOptions } from '@/app/actions/tax-rates'
import { type StatusLabelConfig } from '@/lib/status-label-config'
import { formatDateTime } from '@/lib/dateUtils'
import StatusBadge from '@/app/_components/StatusBadge'

export type ApprovalStepDef = { id: number; step_number: number; step_name: string }
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import AttachmentUpload, { AttachmentItem } from '@/app/_components/AttachmentUpload'
import { getAttachmentsByAllocationId, saveAttachments, deleteAttachmentRecord } from '@/app/actions/attachments'
import { deleteFundsAllocation, updateFundsAllocation } from '@/app/actions/funds-allocation'
import { saveUserFundTemplate } from '@/app/actions/fund-templates'
import { logFieldChanges } from '@/app/actions/edit-logs'
import ChangeLogModal from '@/app/funds-allocation/_components/ChangeLogModal'
import { feeItemCode } from '@/lib/feeItems'


function unitLabel(u: OrgUnit) {
  return [u.code, u.name].filter(Boolean).join(' ')
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function EditFundsForm({
  record,
  schema,
  applicantName,
  userId,
  labelConfig,
  isCurrentReviewer = false,
  fromReview = false,
  hideApprovalPanel = false,
  approvalSteps = [],
  approvalRecords = [],
  reviewerNames = {},
  onSaveSuccess,
}: {
  record: FundsAllocation
  schema: FormBlock[]
  applicantName: string
  userId: number | null
  labelConfig: StatusLabelConfig
  isCurrentReviewer?: boolean
  fromReview?: boolean
  hideApprovalPanel?: boolean
  approvalSteps?: ApprovalStepDef[]
  approvalRecords?: ApprovalRecord[]
  reviewerNames?: Record<string, string>
  onSaveSuccess?: () => void
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [changeLogOpen, setChangeLogOpen] = useState(false)

  // 另存為我的範本（任何狀態的申請單皆可，僅申請人本人）
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateSaved, setTemplateSaved] = useState(false)

  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [memberRoleMap, setMemberRoleMap] = useState<Record<number, string[]>>({})
  // 有「已綁定帳號負責人」的組織節點 id 集合；null = 尚未載入完成（載入前不顯示提醒）
  const [leaderUnitIds, setLeaderUnitIds] = useState<Set<number> | null>(null)
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, DropdownOption[]>>({})
  const [dynamicSelectOptions, setDynamicSelectOptions] = useState<Record<string, { value: string; label: string }[]>>({})

  const [divisionId, setDivisionId] = useState<number | null>(null)
  const [sectionId, setSectionId] = useState<number | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})

  // 附件
  const [existingAttachments, setExistingAttachments] = useState<AttachmentItem[]>([])
  const [newAttachments, setNewAttachments] = useState<AttachmentItem[]>([])
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([])

  // 草稿送出時需要的審核流程資訊
  const [flowTemplateId, setFlowTemplateId] = useState<number | null>(record.flow_template_id ?? null)
  const [flowTemplateName, setFlowTemplateName] = useState<string | null>(null)

  const isDraft = record.status === FUNDS_STATUS.DRAFT
  const canEdit = isDraft || isCurrentReviewer || (record.status === FUNDS_STATUS.PENDING && record.current_step === 1)
  const isApplicant = userId != null && String(record.created_by) === String(userId)

  const allSlots: NonNullable<FormSlot>[] = schema.flatMap(b =>
    b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null))
  )
  const allRows = schema.flatMap(b => b.rows)
  const repeatableSlotFieldIds = new Set(
    allRows.filter(r => r.repeatable).flatMap(r => r.slots.filter(Boolean).map(s => s!.fieldId))
  )

  function getGroupRows(block: FormBlock): FormSchemaRow[] {
    const startIdx = block.rows.findIndex(r => r.rowGroupStart)
    if (startIdx === -1) return []
    return block.rows.slice(startIdx)
  }
  const groupSlotFieldIds = new Set(
    schema.flatMap(b => getGroupRows(b).flatMap(r => r.slots.filter(Boolean).map(s => s!.fieldId)))
  )

  // 費用項目主要/細項連動：主要 = 群組列/可重複列以外、label 含「費用項目」的第一個費用項目欄位；
  // 細項 = 主要以外所有 label 含「費用項目」的費用項目欄位（label 不符約定時不連動，維持顯示全部選項）
  const mainFeeSlot = allSlots.find(s =>
    s.dataSource?.startsWith('fee_records:') && s.label.includes('費用項目') &&
    !groupSlotFieldIds.has(s.fieldId) && !repeatableSlotFieldIds.has(s.fieldId)
  ) ?? null
  const detailFeeFieldIds = mainFeeSlot
    ? allSlots
        .filter(s => s.dataSource?.startsWith('fee_records:') && s.label.includes('費用項目') && s.fieldId !== mainFeeSlot.fieldId)
        .map(s => s.fieldId)
    : []
  const mainFeeValue = mainFeeSlot ? (fieldValues[mainFeeSlot.fieldId] ?? '') : ''
  // 主要的值不在選項清單中（舊資料異常）時不過濾，避免細項完全選不到東西
  const mainFeeValueIsKnown = !!mainFeeSlot && !!mainFeeValue &&
    (dynamicSelectOptions[mainFeeSlot.dataSource] ?? []).some(o => o.value === mainFeeValue)

  const neededSources = new Set(allSlots.map(s => s.dataSource))

  const [repeatableValues, setRepeatableValues] = useState<Record<string, Record<string, string>[]>>({})
  const [groupInstances, setGroupInstances] = useState<Record<string, Record<string, string>[]>>({})
  const [taxRateOptions, setTaxRateOptions] = useState<TaxRateOption[]>([])

  function setField(id: string, val: string) {
    setFieldValues(prev => ({ ...prev, [id]: val }))
  }

  function getRepeatableInstances(rowId: string) {
    return repeatableValues[rowId] ?? [{}]
  }
  function setRepeatableField(rowId: string, idx: number, fieldId: string, val: string) {
    setRepeatableValues(prev => {
      const instances = [...(prev[rowId] ?? [{}])]
      instances[idx] = { ...instances[idx], [fieldId]: val }
      return { ...prev, [rowId]: instances }
    })
  }
  function addRepeatableInstance(rowId: string) {
    setRepeatableValues(prev => ({ ...prev, [rowId]: [...(prev[rowId] ?? [{}]), {}] }))
  }
  function removeRepeatableInstance(rowId: string, idx: number) {
    setRepeatableValues(prev => {
      const instances = (prev[rowId] ?? [{}]).filter((_, i) => i !== idx)
      return { ...prev, [rowId]: instances.length ? instances : [{}] }
    })
  }

  function setGroupField(blockId: string, instIdx: number, fieldId: string, val: string) {
    setGroupInstances(prev => {
      const instances = [...(prev[blockId] ?? [{}])]
      instances[instIdx] = { ...instances[instIdx], [fieldId]: val }
      return { ...prev, [blockId]: instances }
    })
  }
  // 改選費用項目（主要）時，清空編號對不上的費用項目（細項）已選值（固定欄位與群組明細都清）
  function clearMismatchedDetailFees(newMainVal: string) {
    if (!detailFeeFieldIds.length) return
    const code = feeItemCode(newMainVal)
    const mismatch = (v: string | undefined) => !!v && (!code || feeItemCode(v) !== code)
    setFieldValues(prev => {
      const next = { ...prev }
      for (const fid of detailFeeFieldIds) {
        if (mismatch(next[fid])) next[fid] = ''
      }
      return next
    })
    setGroupInstances(prev => {
      const next: Record<string, Record<string, string>[]> = {}
      for (const [blockId, instances] of Object.entries(prev)) {
        next[blockId] = instances.map(inst => {
          const cleared = { ...inst }
          for (const fid of detailFeeFieldIds) {
            if (mismatch(cleared[fid])) cleared[fid] = ''
          }
          return cleared
        })
      }
      return next
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
  function computeGroupInstanceTax(groupSlots: NonNullable<FormSlot>[], instValues: Record<string, string>) {
    const taxSelectSlot = groupSlots.find(s => s.dataSource === 'tax_rates' && s.taxConfig)
    if (!taxSelectSlot?.taxConfig) return null
    const { baseFieldId, totalFieldId, taxAmountFieldId } = taxSelectSlot.taxConfig
    const fee = parseFloat(instValues[baseFieldId] ?? '0') || 0
    const label = instValues[taxSelectSlot.fieldId] ?? ''
    const opt = taxRateOptions.find(o => o.label === label)
    const tax = opt ? Math.floor(applyTaxFormula(fee, opt.formula_steps)) : 0
    const otherNums = groupSlots.filter(s =>
      s.type === 'number' && s.fieldId !== totalFieldId && (!taxAmountFieldId || s.fieldId !== taxAmountFieldId)
    )
    const numsSum = otherNums.reduce((sum, s) => sum + (parseFloat(instValues[s.fieldId] ?? '0') || 0), 0)
    return { taxAmountFieldId, totalFieldId, tax, total: numsSum + tax, fee }
  }

  // 草稿狀態下，出款帳號改變時自動帶入審核流程
  useEffect(() => {
    if (!isDraft) return
    const label = fieldValues.payment_account
    if (!label) { setFlowTemplateId(null); setFlowTemplateName(null); return }
    const option = dropdownOptions['payment_account']?.find(o => o.label === label)
    if (!option) { setFlowTemplateId(null); setFlowTemplateName(null); return }
    supabase
      .from('template_payment_accounts')
      .select('template_id, approval_flow_templates!inner(id, name, is_active, form_type)')
      .eq('payment_account_option_id', option.id)
      .eq('approval_flow_templates.form_type', 'funds_allocation')
      .eq('approval_flow_templates.is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const t = data as { template_id: number; approval_flow_templates: Array<{ id: number; name: string }> }
          const tmpl = Array.isArray(t.approval_flow_templates) ? t.approval_flow_templates[0] : t.approval_flow_templates
          setFlowTemplateId(t.template_id)
          setFlowTemplateName((tmpl as { name: string } | undefined)?.name ?? null)
        } else {
          setFlowTemplateId(null); setFlowTemplateName(null)
        }
      })
  }, [fieldValues.payment_account, dropdownOptions, isDraft])

  useEffect(() => {
    async function load() {
      const fetches: Promise<void>[] = []

      const loadOrgUnits = async () => {
        const r = await supabase.from('org_units').select('*').order('sort_order')
        if (r.data) {
          const units = r.data as OrgUnit[]
          setOrgUnits(units)
          if (record.apply_division_id) {
            setDivisionId(record.apply_division_id)
            if (record.apply_section_id) setSectionId(record.apply_section_id)
          } else if (record.apply_division) {
            const divUnit = units.find(u => u.unit_type === 'division' && unitLabel(u) === record.apply_division)
            if (divUnit) {
              setDivisionId(divUnit.id)
              if (record.apply_section) {
                const secUnit = units.find(u => u.unit_type === 'section' && unitLabel(u) === record.apply_section)
                if (secUnit) setSectionId(secUnit.id)
              }
            }
          }
        }
      }
      const loadMyMemberships = async () => {
        if (!userId) return
        const r = await supabase
          .from('org_unit_members')
          .select('org_unit_id, role_types(name)')
          .eq('user_id', userId)
        if (r.data) {
          const rows = r.data as unknown as { org_unit_id: number; role_types: { name: string } | null }[]
          const roleMap: Record<number, string[]> = {}
          for (const m of rows) {
            const name = m.role_types?.name
            if (name) {
              if (!roleMap[m.org_unit_id]) roleMap[m.org_unit_id] = []
              roleMap[m.org_unit_id].push(name)
            }
          }
          setMemberRoleMap(roleMap)
        }
      }
      const loadUnitLeaders = async () => {
        const r = await supabase
          .from('org_unit_members')
          .select('org_unit_id')
          .not('user_id', 'is', null)
        if (r.data) {
          setLeaderUnitIds(new Set((r.data as { org_unit_id: number }[]).map(m => m.org_unit_id)))
        }
      }
      const loadDropdowns = async (fields: string[]) => {
        const r = await supabase.from('dropdown_options').select('*').in('field', fields).order('sort_order')
        if (r.data) {
          const grouped: Record<string, DropdownOption[]> = {}
          for (const opt of r.data as DropdownOption[]) {
            if (!grouped[opt.field]) grouped[opt.field] = []
            grouped[opt.field].push(opt)
          }
          setDropdownOptions(grouped)
        }
      }
      if (neededSources.has('org_units:division') || neededSources.has('org_units:section') || neededSources.has('org_unit_roles')) {
        fetches.push(loadOrgUnits(), loadMyMemberships(), loadUnitLeaders())
      }
      const dropdownFields: string[] = []
      if (neededSources.has('dropdown_options:institution')) dropdownFields.push('institution')
      if (neededSources.has('dropdown_options:payment_account')) dropdownFields.push('payment_account')
      if (dropdownFields.length) fetches.push(loadDropdowns(dropdownFields))
      if (neededSources.has('tax_rates')) {
        fetches.push(getTaxRateOptions().then(data => setTaxRateOptions(data)))
      }

      const loadDynamicOptions = async (sourceKey: string) => {
        const [table, idStr] = sourceKey.startsWith('fee_records:')
          ? ['fee_records', sourceKey.replace('fee_records:', '')] as const
          : ['payee_records', sourceKey.replace('payee_records:', '')] as const
        const fieldsTable = table === 'fee_records' ? 'fee_category_fields' : 'payee_category_fields'
        const categoryId = Number(idStr)
        const [fieldsRes, recordsRes] = await Promise.all([
          supabase.from(fieldsTable).select('id, sort_order').eq('category_id', categoryId).order('sort_order'),
          supabase.from(table).select('field_values').eq('category_id', categoryId).order('sort_order'),
        ])
        const fieldIds = (fieldsRes.data ?? []).map(f => String(f.id))
        const options = (recordsRes.data ?? []).map(r => {
          const vals = fieldIds.map(fId => (r.field_values as Record<string, string>)[fId]).filter(Boolean)
          const label = vals.join(' ')
          return { value: label, label }
        }).filter(o => o.label)
          .sort((a, b) => parseFloat(a.label) - parseFloat(b.label))
        setDynamicSelectOptions(prev => ({ ...prev, [sourceKey]: options }))
      }
      for (const src of neededSources) {
        if (src.startsWith('fee_records:') || src.startsWith('payee_records:')) {
          fetches.push(loadDynamicOptions(src))
        }
      }

      await Promise.all(fetches)

      const catalogMap: Record<string, string> = {
        serial_number:   record.serial_number ?? '',
        apply_role:      record.apply_role ?? '',
        institution:     record.institution ?? '',
        payment_account: record.payment_account ?? '',
        expense_item:    record.expense_item ?? '',
        name:            record.name ?? '',
        amount:          String(record.amount ?? ''),
        category:        record.category ?? '',
        note:            record.note ?? '',
        date:            record.date ?? today(),
      }
      const extraData = (record as FundsAllocation & { extra_data?: Record<string, string> }).extra_data ?? {}
      const customValues: Record<string, string> = {}
      for (const slot of allSlots) {
        if (slot.fieldId.startsWith('custom_') && !repeatableSlotFieldIds.has(slot.fieldId) && extraData[slot.label]) {
          customValues[slot.fieldId] = extraData[slot.label]
        }
      }
      setFieldValues({ ...catalogMap, ...customValues })

      const loadedRepeatable: Record<string, Record<string, string>[]> = {}
      for (const row of allRows.filter(r => r.repeatable)) {
        const raw = extraData[`__repeatable_${row.id}`]
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Record<string, string>[]
            const byFieldId = parsed.map(labeledObj => {
              const inst: Record<string, string> = {}
              for (const slot of row.slots) {
                if (slot) inst[slot.fieldId] = labeledObj[slot.label] ?? ''
              }
              return inst
            })
            loadedRepeatable[row.id] = byFieldId
          } catch { /* ignore */ }
        }
      }
      if (Object.keys(loadedRepeatable).length) setRepeatableValues(loadedRepeatable)

      // 載入群組重複資料
      const loadedGroups: Record<string, Record<string, string>[]> = {}
      for (const block of schema) {
        const groupRows = getGroupRows(block)
        if (groupRows.length === 0) continue
        const groupSlots = groupRows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
        const raw = extraData[`__group_${block.id}`]
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Record<string, string>[]
            loadedGroups[block.id] = parsed.map(obj => {
              const inst: Record<string, string> = {}
              for (const slot of groupSlots) { inst[slot.fieldId] = obj[slot.label] ?? '' }
              return inst
            })
          } catch { loadedGroups[block.id] = [{}] }
        } else {
          loadedGroups[block.id] = [{}]
        }
      }
      if (Object.keys(loadedGroups).length) setGroupInstances(loadedGroups)

      const attachments = await getAttachmentsByAllocationId(record.id)
      setExistingAttachments(attachments.map(a => ({
        id: a.id, fileName: a.file_name, storagePath: a.storage_path,
        fileType: a.file_type, url: a.url ?? '', slotLabel: a.slot_label,
      })))
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id])

  const unitMap = new Map(orgUnits.map(u => [u.id, u]))
  // 處別/課別開放全部選項，不限縮於使用者所屬組合；既有單子選的節點若不在清單中（如節點標記異動）仍補進選項避免顯示空白
  const divisions = allDivisionOptions(orgUnits)
  if (divisionId != null && !divisions.some(d => d.value === String(divisionId))) {
    const u = unitMap.get(divisionId)
    if (u) divisions.push({ value: String(u.id), label: unitLabel(u) })
  }
  const sections = allSectionOptions(orgUnits, divisionId)
  if (sectionId != null && !sections.some(s => s.value === String(sectionId))) {
    const u = unitMap.get(sectionId)
    if (u) sections.push({ value: String(u.id), label: unitLabel(u) })
  }
  const sectionRoles = sectionId ? (memberRoleMap[sectionId] ?? []) : []
  const divisionRoles = divisionId ? (memberRoleMap[divisionId] ?? []) : []
  const availableRoles = sectionRoles.length > 0
    ? [...new Set(sectionRoles)]
    : divisionRoles.length > 0
    ? [...new Set(divisionRoles)]
    : [...new Set(Object.values(memberRoleMap).flat())]

  const blockTaxMap: Record<string, ReturnType<typeof computeBlockTax>> = {}
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
    const aggregatedValues = { ...fieldValues }
    for (const row of block.rows) {
      if (row.repeatable) {
        const instances = repeatableValues[row.id] ?? [{}]
        for (const slot of row.slots.filter(Boolean) as NonNullable<FormSlot>[]) {
          const sum = instances.reduce((acc, inst) => acc + (parseFloat(inst[slot.fieldId] ?? '0') || 0), 0)
          aggregatedValues[slot.fieldId] = String(sum)
        }
      }
    }
    const info = computeBlockTax(block, aggregatedValues, taxRateOptions)
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

  const taxSelectorStr = JSON.stringify(
    allSlots
      .filter(s => s.dataSource === 'tax_rates' && s.taxConfig)
      .reduce((acc, s) => ({ ...acc, [s.fieldId]: fieldValues[s.fieldId] ?? '' }), {} as Record<string, string>)
  )
  // 費用欄位的目前值（用於 effect dep，讓先選稅額後打費用也能觸發計算）
  const taxFeeStr = JSON.stringify(
    allSlots
      .filter(s => s.dataSource === 'tax_rates' && s.taxConfig)
      .reduce((acc, s) => ({ ...acc, [s.taxConfig!.baseFieldId]: fieldValues[s.taxConfig!.baseFieldId] ?? '' }), {} as Record<string, string>)
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const taxSelectors = JSON.parse(taxSelectorStr) as Record<string, string>
    const fieldUpdates: Record<string, string> = {}
    const repeatableUpdates: Record<string, Record<string, string>[]> = {}

    for (const block of schema) {
      if (block.rows.some(r => r.rowGroupStart)) continue

      const allBlockSlots = block.rows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
      const taxSelectSlot = allBlockSlots.find(s => s.dataSource === 'tax_rates' && s.taxConfig)
      if (!taxSelectSlot?.taxConfig) continue

      const { baseFieldId, totalFieldId, taxAmountFieldId } = taxSelectSlot.taxConfig
      const selectedLabel = taxSelectors[taxSelectSlot.fieldId] ?? ''
      const selectedOption = taxRateOptions.find(o => o.label === selectedLabel)
      const feeRow = block.rows.find(r => r.repeatable && r.slots.some(s => s?.fieldId === baseFieldId))

      if (feeRow && taxAmountFieldId) {
        const instances = repeatableValues[feeRow.id] ?? [{}]
        const newInstances = instances.map(inst => {
          const fee = parseFloat(inst[baseFieldId] ?? '0') || 0
          const tax = selectedOption ? Math.floor(applyTaxFormula(fee, selectedOption.formula_steps)) : 0
          if (inst[taxAmountFieldId] === String(tax)) return inst
          return { ...inst, [taxAmountFieldId]: String(tax) }
        })
        if (newInstances.some((inst, i) => inst !== instances[i])) {
          repeatableUpdates[feeRow.id] = newInstances
        }
        const instancesToUse = repeatableUpdates[feeRow.id] ?? instances
        const rowNumberSlots = (feeRow.slots.filter(Boolean) as NonNullable<FormSlot>[]).filter(s => s.type === 'number')
        const total = instancesToUse.reduce((sum, inst) =>
          sum + rowNumberSlots.reduce((rowSum, s) => rowSum + (parseFloat(inst[s.fieldId] ?? '0') || 0), 0), 0)
        fieldUpdates[totalFieldId] = String(Math.floor(total))
      } else {
        const info = computeBlockTax(block, { ...fieldValues }, taxRateOptions)
        if (info) {
          fieldUpdates[info.totalFieldId] = String(Math.floor(info.total))
          if (info.taxAmountFieldId) fieldUpdates[info.taxAmountFieldId] = String(Math.floor(info.taxAmount))
        }
      }
    }

    if (Object.keys(repeatableUpdates).length > 0) {
      setRepeatableValues(prev => {
        const changed = Object.entries(repeatableUpdates).some(([k, v]) => prev[k] !== v)
        return changed ? { ...prev, ...repeatableUpdates } : prev
      })
    }
    if (Object.keys(fieldUpdates).length > 0) {
      setFieldValues(prev => {
        const changed = Object.entries(fieldUpdates).some(([k, v]) => prev[k] !== v)
        return changed ? { ...prev, ...fieldUpdates } : prev
      })
    }
  }, [repeatableValues, taxSelectorStr, taxFeeStr, taxRateOptions])

  // 所選處/課沒有已綁定帳號的負責人時的提醒文字（審核步驟可能找不到審核人）
  function renderNoLeaderHint(unitId: number | null, kindLabel: string) {
    if (unitId == null || leaderUnitIds === null || leaderUnitIds.has(unitId)) return null
    return (
      <p className="mt-1.5 text-xs text-amber-600">
        此{kindLabel}尚未設定負責人，送出後的審核步驟可能無人可簽核，請先聯絡管理員於組織架構中設定負責人
      </p>
    )
  }

  function renderFieldFor(
    slot: NonNullable<FormSlot>,
    values: Record<string, string>,
    onChange: (fieldId: string, val: string) => void,
    isRepeatable = false,
  ) {
    const { fieldId, required, type, dataSource, staticOptions } = slot
    const disabled = !canEdit

    if (!isRepeatable) {
      if (fieldId === 'serial_number') {
        return <Input value={record.serial_number ?? '（自動產生）'} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
      }
      if (fieldId === 'applicant' || dataSource === 'current_user_name') {
        return <Input value={record.applicant ?? applicantName} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
      }
      if (fieldId === 'apply_division') {
        return (
          <div className="w-full">
            <SearchableSelect
              value={String(divisionId ?? '')}
              onChange={v => {
                const newDivId = Number(v) || null
                setDivisionId(newDivId)
                setSectionId(null)
                const divRoles = newDivId ? (memberRoleMap[newDivId] ?? []) : []
                setField('apply_role', divRoles.length === 1 ? divRoles[0] : '')
              }}
              options={divisions}
              disabled={disabled} required={required}
            />
            {renderNoLeaderHint(divisionId, '處別')}
          </div>
        )
      }
      if (fieldId === 'apply_section') {
        return (
          <div className="w-full">
            <SearchableSelect
              value={String(sectionId ?? '')}
              onChange={v => {
                const newSecId = Number(v) || null
                setSectionId(newSecId)
                const secRoles = newSecId ? (memberRoleMap[newSecId] ?? []) : []
                const divRoles = divisionId ? (memberRoleMap[divisionId] ?? []) : []
                const roles = secRoles.length > 0 ? secRoles : divRoles
                setField('apply_role', roles.length === 1 ? roles[0] : '')
              }}
              options={sections}
              disabled={disabled || !divisionId} required={required}
            />
            {renderNoLeaderHint(sectionId, '課別')}
          </div>
        )
      }
      if (fieldId === 'apply_role') {
        return (
          <SearchableSelect
            value={fieldValues.apply_role ?? ''}
            onChange={v => setField('apply_role', v)}
            options={availableRoles.map(name => ({ value: name, label: name }))}
            disabled={disabled || !divisionId} required={required}
          />
        )
      }
    }

    if (type === 'select' && dataSource === 'tax_rates') {
      const options = taxRateOptions.map(o => ({ value: o.label, label: o.label }))
      return (
        <SearchableSelect
          value={values[fieldId] ?? ''}
          onChange={v => onChange(fieldId, v)}
          options={options}
          required={required}
          disabled={disabled}
        />
      )
    }

    if (type === 'radio') {
      return (
        <div style={{ display: 'flex', gap: 32, padding: '8px 0' }}>
          {(staticOptions ?? []).map(opt => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer' }}>
              <input type="radio" name={fieldId} value={opt} style={{ width: 18, height: 18 }}
                checked={values[fieldId] === opt}
                onChange={e => !disabled && onChange(fieldId, e.target.value)}
                disabled={disabled} required={required && !values[fieldId]} />
              {opt}
            </label>
          ))}
        </div>
      )
    }

    if (type === 'select') {
      let options: { value: string; label: string }[] = []
      if (dataSource === 'static') options = (staticOptions ?? []).map(o => ({ value: o, label: o }))
      else if (dataSource.startsWith('dropdown_options:')) {
        options = (dropdownOptions[dataSource.replace('dropdown_options:', '')] ?? []).map(o => ({ value: o.label, label: o.label }))
      } else if (dataSource.startsWith('fee_records:') || dataSource.startsWith('payee_records:')) {
        options = dynamicSelectOptions[dataSource] ?? []
      }
      // 費用項目（細項）：依主要選擇的編號過濾；主要未選時不提供選項
      const isDetailFee = detailFeeFieldIds.includes(fieldId)
      if (isDetailFee) {
        if (!mainFeeValue) options = []
        else if (mainFeeValueIsKnown) options = options.filter(o => feeItemCode(o.label) === feeItemCode(mainFeeValue))
      }
      const isMainFee = mainFeeSlot?.fieldId === fieldId
      return (
        <SearchableSelect value={values[fieldId] ?? ''}
          onChange={v => {
            onChange(fieldId, v)
            if (isMainFee) clearMismatchedDetailFees(v)
          }}
          options={options}
          placeholder={isDetailFee && !mainFeeValue ? `請先選擇${mainFeeSlot!.label}` : undefined}
          disabled={disabled} required={required} />
      )
    }

    if (type === 'attachment' && !isRepeatable) {
      const existing = existingAttachments.filter(a => a.slotLabel === slot.label && !deletedAttachmentIds.includes(a.id ?? -1))
      const added = newAttachments.filter(a => a.slotLabel === slot.label)
      return (
        <AttachmentUpload slotLabel={slot.label} attachments={[...existing, ...added]} readOnly={disabled}
          onAdd={item => setNewAttachments(prev => [...prev, item])}
          onRemove={item => {
            if (item.id) setDeletedAttachmentIds(prev => [...prev, item.id!])
            else setNewAttachments(prev => prev.filter(a => a.storagePath !== item.storagePath))
          }}
        />
      )
    }

    if (type === 'textarea') {
      return (
        <Textarea value={values[fieldId] ?? ''} disabled={disabled}
          onChange={e => onChange(fieldId, e.target.value)}
          required={required} rows={4} className={disabled ? 'bg-[var(--bg-page)]' : ''} />
      )
    }

    if (type === 'readonly') {
      return <Input value={values[fieldId] ?? ''} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
    }

    const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'
    return (
      <Input type={inputType} value={values[fieldId] ?? ''} disabled={disabled}
        onChange={e => onChange(fieldId, e.target.value)}
        required={required} className={disabled ? 'bg-[var(--bg-page)]' : ''} />
    )
  }

  function renderField(slot: NonNullable<FormSlot>) {
    return renderFieldFor(slot, fieldValues, setField)
  }

  function renderGroupInstances(block: FormBlock) {
    const groupRows = getGroupRows(block)
    if (groupRows.length === 0) return null
    const groupSlots = groupRows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
    const taxSelectSlot = groupSlots.find(s => s.dataSource === 'tax_rates' && s.taxConfig)
    const instances = groupInstances[block.id] ?? [{}]
    const disabled = !canEdit

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
          const taxAmtFieldId = taxSelectSlot?.taxConfig?.taxAmountFieldId
          const storedTax = taxAmtFieldId ? (parseFloat(instValues[taxAmtFieldId] ?? '0') || 0) : 0
          const otherNums = taxSelectSlot?.taxConfig
            ? groupSlots.filter(s => s.type === 'number' && s.fieldId !== totalFieldId && s.fieldId !== taxAmtFieldId)
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
                    if (totalFieldId && slot.fieldId === totalFieldId) {
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
                        {renderFieldFor(slot, instValues, setInstField, true)}
                      </div>
                    )
                  })}
                </div>
              ))}
              {!disabled && instances.length > 1 && (
                <button type="button" onClick={() => removeGroupInstance(block.id, instIdx)}
                  style={{ position: 'absolute', right: -76, top: 0, width: 56, padding: '4px 8px', fontSize: 12,
                    border: '1px solid #fca5a5', borderRadius: 6, background: 'var(--bg-card)', color: '#dc2626', cursor: 'pointer' }}>
                  刪除
                </button>
              )}
            </div>
          )
        })}
        {!disabled && (
          <button type="button" onClick={() => addGroupInstance(block.id)}
            style={{ padding: '6px 14px', fontSize: 13, border: '1.5px dashed #d1d5db',
              borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: 4 }}>
            ＋ 新增項目
          </button>
        )}
      </div>
    )
  }

  function renderRepeatableRow(row: FormSchemaRow) {
    const instances = getRepeatableInstances(row.id)
    const disabled = !canEdit
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${row.cols}, 1fr)`, gap: 20, marginBottom: 6 }}>
          {row.slots.map((slot, idx) =>
            slot ? (
              <label key={idx} style={labelStyle}>
                {slot.label}{slot.required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
              </label>
            ) : <div key={idx} />
          )}
        </div>
        {instances.map((instValues, instIdx) => (
          <div key={instIdx} style={{ position: 'relative', marginBottom: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${row.cols}, 1fr)`, gap: 20, alignItems: 'center' }}>
              {row.slots.map((slot, slotIdx) =>
                slot ? (
                  <div key={slotIdx}>
                    {renderFieldFor(slot, instValues, (fid, val) => setRepeatableField(row.id, instIdx, fid, val), true)}
                  </div>
                ) : <div key={slotIdx} />
              )}
            </div>
            {!disabled && instances.length > 1 && (
              <button type="button" onClick={() => removeRepeatableInstance(row.id, instIdx)}
                style={{ position: 'absolute', right: -76, top: '50%', transform: 'translateY(-50%)',
                  width: 56, padding: '4px 8px', fontSize: 12, border: '1px solid #fca5a5',
                  borderRadius: 6, background: 'var(--bg-card)', color: '#dc2626', cursor: 'pointer' }}>
                刪除
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <button type="button" onClick={() => addRepeatableInstance(row.id)}
            style={{ padding: '6px 14px', fontSize: 13, border: '1.5px dashed #d1d5db',
              borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: 4 }}>
            ＋ 新增項目
          </button>
        )}
      </div>
    )
  }

  function buildUpdates() {
    const divUnit = orgUnits.find(u => u.id === divisionId)
    const secUnit = orgUnits.find(u => u.id === sectionId)
    const extraData: Record<string, string> = {}
    for (const slot of allSlots) {
      if (slot.fieldId.startsWith('custom_') && !repeatableSlotFieldIds.has(slot.fieldId) && !groupSlotFieldIds.has(slot.fieldId)) {
        extraData[slot.label] = fieldValues[slot.fieldId] ?? computedTotals[slot.fieldId] ?? ''
      }
    }
    for (const row of allRows.filter(r => r.repeatable)) {
      const instances = repeatableValues[row.id] ?? [{}]
      const labeled = instances.map(inst => {
        const obj: Record<string, string> = {}
        for (const slot of row.slots) {
          if (slot) obj[slot.label] = inst[slot.fieldId] ?? ''
        }
        return obj
      })
      extraData[`__repeatable_${row.id}`] = JSON.stringify(labeled)
    }
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
          if (totalFieldId && slot.fieldId === totalFieldId) {
            obj[slot.label] = String(total)
          } else {
            obj[slot.label] = inst[slot.fieldId] ?? ''
          }
        }
        return obj
      })
      extraData[`__group_${block.id}`] = JSON.stringify(labeled)
    }
    return {
      date: fieldValues.date || record.date,
      apply_division: divUnit ? unitLabel(divUnit) : (fieldValues.apply_division ?? null),
      apply_section: secUnit ? unitLabel(secUnit) : (fieldValues.apply_section ?? null),
      apply_division_id: divisionId,
      apply_section_id: sectionId,
      apply_role: fieldValues.apply_role || null,
      institution: fieldValues.institution || null,
      payment_account: fieldValues.payment_account || null,
      expense_item: (() => {
        const thirdBlock = schema[2]
        if (thirdBlock) {
          const allThirdSlots = thirdBlock.rows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
          const feeSlot = allThirdSlots.find(s => s.dataSource?.startsWith('fee_records:'))
          if (feeSlot) {
            const fromField = fieldValues[feeSlot.fieldId]
            if (fromField) return fromField
            const fromGroup = (groupInstances[thirdBlock.id]?.[0])?.[feeSlot.fieldId]
            if (fromGroup) return fromGroup
          }
        }
        return fieldValues.expense_item || null
      })(),
      name: fieldValues.name || null,
      amount: (() => {
        const thirdBlock = schema[2]
        if (thirdBlock) {
          const grp = groupBlockSummary[thirdBlock.id]
          if (grp !== undefined) return grp.total
          const blk = blockTaxMap[thirdBlock.id]
          if (blk) return blk.total
        }
        return Number(fieldValues.amount) || 0
      })(),
      category: fieldValues.category || null,
      note: fieldValues.note || null,
      extra_data: extraData,
      updated_at: new Date().toISOString(),
    }
  }

  function computeChangeLogs(updates: ReturnType<typeof buildUpdates>) {
    const changes: { fieldLabel: string; oldValue: string; newValue: string }[] = []
    const seen = new Set<string>()

    for (const slot of allSlots) {
      if (repeatableSlotFieldIds.has(slot.fieldId) || groupSlotFieldIds.has(slot.fieldId)) continue
      if (slot.fieldId === 'serial_number' || slot.dataSource === 'current_user_name') continue
      if (seen.has(slot.fieldId)) continue
      seen.add(slot.fieldId)

      const newVal = (() => {
        switch (slot.fieldId) {
          case 'date': return updates.date ?? ''
          case 'apply_division': return updates.apply_division ?? ''
          case 'apply_section': return updates.apply_section ?? ''
          case 'apply_role': return updates.apply_role ?? ''
          case 'institution': return updates.institution ?? ''
          case 'payment_account': return updates.payment_account ?? ''
          case 'expense_item': return updates.expense_item ?? ''
          case 'name': return updates.name ?? ''
          case 'amount': return String(updates.amount ?? '')
          case 'category': return updates.category ?? ''
          case 'note': return updates.note ?? ''
          default: return updates.extra_data?.[slot.label] ?? ''
        }
      })()
      const oldVal = (() => {
        switch (slot.fieldId) {
          case 'date': return record.date ?? ''
          case 'apply_division': return record.apply_division ?? ''
          case 'apply_section': return record.apply_section ?? ''
          case 'apply_role': return record.apply_role ?? ''
          case 'institution': return record.institution ?? ''
          case 'payment_account': return record.payment_account ?? ''
          case 'expense_item': return record.expense_item ?? ''
          case 'name': return record.name ?? ''
          case 'amount': return String(record.amount ?? 0)
          case 'category': return record.category ?? ''
          case 'note': return record.note ?? ''
          default: return record.extra_data?.[slot.label] ?? ''
        }
      })()

      if (oldVal !== newVal) changes.push({ fieldLabel: slot.label, oldValue: oldVal, newValue: newVal })
    }

    for (const block of schema) {
      const key = `__group_${block.id}`
      const oldJson = record.extra_data?.[key] ?? '[]'
      const newJson = updates.extra_data?.[key] ?? '[]'
      if (oldJson === newJson) continue
      const groupSlots = getGroupRows(block)
        .flatMap(r => r.slots)
        .filter((s): s is NonNullable<FormSlot> => s !== null)
      let oldArr: Record<string, string>[] = []
      let newArr: Record<string, string>[] = []
      try { oldArr = JSON.parse(oldJson) } catch { /* empty */ }
      try { newArr = JSON.parse(newJson) } catch { /* empty */ }
      const multiRow = Math.max(oldArr.length, newArr.length) > 1
      const minLen = Math.min(oldArr.length, newArr.length)
      for (let rowIdx = 0; rowIdx < minLen; rowIdx++) {
        for (const slot of groupSlots) {
          const oldVal = oldArr[rowIdx]?.[slot.label] ?? ''
          const newVal = newArr[rowIdx]?.[slot.label] ?? ''
          if (oldVal !== newVal) {
            const label = multiRow ? `第${rowIdx + 1}筆 ${slot.label}` : slot.label
            changes.push({ fieldLabel: label, oldValue: oldVal, newValue: newVal })
          }
        }
      }
      for (let i = minLen; i < newArr.length; i++) {
        const row = newArr[i]
        const summary = groupSlots.map(s => `${s.label}：${row[s.label] ?? ''}`).filter(s => !s.endsWith('：')).join('、')
        changes.push({ fieldLabel: `新增第${i + 1}筆`, oldValue: '（無）', newValue: summary || '（新增）' })
      }
      for (let i = minLen; i < oldArr.length; i++) {
        const row = oldArr[i]
        const summary = groupSlots.map(s => `${s.label}：${row[s.label] ?? ''}`).filter(s => !s.endsWith('：')).join('、')
        changes.push({ fieldLabel: `刪除第${i + 1}筆`, oldValue: summary || '（已刪除）', newValue: '（已刪除）' })
      }
    }

    for (const [key, newJson] of Object.entries(updates.extra_data ?? {})) {
      if (!key.startsWith('__repeatable_')) continue
      const oldJson = record.extra_data?.[key] ?? '[]'
      if (oldJson === newJson) continue
      const rowId = key.replace('__repeatable_', '')
      const repRow = allRows.find(r => r.id === rowId)
      const slotList = repRow?.slots.filter((s): s is NonNullable<FormSlot> => s !== null) ?? []
      let oldArr: Record<string, string>[] = []
      let newArr: Record<string, string>[] = []
      try { oldArr = JSON.parse(oldJson) } catch { /* empty */ }
      try { newArr = JSON.parse(newJson) } catch { /* empty */ }
      if (!slotList.length) {
        changes.push({ fieldLabel: '明細項目', oldValue: '（已修改）', newValue: '（已修改）' })
        continue
      }
      const multiRow = Math.max(oldArr.length, newArr.length) > 1
      const minLen = Math.min(oldArr.length, newArr.length)
      for (let rowIdx = 0; rowIdx < minLen; rowIdx++) {
        for (const slot of slotList) {
          const oldVal = oldArr[rowIdx]?.[slot.label] ?? ''
          const newVal = newArr[rowIdx]?.[slot.label] ?? ''
          if (oldVal !== newVal) {
            const label = multiRow ? `第${rowIdx + 1}筆 ${slot.label}` : slot.label
            changes.push({ fieldLabel: label, oldValue: oldVal, newValue: newVal })
          }
        }
      }
      for (let i = minLen; i < newArr.length; i++) {
        const row = newArr[i]
        const summary = slotList.map(s => `${s.label}：${row[s.label] ?? ''}`).filter(s => !s.endsWith('：')).join('、')
        changes.push({ fieldLabel: `新增第${i + 1}筆`, oldValue: '（無）', newValue: summary || '（新增）' })
      }
      for (let i = minLen; i < oldArr.length; i++) {
        const row = oldArr[i]
        const summary = slotList.map(s => `${s.label}：${row[s.label] ?? ''}`).filter(s => !s.endsWith('：')).join('、')
        changes.push({ fieldLabel: `刪除第${i + 1}筆`, oldValue: summary || '（已刪除）', newValue: '（已刪除）' })
      }
    }

    return changes
  }

  // 與 AddFundsForm 的範本格式一致：欄位代號為 key、處別/課別存組織節點 id、
  // 可重複列與群組明細以 JSON 字串儲存；申請日期與單號不帶入範本
  function buildTemplateFieldValues(): Record<string, string> {
    const values: Record<string, string> = { ...fieldValues }
    delete values.serial_number
    delete values.date
    if (divisionId) values.apply_division = String(divisionId)
    if (sectionId) values.apply_section = String(sectionId)
    for (const row of allRows.filter(r => r.repeatable)) {
      const instances = repeatableValues[row.id] ?? []
      if (instances.length) values[`__repeatable_${row.id}`] = JSON.stringify(instances)
    }
    for (const block of schema) {
      const groupRows = getGroupRows(block)
      if (!groupRows.length) continue
      const instances = groupInstances[block.id] ?? []
      if (instances.length) values[`__group_${block.id}`] = JSON.stringify(instances)
    }
    return values
  }

  async function handleSaveAsTemplate() {
    if (!saveAsName.trim()) return
    setSavingTemplate(true); setError(null)
    const { error: saveError } = await saveUserFundTemplate(saveAsName.trim(), buildTemplateFieldValues())
    setSavingTemplate(false)
    if (saveError) { setError(saveError); return }
    setShowSaveAs(false)
    setSaveAsName('')
    setTemplateSaved(true)
  }

  async function persistAttachmentChanges() {
    await Promise.all(deletedAttachmentIds.map(id => deleteAttachmentRecord(id)))
    if (newAttachments.length) {
      await saveAttachments(record.id, null, newAttachments.map(a => ({
        slotLabel: a.slotLabel, fileName: a.fileName,
        storagePath: a.storagePath, fileType: a.fileType,
        uploadedBy: MOCK_USER_ID,
      })))
    }
  }

  async function handleDelete() {
    if (!confirm('確定要刪除此單據嗎？此操作無法復原。')) return
    setSubmitting(true)
    const { error: deleteError } = await deleteFundsAllocation(record.id)
    if (deleteError) { setError(deleteError); setSubmitting(false); return }
    router.refresh()
    router.push('/funds-allocation/my-funds')
  }

  async function handleSaveDraft() {
    setSavingDraft(true); setError(null)
    const { error: updateError } = await updateFundsAllocation(record.id, {
      ...buildUpdates(), status: 'draft', flow_template_id: null, current_step: null,
    })
    setSavingDraft(false)
    if (updateError) { setError(updateError); return }
    await persistAttachmentChanges()
    router.push('/funds-allocation/my-funds')
  }

  async function handleSubmitFromDraft(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const feeError = validateFeePositive(schema, fieldValues, repeatableValues, groupInstances)
    if (feeError) {
      setError(feeError)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSubmitting(true); setError(null)
    const { error: updateError } = await updateFundsAllocation(record.id, {
      ...buildUpdates(), status: 'pending', flow_template_id: flowTemplateId, current_step: 1,
    })
    if (updateError) { setError(updateError); setSubmitting(false); return }
    await persistAttachmentChanges()
    router.push('/funds-allocation/my-funds')
  }

  async function handleSaveChanges(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // 已送出的單子（審核人或申請人修改）也不允許把費用改成 0 或負數
    const feeError = validateFeePositive(schema, fieldValues, repeatableValues, groupInstances)
    if (feeError) {
      setError(feeError)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSubmitting(true); setError(null)
    const updates = buildUpdates()
    const changes = computeChangeLogs(updates)
    const deletedItems = existingAttachments.filter(a => deletedAttachmentIds.includes(a.id ?? -1))
    for (const a of deletedItems) {
      changes.push({ fieldLabel: `刪除附件（${a.slotLabel}）`, oldValue: a.fileName, newValue: '（已刪除）' })
    }
    for (const a of newAttachments) {
      changes.push({ fieldLabel: `新增附件（${a.slotLabel}）`, oldValue: '（無）', newValue: a.fileName })
    }
    const { error: updateError } = await updateFundsAllocation(record.id, updates)
    if (updateError) { setError(updateError); setSubmitting(false); return }
    await persistAttachmentChanges()
    if (changes.length > 0 && userId) {
      await logFieldChanges({
        fundsAllocationId: record.id,
        changedBy: userId,
        changedByName: applicantName,
        stepNumber: record.current_step ?? null,
        changes,
      })
    }
    if (onSaveSuccess) {
      onSaveSuccess()
    } else if (fromReview) {
      router.push(`/funds-allocation/review/check/${record.id}`)
    } else {
      router.push('/funds-allocation/my-funds')
    }
  }

  const stepName = (() => {
    if (record.status === 'pending') return null  // step name handled by list page
    return null
  })()

  return (
    <div>
      <ChangeLogModal fundsAllocationId={record.id} open={changeLogOpen} onClose={() => setChangeLogOpen(false)} />

      {/* 標題列 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>
            {isDraft ? '編輯資金分配申請單' : '資金分配申請單'}
          </h1>
          <StatusBadge module="funds_allocation" status={record.status} stepName={stepName} labelConfig={labelConfig} />
          {!isDraft && !isCurrentReviewer && (
            <button
              type="button"
              onClick={() => setChangeLogOpen(true)}
              style={{ fontSize: 13, padding: '4px 10px', border: '1px solid var(--btn-border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-body)' }}
            >
              變更歷程
            </button>
          )}
        </div>
        {canEdit && !isCurrentReviewer && (
          <Button
            type="button"
            onClick={handleDelete}
            disabled={submitting || savingDraft}
            style={{ background: '#dc2626', color: '#fff', border: 'none' }}
          >
            刪除此單據
          </Button>
        )}
      </div>

      {error && <p style={errorStyle}>錯誤：{error}</p>}

      <form onSubmit={isDraft ? handleSubmitFromDraft : handleSaveChanges}>
        {schema.filter(block => !block.showWhen || fieldValues[block.showWhen.fieldId] === block.showWhen.value).map(block => (
          <div key={block.id} style={{ marginBottom: 28, border: '1px solid var(--border-color)', borderRadius: 16, background: 'var(--bg-card)' }}>
            {(block.title || blockTaxMap[block.id] || groupBlockSummary[block.id]) && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--border-color)', borderRadius: '9px 9px 0 0', background: 'var(--bg-sidebar)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>{block.title ?? ''}</span>
                {(blockTaxMap[block.id] || groupBlockSummary[block.id]) && (() => {
                  const grpSummary = groupBlockSummary[block.id]
                  const blkSummary = blockTaxMap[block.id]
                  if (grpSummary) {
                    return (
                      <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>費用 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(grpSummary.taxBase)}</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>手續費 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(grpSummary.handling)}</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>稅額 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(grpSummary.taxAmount)}</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>總額 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(grpSummary.total)}</strong></span>
                      </div>
                    )
                  }
                  return (
                    <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>費用 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(blkSummary!.taxBase)}</strong></span>
                      <span style={{ color: 'var(--text-muted)' }}>稅額 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(blkSummary!.taxAmount)}</strong></span>
                    </div>
                  )
                })()}
              </div>
            )}
            <div style={{ paddingTop: 44, paddingLeft: 48, paddingBottom: 16, paddingRight: block.rows.some(r => r.repeatable || r.rowGroupStart) ? 96 : 48 }}>
              {/* 非群組列正常渲染 */}
              {block.rows.filter(r => !r.rowGroupStart && !getGroupRows(block).includes(r)).map(row =>
                row.repeatable ? (
                  <div key={row.id}>{renderRepeatableRow(row)}</div>
                ) : (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: `repeat(${row.cols}, 1fr)`, columnGap: 48, rowGap: 20, marginBottom: 32 }}>
                  {row.slots.map((slot, idx) => {
                    if (slot && slot.showWhen && !slot.showWhen.values.includes(fieldValues[slot.showWhen.fieldId] ?? '')) {
                      return <div key={idx} />
                    }
                    if (!slot) return <div key={idx} />
                    // 含群組列/可重複列的區塊（如付款明細）維持直式，與明細列排版一致
                    const verticalLayout = block.rows.some(r => r.repeatable || r.rowGroupStart)
                    const labelNode = (
                      <label style={verticalLayout ? labelStyle : { ...labelStyle, marginBottom: 0, width: 140, flexShrink: 0 }}>
                        {slot.label}
                        {slot.required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                        {computedTotalHints[slot.fieldId] && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, fontWeight: 400 }}>{computedTotalHints[slot.fieldId]}</span>}
                      </label>
                    )
                    return verticalLayout ? (
                      <div key={idx}>
                        {labelNode}
                        {renderField(slot)}
                      </div>
                    ) : (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        {labelNode}
                        <div style={{ flex: 1, minWidth: 0 }}>{renderField(slot)}</div>
                      </div>
                    )
                  })}
                </div>
              ))}
              {/* 群組列 */}
              {renderGroupInstances(block)}
            </div>
          </div>
        ))}

        {/* 草稿送出時的審核流程提示 */}
        {isDraft && fieldValues.payment_account && (
          <div style={{
            margin: '12px 0', padding: '10px 14px', borderRadius: 6,
            background: flowTemplateName ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${flowTemplateName ? '#86efac' : '#fca5a5'}`,
            fontSize: 13,
          }}>
            {flowTemplateName
              ? <span style={{ color: '#15803d' }}>✓ 審核流程：<strong>{flowTemplateName}</strong></span>
              : <span style={{ color: '#dc2626' }}>⚠ 此出款帳號尚未設定審核流程，請聯絡系統管理員</span>
            }
          </div>
        )}

        {!canEdit && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>此申請單已進入審核程序，無法編輯。</p>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, marginBottom: 28, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 申請人本人可另存範本（含自己兼任審核人的情況）；審核頁情境（嵌入或由審核頁進入）不顯示 */}
            {isApplicant && !fromReview && !hideApprovalPanel && (
              showSaveAs ? (
                <>
                  <input
                    value={saveAsName}
                    onChange={e => setSaveAsName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveAsTemplate() } }}
                    placeholder="輸入範本名稱"
                    style={{ padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13, width: 160,
                      background: 'var(--bg-card)', color: 'var(--text-body)' }}
                    autoFocus
                  />
                  <Button type="button" variant="outline" onClick={handleSaveAsTemplate} disabled={savingTemplate || !saveAsName.trim()}>
                    {savingTemplate ? '儲存中...' : '確認'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setShowSaveAs(false); setSaveAsName('') }}>取消</Button>
                </>
              ) : (
                <Button type="button" variant="outline"
                  onClick={() => { setShowSaveAs(true); setTemplateSaved(false) }}
                  disabled={savingDraft || submitting}>
                  另存為我的範本
                </Button>
              )
            )}
            {templateSaved && !showSaveAs && (
              <span style={{ fontSize: 13, color: '#16a34a' }}>✓ 已儲存為我的範本</span>
            )}
            {isDraft && (
              <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={savingDraft || submitting}>
                {savingDraft ? '儲存中...' : '儲存草稿'}
              </Button>
            )}
            {record.status === FUNDS_STATUS.APPROVED && record.current_step === null && (
              <Button type="button" onClick={() => router.push(`/funds-payment/my-payment/add/${record.id}`)}>
                建立付款憑單
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              {isDraft ? '取消' : '返回'}
            </Button>
            {isDraft && (
              <Button type="submit" disabled={submitting || savingDraft || (!!fieldValues.payment_account && !flowTemplateId)}>
                {submitting ? '送出中...' : '確定送出'}
              </Button>
            )}
            {!isDraft && canEdit && (
              <Button type="submit" disabled={submitting}>{submitting ? '儲存中...' : '儲存變更'}</Button>
            )}
          </div>
        </div>
      </form>

      {!isDraft && !hideApprovalPanel && approvalSteps.length > 0 && (
        <div style={{ marginTop: 32, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>審核進度</h2>
          {approvalSteps.map((step, idx) => {
            const past = approvalRecords.find(r => r.step_number === step.step_number)
            const isActive = step.step_number === record.current_step && record.status === 'pending'
            const isDone = !!past
            const isLast = idx === approvalSteps.length - 1
            return (
              <div key={step.step_number} style={{
                padding: '14px 0',
                borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
                opacity: !isDone && !isActive ? 0.4 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0, minWidth: 20 }}>
                    {step.step_number}.
                  </span>
                  <strong style={{ fontSize: 14, flexShrink: 0 }}>
                    {step.step_name}
                    {isDone && past.reviewer_id && reviewerNames[past.reviewer_id] && (
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
                        · {reviewerNames[past.reviewer_id]}
                      </span>
                    )}
                  </strong>
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--text-body)', textAlign: 'center' }}>
                    {isDone && past.comment ? past.comment : ''}
                  </span>
                  {isDone && (
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, flexShrink: 0,
                      background: past.decision === 'approved' ? '#dcfce7' : '#fee2e2',
                      color: past.decision === 'approved' ? '#16a34a' : '#dc2626',
                    }}>
                      {past.decision === 'approved' ? '✓ 核准' : '✗ 不核准'}
                    </span>
                  )}
                  {isActive && !isDone && (
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#dbeafe', color: '#2563eb', flexShrink: 0 }}>
                      待審核
                    </span>
                  )}
                  {isDone && past.reviewed_at && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {formatDateTime(past.reviewed_at)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {record.status === 'approved' && (
            <p style={{ marginTop: 12, color: '#16a34a', fontWeight: 600, fontSize: 14 }}>✓ 此申請已全數核准</p>
          )}
          {record.status === 'rejected' && (
            <p style={{ marginTop: 12, color: '#dc2626', fontWeight: 600, fontSize: 14 }}>✗ 此申請已被拒絕</p>
          )}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text-body)', marginBottom: 10 }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginBottom: 12 }
