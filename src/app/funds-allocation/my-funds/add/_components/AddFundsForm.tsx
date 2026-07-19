'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { MOCK_USER_ID } from '@/lib/constants'
import { createFundsAllocation, generateSerialNumber as genSerialNumber } from '@/app/actions/funds-allocation'
import { DropdownOption, OrgUnit, FormBlock, FormSchemaRow, FormSlot, TaxRateOption } from '@/lib/types'
import { computeBlockTax, formatTaxNumber, applyTaxFormula } from '@/lib/taxUtils'
import { deriveUserOrgCombos, allDivisionOptions, allSectionOptions, unitsInTreeOrder, nearestDivisionId, isAccountVisibleToUser } from '@/lib/orgPositions'
import { getTaxRateOptions } from '@/app/actions/tax-rates'
import { feeItemCode } from '@/lib/feeItems'
import { validateFeePositive } from '@/lib/feeValidation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import AttachmentUpload, { AttachmentItem } from '@/app/_components/AttachmentUpload'
import GroupEditTable from '@/app/_components/GroupEditTable'
import { FieldHint } from '@/app/_components/RecordDetailView'
import ErrorDialog from '@/app/_components/ErrorDialog'
import ConfirmDialog from '@/app/_components/ConfirmDialog'
import { saveAttachments } from '@/app/actions/attachments'
import { saveUserFundTemplate, updateUserFundTemplate, deleteUserFundTemplate } from '@/app/actions/fund-templates'
import DateCyclePicker from '@/app/_components/DateCyclePicker'
import { ApplicationCycleConfig } from '@/app/actions/application-cycle'
import { computeNearestAllowedDate } from '@/lib/dateUtils'


function unitLabel(u: OrgUnit) {
  return [u.code, u.name].filter(Boolean).join(' ')
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function AddFundsForm({
  applicantName,
  userId,
  schema,
  initialValues,
  cycleConfig,
  editTemplate,
}: {
  applicantName: string
  userId: number | null
  schema: FormBlock[]
  initialValues?: Record<string, string>
  cycleConfig?: ApplicationCycleConfig
  editTemplate?: { id: number; name: string }
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState(false)
  const [askDeleteTemplate, setAskDeleteTemplate] = useState(false)

  // Data source state
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, DropdownOption[]>>({})
  const [memberUnitIds, setMemberUnitIds] = useState<number[]>([])
  const [memberRoleMap, setMemberRoleMap] = useState<Record<number, string[]>>({})
  // 使用者自己在各組織節點上的職稱（org_unit_id -> role_type_id），與職稱名稱對照表
  const [memberRoleTypeIdMap, setMemberRoleTypeIdMap] = useState<Record<number, number | null>>({})
  const [roleTypeNames, setRoleTypeNames] = useState<Record<number, string>>({})
  // 有「已綁定帳號負責人」的組織節點 id 集合；null = 尚未載入完成（載入前不顯示提醒）
  const [leaderUnitIds, setLeaderUnitIds] = useState<Set<number> | null>(null)
  const [dynamicSelectOptions, setDynamicSelectOptions] = useState<Record<string, { value: string; label: string }[]>>({})

  // Cascade state for org units — initialised from template if provided
  const [divisionId, setDivisionId] = useState<number | null>(() =>
    Number(initialValues?.apply_division) || null
  )
  const [sectionId, setSectionId] = useState<number | null>(() =>
    Number(initialValues?.apply_section) || null
  )

  // Generic field values — initialised from template, excluding cascade ID keys 與 repeatable/group 預設值
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    if (!initialValues) return {}
    const flat: Record<string, string> = {}
    for (const [key, val] of Object.entries(initialValues)) {
      if (key === 'apply_division' || key === 'apply_section') continue
      if (key.startsWith('__repeatable_') || key.startsWith('__group_')) continue
      flat[key] = val
    }
    return flat
  })

  // 審核流程（根據出款帳號自動帶入）
  const [flowTemplateId, setFlowTemplateId] = useState<number | null>(null)
  const [flowTemplateName, setFlowTemplateName] = useState<string | null>(null)

  // 附件（key = slot.label）
  const [pendingAttachments, setPendingAttachments] = useState<Record<string, AttachmentItem[]>>({})

  // 可重複列資料（key = rowId, value = 每筆的欄位值陣列）— 從範本帶入預設值（若有）
  const [repeatableValues, setRepeatableValues] = useState<Record<string, Record<string, string>[]>>(() => {
    if (!initialValues) return {}
    const out: Record<string, Record<string, string>[]> = {}
    for (const [key, val] of Object.entries(initialValues)) {
      if (!key.startsWith('__repeatable_')) continue
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed) && parsed.length) out[key.replace('__repeatable_', '')] = parsed
      } catch { /* 忽略解析錯誤 */ }
    }
    return out
  })

  // 群組重複資料（key = blockId, value = 每筆的欄位值陣列）— 從範本帶入預設值（若有）
  const [groupInstances, setGroupInstances] = useState<Record<string, Record<string, string>[]>>(() => {
    if (!initialValues) return {}
    const out: Record<string, Record<string, string>[]> = {}
    for (const [key, val] of Object.entries(initialValues)) {
      if (!key.startsWith('__group_')) continue
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed) && parsed.length) out[key.replace('__group_', '')] = parsed
      } catch { /* 忽略解析錯誤 */ }
    }
    return out
  })

  // 稅額選項
  const [taxRateOptions, setTaxRateOptions] = useState<TaxRateOption[]>([])

  // Collect which data sources are needed
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

  const setField = useCallback((id: string, val: string) => {
    setFieldValues(prev => ({ ...prev, [id]: val }))
  }, [])

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
  // 改選費用項目（主要）時：清掉編號對不上的細項；若該主要底下的細項恰好只有一筆則自動帶入，多筆才留給使用者自選（固定欄位與群組明細都處理）
  function clearMismatchedDetailFees(newMainVal: string) {
    if (!detailFeeFieldIds.length) return
    const code = feeItemCode(newMainVal)
    const mismatch = (v: string | undefined) => !!v && (!code || feeItemCode(v) !== code)
    // 各細項欄位在此主要編號下的對應選項恰好一筆時，記下要自動帶入的值
    const soleFillByField: Record<string, string> = {}
    if (code) {
      for (const fid of detailFeeFieldIds) {
        const ds = allSlots.find(s => s.fieldId === fid)?.dataSource
        const matched = (ds ? dynamicSelectOptions[ds] ?? [] : []).filter(o => feeItemCode(o.label) === code)
        if (matched.length === 1) soleFillByField[fid] = matched[0].value
      }
    }
    setFieldValues(prev => {
      const next = { ...prev }
      for (const fid of detailFeeFieldIds) {
        if (groupSlotFieldIds.has(fid)) continue
        if (mismatch(next[fid])) next[fid] = ''
        if (fid in soleFillByField) next[fid] = soleFillByField[fid]
      }
      return next
    })
    setGroupInstances(prev => {
      const next: Record<string, Record<string, string>[]> = {}
      for (const [blockId, instances] of Object.entries(prev)) {
        next[blockId] = instances.map(inst => {
          const cleared = { ...inst }
          for (const fid of detailFeeFieldIds) {
            if (!groupSlotFieldIds.has(fid)) continue
            if (mismatch(cleared[fid])) cleared[fid] = ''
            if (fid in soleFillByField) cleared[fid] = soleFillByField[fid]
          }
          return cleared
        })
      }
      return next
    })
  }
  // 新增一組付款明細時的預帶值：套用各群組欄位的預設值（如幣別台幣），並比照連動邏輯——
  // 目前主要費用項目底下細項唯一時，自動帶入該細項
  function newGroupInstanceSeed(blockId: string): Record<string, string> {
    const block = schema.find(b => b.id === blockId)
    const seed: Record<string, string> = {}
    if (!block) return seed
    const code = feeItemCode(mainFeeValue)
    for (const slot of getGroupRows(block).flatMap(r => r.slots)) {
      if (!slot) continue
      if (slot.defaultValue) seed[slot.fieldId] = slot.defaultValue
      if (code && detailFeeFieldIds.includes(slot.fieldId)) {
        const matched = (slot.dataSource ? dynamicSelectOptions[slot.dataSource] ?? [] : [])
          .filter(o => feeItemCode(o.label) === code)
        if (matched.length === 1) seed[slot.fieldId] = matched[0].value
      }
    }
    return seed
  }
  function addGroupInstance(blockId: string) {
    const seed = newGroupInstanceSeed(blockId)
    setGroupInstances(prev => ({ ...prev, [blockId]: [...(prev[blockId] ?? [{}]), seed] }))
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

  // 當出款帳號改變時，自動查找對應的審核流程範本
  useEffect(() => {
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
          const tmpl = Array.isArray(t.approval_flow_templates)
            ? t.approval_flow_templates[0]
            : t.approval_flow_templates
          setFlowTemplateId(t.template_id)
          setFlowTemplateName((tmpl as { name: string } | undefined)?.name ?? null)
        } else {
          setFlowTemplateId(null)
          setFlowTemplateName(null)
        }
      })
  }, [fieldValues.payment_account, dropdownOptions])

  useEffect(() => {
    async function load() {
      const fetches: Promise<void>[] = []

      let loadedOrgUnits: OrgUnit[] = []
      let loadedMemberships: { org_unit_id: number; role_type_id: number | null }[] = []
      let loadedRoleTypeNames: Record<number, string> = {}

      const loadOrgUnits = async () => {
        const r = await supabase.from('org_units').select('*').order('sort_order')
        if (r.data) { loadedOrgUnits = r.data as OrgUnit[]; setOrgUnits(loadedOrgUnits) }
      }
      const loadMyMemberships = async () => {
        if (!userId) return
        const r = await supabase
          .from('org_unit_members')
          .select('org_unit_id, role_type_id')
          .eq('user_id', userId)
        if (r.data) {
          loadedMemberships = r.data as { org_unit_id: number; role_type_id: number | null }[]
          setMemberUnitIds(loadedMemberships.map(m => m.org_unit_id))
          setMemberRoleTypeIdMap(Object.fromEntries(loadedMemberships.map(m => [m.org_unit_id, m.role_type_id])))
        }
      }
      const loadRoleTypes = async () => {
        const r = await supabase.from('role_types').select('id, name')
        if (r.data) {
          loadedRoleTypeNames = Object.fromEntries((r.data as { id: number; name: string }[]).map(rt => [rt.id, rt.name]))
          setRoleTypeNames(loadedRoleTypeNames)
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
        fetches.push(loadOrgUnits(), loadMyMemberships(), loadUnitLeaders(), loadRoleTypes())
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

      // Auto-fill today_date fields
      allSlots.filter(s => s.dataSource === 'today_date').forEach(s => {
        setField(s.fieldId, today())
      })

      // 申請日期預設值：全新表單、或範本（個人/共用）／草稿未帶入日期時皆自動帶入，
      // 讓共用範本也和新增申請單／個人範本一樣有預設申請日期
      for (const s of allSlots) {
        if (s.type !== 'date') continue
        if (repeatableSlotFieldIds.has(s.fieldId) || groupSlotFieldIds.has(s.fieldId)) continue
        if (initialValues?.[s.fieldId]) continue // 範本/草稿已有日期則不覆蓋
        if (s.dateDefaultMode === 'nearest_cycle' && cycleConfig?.allowed_weekdays.length) {
          const nearest = computeNearestAllowedDate(cycleConfig.allowed_weekdays)
          if (nearest) setField(s.fieldId, nearest)
        } else if (s.dateDefaultMode === 'fixed' && s.defaultValue) {
          setField(s.fieldId, s.defaultValue)
        }
      }

      // 套用表單設定的欄位預設值（僅全新表單，範本/草稿已有值時不覆蓋）
      if (!initialValues) {
        for (const s of allSlots) {
          if (repeatableSlotFieldIds.has(s.fieldId) || groupSlotFieldIds.has(s.fieldId)) continue
          if (s.type === 'date') continue // 日期預設值已於上方統一處理
          if (s.defaultValue) setField(s.fieldId, s.defaultValue)
        }
        for (const row of allRows.filter(r => r.repeatable)) {
          const defaults: Record<string, string> = {}
          for (const slot of row.slots) {
            if (slot?.defaultValue) defaults[slot.fieldId] = slot.defaultValue
          }
          if (Object.keys(defaults).length) {
            setRepeatableValues(prev => ({ ...prev, [row.id]: [defaults] }))
          }
        }
        for (const block of schema) {
          const groupRows = getGroupRows(block)
          if (!groupRows.length) continue
          const defaults: Record<string, string> = {}
          for (const slot of groupRows.flatMap(r => r.slots)) {
            if (slot?.defaultValue) defaults[slot.fieldId] = slot.defaultValue
          }
          if (Object.keys(defaults).length) {
            setGroupInstances(prev => ({ ...prev, [block.id]: [defaults] }))
          }
        }

        // 申請處別：依組織樹順序，自動選使用者所屬的第一個處別（課別／職務不自動帶入，由使用者自行選擇）
        if (loadedMemberships.length && loadedOrgUnits.length) {
          const memberIds = loadedMemberships.map(m => m.org_unit_id)
          const unitMap = new Map(loadedOrgUnits.map(u => [u.id, u]))
          for (const u of unitsInTreeOrder(loadedOrgUnits).filter(u => memberIds.includes(u.id))) {
            const divId = nearestDivisionId(u, unitMap)
            if (divId != null) { setDivisionId(divId); break }
          }
        }
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Derived cascade values（處別/課別開放全部選項，不限縮於使用者所屬組合；職務選擇仍會自動帶入）
  const divisions = allDivisionOptions(orgUnits)
  const sections = allSectionOptions(orgUnits, divisionId)
  const sectionRoles = sectionId ? (memberRoleMap[sectionId] ?? []) : []
  const divisionRoles = divisionId ? (memberRoleMap[divisionId] ?? []) : []
  const availableRoles = sectionRoles.length > 0
    ? [...new Set(sectionRoles)]
    : divisionRoles.length > 0
    ? [...new Set(divisionRoles)]
    : [...new Set(Object.values(memberRoleMap).flat())]

  // 稅額計算（純 derived，每次 render 重新算，不放進 state 避免無限迴圈）
  const blockTaxMap: Record<string, ReturnType<typeof computeBlockTax>> = {}
  // 群組區塊的彙總顯示（key = blockId）
  const groupBlockSummary: Record<string, { taxBase: number; handling: number; taxAmount: number; total: number }> = {}
  for (const block of schema) {
    const groupRows = getGroupRows(block)
    if (groupRows.length > 0) {
      // 群組區塊：加總所有實例（使用儲存值，保留使用者手動修改的稅額）
      const groupSlots = groupRows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
      const taxSelectSlot = groupSlots.find(s => s.dataSource === 'tax_rates' && s.taxConfig)
      const baseFieldId = taxSelectSlot?.taxConfig?.baseFieldId ?? ''
      const taxAmtFieldId = taxSelectSlot?.taxConfig?.taxAmountFieldId
      const totalFieldId = taxSelectSlot?.taxConfig?.totalFieldId
      // 手續費 = 所有 number 欄位，排除費用、稅額、合計
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
    // Aggregate repeatable row values (summed) so tax calculation sees correct amounts
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

  // 稅額選擇欄位的目前值（用於 effect dep，避免監聽整個 fieldValues）
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
  // 每列稅額自動計算 + 總額彙總
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const taxSelectors = JSON.parse(taxSelectorStr) as Record<string, string>
    const fieldUpdates: Record<string, string> = {}
    const repeatableUpdates: Record<string, Record<string, string>[]> = {}

    for (const block of schema) {
      // 群組區塊的稅額在 render 時即時計算，不由此 effect 處理
      if (block.rows.some(r => r.rowGroupStart)) continue

      const allBlockSlots = block.rows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
      const taxSelectSlot = allBlockSlots.find(s => s.dataSource === 'tax_rates' && s.taxConfig)
      if (!taxSelectSlot?.taxConfig) continue

      const { baseFieldId, totalFieldId, taxAmountFieldId } = taxSelectSlot.taxConfig
      const selectedLabel = taxSelectors[taxSelectSlot.fieldId] ?? ''
      const selectedOption = taxRateOptions.find(o => o.label === selectedLabel)
      const feeRow = block.rows.find(r => r.repeatable && r.slots.some(s => s?.fieldId === baseFieldId))

      if (feeRow && taxAmountFieldId) {
        // 每列費用 → 同列稅額
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
        // 總額 = 所有列的 number 欄位加總
        const instancesToUse = repeatableUpdates[feeRow.id] ?? instances
        const rowNumberSlots = (feeRow.slots.filter(Boolean) as NonNullable<FormSlot>[]).filter(s => s.type === 'number')
        const total = instancesToUse.reduce((sum, inst) =>
          sum + rowNumberSlots.reduce((rowSum, s) => rowSum + (parseFloat(inst[s.fieldId] ?? '0') || 0), 0), 0)
        fieldUpdates[totalFieldId] = String(Math.floor(total))
      } else {
        // 非 repeatable fallback
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

    if (!isRepeatable) {
      if (fieldId === 'serial_number') {
        return <Input value="（送出後自動產生）" readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
      }
      if (fieldId === 'applicant' || dataSource === 'current_user_name') {
        return <Input value={applicantName} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
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
              }}
              options={divisions}
              required={required}
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
              }}
              options={sections}
              disabled={!divisionId}
              required={required}
            />
            {renderNoLeaderHint(sectionId, '課別')}
          </div>
        )
      }
      if (fieldId === 'apply_role') {
        const memberUnits = memberUnitIds
          .map(id => orgUnits.find(u => u.id === id))
          .filter((u): u is OrgUnit => u != null)
        const roleLabelFor = (u: OrgUnit) => {
          const roleTypeId = memberRoleTypeIdMap[u.id]
          const roleName = roleTypeId ? roleTypeNames[roleTypeId] : null
          return roleName ? `${unitLabel(u)} ${roleName}` : unitLabel(u)
        }
        return (
          <SearchableSelect
            value={fieldValues.apply_role ?? ''}
            onChange={v => {
              setField('apply_role', v)
              const unit = memberUnits.find(u => roleLabelFor(u) === v)
              if (unit) {
                const combos = deriveUserOrgCombos([unit.id], orgUnits)
                if (combos.length > 0) {
                  setDivisionId(combos[0].divisionId)
                  setSectionId(combos[0].sectionId)
                }
              }
            }}
            options={memberUnits.map(u => ({ value: roleLabelFor(u), label: roleLabelFor(u) }))}
            required={required}
          />
        )
      }
    }

    // 稅額選擇：從 taxRateOptions 取得選項
    if (type === 'select' && dataSource === 'tax_rates') {
      const options = taxRateOptions.map(o => ({ value: o.label, label: o.label }))
      return (
        <SearchableSelect
          value={values[fieldId] ?? ''}
          onChange={v => onChange(fieldId, v)}
          options={options}
          required={required}
          portal={isRepeatable}
        />
      )
    }



    if (type === 'radio') {
      return (
        <div style={{ display: 'flex', gap: 32, padding: '8px 0' }}>
          {(staticOptions ?? []).map(opt => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input type="radio" name={fieldId} value={opt} style={{ width: 18, height: 18 }}
                checked={values[fieldId] === opt}
                onChange={e => onChange(fieldId, e.target.value)}
                required={required && !values[fieldId]}
              />
              {opt}
            </label>
          ))}
        </div>
      )
    }

    if (type === 'select') {
      let options: { value: string; label: string }[] = []
      if (dataSource === 'static') {
        options = (staticOptions ?? []).map(o => ({ value: o, label: o }))
      } else if (dataSource.startsWith('dropdown_options:')) {
        const field = dataSource.replace('dropdown_options:', '')
        // 出款帳戶依可見範圍過濾：只留全公司可見或登入者所屬節點被涵蓋的帳戶（保留目前已選值避免遺失）
        options = (dropdownOptions[field] ?? [])
          .filter(o => field !== 'payment_account'
            || o.label === fieldValues.payment_account
            || isAccountVisibleToUser(o.visible_org_unit_ids, memberUnitIds, orgUnits))
          .map(o => ({ value: o.label, label: o.label }))
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
        <SearchableSelect
          value={values[fieldId] ?? ''}
          onChange={v => {
            onChange(fieldId, v)
            if (isMainFee) clearMismatchedDetailFees(v)
          }}
          options={options}
          placeholder={isDetailFee && !mainFeeValue ? `請先選擇${mainFeeSlot!.label}` : undefined}
          required={required}
          portal={isRepeatable}
        />
      )
    }

    if (type === 'attachment' && !isRepeatable) {
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
        <Textarea name={fieldId} value={values[fieldId] ?? ''}
          onChange={e => onChange(fieldId, e.target.value)}
          required={required} rows={4}
        />
      )
    }

    if (type === 'readonly') {
      const autoVal = dataSource === 'today_date' ? today()
        : dataSource === 'current_user_name' ? applicantName
        : dataSource === 'current_user_id' ? String(userId ?? '')
        : values[fieldId] ?? ''
      return <Input value={autoVal} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
    }

    if (type === 'date' && fieldId === 'date' && cycleConfig && cycleConfig.allowed_weekdays.length > 0) {
      return (
        <DateCyclePicker
          name={fieldId}
          value={values[fieldId] ?? ''}
          onChange={v => onChange(fieldId, v)}
          allowedWeekdays={cycleConfig.allowed_weekdays}
          weeksAhead={cycleConfig.weeks_ahead}
          required={required}
        />
      )
    }

    const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'
    const autoVal = dataSource === 'today_date' ? today() : undefined
    return (
      <Input type={inputType} name={fieldId}
        value={autoVal ?? values[fieldId] ?? ''}
        onChange={e => onChange(fieldId, e.target.value)}
        readOnly={!!autoVal} required={required}
        className={autoVal ? 'bg-[var(--bg-page)] cursor-not-allowed' : ''}
      />
    )
  }

  function renderField(slot: NonNullable<FormSlot>) {
    return renderFieldFor(slot, fieldValues, setField)
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

  function renderGroupInstances(block: FormBlock) {
    const groupRows = getGroupRows(block)
    if (groupRows.length === 0) return null
    const groupSlots = groupRows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
    const taxSelectSlot = groupSlots.find(s => s.dataSource === 'tax_rates' && s.taxConfig)
    const instances = groupInstances[block.id] ?? [{}]

    // 費用或稅額選擇改變時，自動帶入稅額（但不鎖定，使用者仍可手動覆寫）
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

    // 合計 = 其他數字欄位 + 已儲存的稅額（使用者可手動覆寫稅額）
    const totalFieldId = taxSelectSlot?.taxConfig?.totalFieldId
    const taxAmountFieldId = taxSelectSlot?.taxConfig?.taxAmountFieldId
    const otherNums = taxSelectSlot?.taxConfig
      ? groupSlots.filter(s => s.type === 'number' && s.fieldId !== totalFieldId && s.fieldId !== taxAmountFieldId)
      : []

    return (
      <GroupEditTable
        slots={groupSlots}
        instances={instances}
        selectOptionLabels={groupSelectOptionLabels}
        onAdd={() => addGroupInstance(block.id)}
        onRemove={instIdx => removeGroupInstance(block.id, instIdx)}
        renderCell={(slot, instValues, instIdx) => {
          // 合計唯讀（稅額 + 其他數字加總）
          if (totalFieldId && slot.fieldId === totalFieldId && slot.type === 'number') {
            const storedTax = taxAmountFieldId ? (parseFloat(instValues[taxAmountFieldId] ?? '0') || 0) : 0
            const computedTotal = otherNums.reduce((sum, s) => sum + (parseFloat(instValues[s.fieldId] ?? '0') || 0), 0) + storedTax
            return <Input value={String(computedTotal)} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
          }
          // 其他欄位（含稅額）：可編輯，費用/稅額選擇變動時自動帶入稅額
          return renderFieldFor(slot, instValues, (fid, val) => setInstFieldWithAutoTax(instIdx, fid, val), true)
        }}
      />
    )
  }

  function renderRepeatableRow(row: FormSchemaRow) {
    const instances = getRepeatableInstances(row.id)
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
            {instances.length > 1 && (
              <button type="button" onClick={() => removeRepeatableInstance(row.id, instIdx)}
                style={{ position: 'absolute', right: -76, top: '50%', transform: 'translateY(-50%)',
                  width: 56, padding: '4px 8px', fontSize: 12, border: '1px solid #fca5a5',
                  borderRadius: 6, background: 'var(--bg-card)', color: '#dc2626', cursor: 'pointer' }}>
                刪除
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => addRepeatableInstance(row.id)}
          style={{ padding: '6px 14px', fontSize: 13, border: '1.5px dashed #d1d5db',
            borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: 4 }}>
          ＋ 新增項目
        </button>
      </div>
    )
  }

  function buildPayload(status: 'draft' | 'pending') {
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
    // 群組重複資料
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
    return {
      date: fieldValues.date || today(),
      applicant: applicantName,
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
          // 幣別等其他 fee_records 欄位可能排在細項前面，必須以 label 含「費用項目」辨識（與主細項連動同一約定）
          const feeSlot = allThirdSlots.find(s => s.dataSource?.startsWith('fee_records:') && s.label.includes('費用項目'))
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
      status,
      flow_template_id: status === 'pending' ? flowTemplateId : null,
      current_step: status === 'pending' ? 1 : null,
      created_by: String(userId ?? ''),
    }
  }

  async function savePendingAttachments(allocationId: number) {
    const items = Object.values(pendingAttachments).flat()
    if (!items.length) return
    await saveAttachments(allocationId, null, items.map(i => ({
      slotLabel: i.slotLabel, fileName: i.fileName,
      storagePath: i.storagePath, fileType: i.fileType,
      uploadedBy: MOCK_USER_ID,
    })))
  }

  function buildTemplateFieldValues(): Record<string, string> {
    const values: Record<string, string> = { ...fieldValues }
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
    setSavingTemplate(true)
    const { error } = await saveUserFundTemplate(saveAsName.trim(), buildTemplateFieldValues())
    setSavingTemplate(false)
    if (!error) {
      setShowSaveAs(false)
      setSaveAsName('')
    }
  }

  async function handleUpdateTemplate() {
    if (!editTemplate) return
    setSavingTemplate(true); setError(null)
    const { error: updateError } = await updateUserFundTemplate(editTemplate.id, buildTemplateFieldValues())
    setSavingTemplate(false)
    if (updateError) { setError(updateError); return }
    router.push('/funds-allocation/my-funds')
  }

  async function handleDeleteTemplate() {
    if (!editTemplate) return
    setDeletingTemplate(true); setError(null)
    const { error: deleteError } = await deleteUserFundTemplate(editTemplate.id)
    setDeletingTemplate(false)
    if (deleteError) { setError(deleteError); return }
    router.push('/funds-allocation/my-funds')
  }

  async function handleSaveDraft() {
    setSavingDraft(true); setError(null)
    const { data, error: insertError } = await createFundsAllocation(buildPayload('draft'))
    setSavingDraft(false)
    if (insertError) { setError(insertError); return }
    if (data?.id) await savePendingAttachments(data.id)
    router.push('/funds-allocation/my-funds')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editTemplate) { handleUpdateTemplate(); return }
    const feeError = validateFeePositive(schema, fieldValues, repeatableValues, groupInstances)
    if (feeError) {
      setError(feeError) // 以中央彈窗顯示，不需再捲動頁面
      return
    }
    setSubmitting(true); setError(null)
    const serialNumber = await genSerialNumber(fieldValues['date'] || undefined)
    const { data, error: insertError } = await createFundsAllocation({ ...buildPayload('pending'), serial_number: serialNumber })
    if (insertError) { setError(insertError); setSubmitting(false); return }
    if (data?.id) await savePendingAttachments(data.id)
    router.push('/funds-allocation/my-funds')
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 32 }}>
        {editTemplate ? `編輯範本：${editTemplate.name}` : '新增資金分配申請單'}
      </h1>
      {/* 送出被擋（費用檢查等）改用全站共用中央彈窗：送出按鈕在長表單底部，頁頂紅字看不到 */}
      <ErrorDialog
        message={error ? (getChineseHint(error) ?? error) : null}
        title="無法送出"
        onClose={() => setError(null)}
      />
      <ConfirmDialog
        open={askDeleteTemplate}
        danger
        title="刪除範本"
        message={editTemplate ? `確定要刪除範本「${editTemplate.name}」嗎？刪除後無法復原。` : ''}
        confirmText="刪除"
        onConfirm={() => { setAskDeleteTemplate(false); handleDeleteTemplate() }}
        onCancel={() => setAskDeleteTemplate(false)}
      />

      <form onSubmit={handleSubmit}>
        {schema.filter(block => !block.showWhen || fieldValues[block.showWhen.fieldId] === block.showWhen.value).map(block => (
          <div key={block.id} style={{
            marginBottom: 28,
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            background: 'var(--bg-card)',
          }}>
            {(block.title || blockTaxMap[block.id] || groupBlockSummary[block.id]) && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 20px',
                background: 'var(--bg-sidebar)',
                borderBottom: '1px solid var(--border-color)',
                borderRadius: '9px 9px 0 0',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>{block.title ?? ''}</span>
                {(blockTaxMap[block.id] || groupBlockSummary[block.id]) && (() => {
                  const grpSummary = groupBlockSummary[block.id]
                  const blkSummary = blockTaxMap[block.id]
                  if (grpSummary) {
                    return (
                      <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>
                          費用 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(grpSummary.taxBase)}</strong>
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          手續費 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(grpSummary.handling)}</strong>
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          稅額 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(grpSummary.taxAmount)}</strong>
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          總額 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(grpSummary.total)}</strong>
                        </span>
                      </div>
                    )
                  }
                  return (
                    <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        費用 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(blkSummary!.taxBase)}</strong>
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        稅額 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(blkSummary!.taxAmount)}</strong>
                      </span>
                    </div>
                  )
                })()}
              </div>
            )}
            {/* 群組表格區塊左右內距縮為 24 讓 8 欄表格在筆電不用橫向捲動；右側留 96 只給可重複列的浮動刪除鈕用（群組列的刪除鈕已收進 GroupEditTable 行尾） */}
            <div style={{ paddingTop: 44, paddingLeft: block.rows.some(r => r.rowGroupStart) ? 24 : 48, paddingBottom: 16, paddingRight: block.rows.some(r => r.repeatable) ? 96 : block.rows.some(r => r.rowGroupStart) ? 24 : 48 }}>
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
                      // 有說明小字時橫式改頂端對齊：小字會把內容撐高，垂直置中會讓標籤對不上輸入框
                      const hasHint = !!slot.hint?.trim()
                      return verticalLayout ? (
                        <div key={idx}>
                          {labelNode}
                          <FieldHint hint={slot.hint} />
                          {renderField(slot)}
                        </div>
                      ) : (
                        <div key={idx} style={{ display: 'flex', alignItems: hasHint ? 'flex-start' : 'center', gap: 16 }}>
                          {hasHint ? <div style={{ paddingTop: 8 }}>{labelNode}</div> : labelNode}
                          <div style={{ flex: 1, minWidth: 0 }}><FieldHint hint={slot.hint} />{renderField(slot)}</div>
                        </div>
                      )
                    })}
                  </div>
                )
              )}
              {/* 群組列 */}
              {renderGroupInstances(block)}
            </div>
          </div>
        ))}

        {/* 審核流程顯示 */}
        {fieldValues.payment_account && (
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

        {editTemplate ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAskDeleteTemplate(true)}
              disabled={deletingTemplate || savingTemplate}
              style={{ color: '#dc2626', borderColor: '#fca5a5' }}
            >
              {deletingTemplate ? '刪除中...' : '刪除範本'}
            </Button>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
              <Button type="submit" disabled={savingTemplate || deletingTemplate}>
                {savingTemplate ? '儲存中...' : '儲存範本'}
              </Button>
            </div>
          </div>
        ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {showSaveAs ? (
              <>
                <input
                  value={saveAsName}
                  onChange={e => setSaveAsName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveAsTemplate()}
                  placeholder="輸入範本名稱"
                  style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: 160 }}
                  autoFocus
                />
                <Button type="button" variant="outline" onClick={handleSaveAsTemplate} disabled={savingTemplate || !saveAsName.trim()}>
                  {savingTemplate ? '儲存中...' : '確認'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowSaveAs(false); setSaveAsName('') }}>取消</Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setShowSaveAs(true)} disabled={savingDraft || submitting}>
                另存為我的範本
              </Button>
            )}
            <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={savingDraft || submitting}>
              {savingDraft ? '儲存中...' : '儲存草稿'}
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
            <Button type="submit" disabled={submitting || savingDraft || (!!fieldValues.payment_account && !flowTemplateId)}>
              {submitting ? '送出中...' : '確定送出'}
            </Button>
          </div>
        </div>
        )}
      </form>
    </div>
  )
}

function getChineseHint(error: string): string | null {
  if (/null value in column/.test(error)) return '有必填欄位未填寫，請確認所有標示星號（*）的欄位都已填入。'
  if (/duplicate key|unique constraint/.test(error)) return '資料重複，可能已有相同的申請紀錄，請確認後再試。'
  if (/foreign key constraint/.test(error)) return '選取的關聯資料不存在，請確認選項是否有效。'
  if (/permission denied/.test(error)) return '您沒有執行此操作的權限。'
  if (/JWT expired|invalid JWT|請先登入/.test(error)) return '登入已逾時，請重新整理頁面後重新登入。'
  if (/network|fetch|Failed to fetch/.test(error)) return '網路連線異常，請確認網路後再試。'
  return null
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text-body)', marginBottom: 10 }
