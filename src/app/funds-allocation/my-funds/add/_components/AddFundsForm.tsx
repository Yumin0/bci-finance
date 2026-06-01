'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { MOCK_USER_ID } from '@/lib/constants'
import { createFundsAllocation, generateSerialNumber as genSerialNumber } from '@/app/actions/funds-allocation'
import { DropdownOption, ExpenseItem, OrgUnit, FormBlock, FormSchemaRow, FormSlot, TaxRateOption } from '@/lib/types'
import { computeBlockTax, formatTaxNumber } from '@/lib/taxUtils'
import { getTaxRateOptions } from '@/app/actions/tax-rates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import AttachmentUpload, { AttachmentItem } from '@/app/_components/AttachmentUpload'
import { saveAttachments } from '@/app/actions/attachments'
import { saveUserFundTemplate } from '@/app/actions/fund-templates'
import DateCyclePicker from '@/app/_components/DateCyclePicker'
import { ApplicationCycleConfig } from '@/app/actions/application-cycle'

type RoleRow = { id: number; org_unit_id: number; display_name: string | null; role_types: { name: string } }

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
}: {
  applicantName: string
  userId: number | null
  schema: FormBlock[]
  initialValues?: Record<string, string>
  cycleConfig?: ApplicationCycleConfig
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Data source state
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [orgUnitRoles, setOrgUnitRoles] = useState<RoleRow[]>([])
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, DropdownOption[]>>({})
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([])
  const [userPositionRoleIds, setUserPositionRoleIds] = useState<number[]>([])
  const [dynamicSelectOptions, setDynamicSelectOptions] = useState<Record<string, { value: string; label: string }[]>>({})

  // Cascade state for org units — initialised from template if provided
  const [divisionId, setDivisionId] = useState<number | null>(() =>
    Number(initialValues?.apply_division) || null
  )
  const [sectionId, setSectionId] = useState<number | null>(() =>
    Number(initialValues?.apply_section) || null
  )

  // Generic field values — initialised from template, excluding cascade ID keys
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    if (!initialValues) return {}
    const { apply_division, apply_section, ...rest } = initialValues
    void apply_division; void apply_section
    return rest
  })

  // 審核流程（根據出款帳號自動帶入）
  const [flowTemplateId, setFlowTemplateId] = useState<number | null>(null)
  const [flowTemplateName, setFlowTemplateName] = useState<string | null>(null)

  // 附件（key = slot.label）
  const [pendingAttachments, setPendingAttachments] = useState<Record<string, AttachmentItem[]>>({})

  // 可重複列資料（key = rowId, value = 每筆的欄位值陣列）
  const [repeatableValues, setRepeatableValues] = useState<Record<string, Record<string, string>[]>>({})

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

      const loadOrgUnits = async () => {
        const r = await supabase.from('org_units').select('*').order('sort_order')
        if (r.data) setOrgUnits(r.data as OrgUnit[])
      }
      const loadOrgRoles = async () => {
        const r = await supabase.from('org_unit_roles')
          .select('id, org_unit_id, display_name, role_types(name)')
          .order('sort_order')
        if (r.data) setOrgUnitRoles(r.data as unknown as RoleRow[])
      }
      const loadPositions = async () => {
        if (!userId) return
        const r = await supabase.from('user_positions').select('org_unit_role_id').eq('user_id', userId)
        if (r.data) setUserPositionRoleIds(r.data.map((p: { org_unit_role_id: number }) => p.org_unit_role_id))
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
      const loadExpenseItems = async () => {
        const r = await supabase.from('expense_items').select('*').order('sort_order')
        if (r.data) setExpenseItems(r.data as ExpenseItem[])
      }

      if (neededSources.has('org_units:division') || neededSources.has('org_units:section') || neededSources.has('org_unit_roles')) {
        fetches.push(loadOrgUnits(), loadOrgRoles(), loadPositions())
      }

      const dropdownFields: string[] = []
      if (neededSources.has('dropdown_options:institution')) dropdownFields.push('institution')
      if (neededSources.has('dropdown_options:payment_account')) dropdownFields.push('payment_account')
      if (dropdownFields.length) fetches.push(loadDropdowns(dropdownFields))

      if (neededSources.has('expense_items')) fetches.push(loadExpenseItems())

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
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Derived cascade values
  const unitMap = new Map(orgUnits.map(u => [u.id, u]))
  const userDivisionIds: Set<number> = (() => {
    if (!userId || !userPositionRoleIds.length) return new Set()
    const ids = new Set<number>()
    for (const roleId of userPositionRoleIds) {
      const role = orgUnitRoles.find(r => r.id === roleId)
      if (!role) continue
      const unit = unitMap.get(role.org_unit_id)
      if (!unit) continue
      if (unit.level === '處') ids.add(unit.id)
      else if (unit.level === '課' && unit.parent_id != null) ids.add(unit.parent_id)
    }
    return ids
  })()

  const divisions = orgUnits.filter(u => u.level === '處' && (userDivisionIds.size === 0 || userDivisionIds.has(u.id)))
  const sections = orgUnits.filter(u => u.level === '課' && u.parent_id === divisionId)
  const availableRoles = orgUnitRoles
    .filter(r => r.org_unit_id === sectionId)
    .map(r => r.display_name ?? (unitMap.get(r.org_unit_id) ? `${unitLabel(unitMap.get(r.org_unit_id)!)} ${r.role_types.name}` : r.role_types.name))

  // 稅額計算（純 derived，每次 render 重新算，不放進 state 避免無限迴圈）
  const blockTaxMap: Record<string, ReturnType<typeof computeBlockTax>> = {}
  for (const block of schema) {
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
          <SearchableSelect
            value={String(divisionId ?? '')}
            onChange={v => { setDivisionId(Number(v) || null); setSectionId(null); setField('apply_role', '') }}
            options={divisions.map(u => ({ value: String(u.id), label: unitLabel(u) }))}
            required={required}
          />
        )
      }
      if (fieldId === 'apply_section') {
        return (
          <SearchableSelect
            value={String(sectionId ?? '')}
            onChange={v => { setSectionId(Number(v) || null); setField('apply_role', '') }}
            options={sections.map(u => ({ value: String(u.id), label: unitLabel(u) }))}
            disabled={!divisionId}
            required={required}
          />
        )
      }
      if (fieldId === 'apply_role') {
        return (
          <SearchableSelect
            value={fieldValues.apply_role ?? ''}
            onChange={v => setField('apply_role', v)}
            options={availableRoles.map(name => ({ value: name, label: name }))}
            disabled={!sectionId}
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
        />
      )
    }

    // 總額欄位：自動計算，唯讀
    if (computedTotals[fieldId] !== undefined) {
      return <Input value={computedTotals[fieldId]} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
    }

    if (type === 'radio') {
      return (
        <div style={{ display: 'flex', gap: 20, padding: '8px 0' }}>
          {(staticOptions ?? []).map(opt => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
              <input type="radio" name={fieldId} value={opt}
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
      } else if (dataSource === 'expense_items') {
        options = expenseItems.map(i => ({ value: i.label, label: i.label }))
      } else if (dataSource.startsWith('dropdown_options:')) {
        const field = dataSource.replace('dropdown_options:', '')
        options = (dropdownOptions[field] ?? []).map(o => ({ value: o.label, label: o.label }))
      } else if (dataSource.startsWith('fee_records:') || dataSource.startsWith('payee_records:')) {
        options = dynamicSelectOptions[dataSource] ?? []
      }
      return (
        <SearchableSelect
          value={values[fieldId] ?? ''}
          onChange={v => onChange(fieldId, v)}
          options={options}
          required={required}
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

  function renderRepeatableRow(row: FormSchemaRow) {
    const instances = getRepeatableInstances(row.id)
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${row.cols}, 1fr) 56px`, gap: 12, marginBottom: 6 }}>
          {row.slots.map((slot, idx) =>
            slot ? (
              <label key={idx} style={labelStyle}>
                {slot.label}{slot.required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
              </label>
            ) : <div key={idx} />
          )}
          <div />
        </div>
        {instances.map((instValues, instIdx) => (
          <div key={instIdx} style={{ display: 'grid', gridTemplateColumns: `repeat(${row.cols}, 1fr) 56px`, gap: 12, marginBottom: 8, alignItems: 'center' }}>
            {row.slots.map((slot, slotIdx) =>
              slot ? (
                <div key={slotIdx}>
                  {renderFieldFor(slot, instValues, (fid, val) => setRepeatableField(row.id, instIdx, fid, val), true)}
                </div>
              ) : <div key={slotIdx} />
            )}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {instances.length > 1 && (
                <button type="button" onClick={() => removeRepeatableInstance(row.id, instIdx)}
                  style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #fca5a5',
                    borderRadius: 6, background: 'white', color: '#dc2626', cursor: 'pointer' }}>
                  刪除
                </button>
              )}
            </div>
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
      if (slot.fieldId.startsWith('custom_') && !repeatableSlotFieldIds.has(slot.fieldId)) {
        extraData[slot.label] = computedTotals[slot.fieldId] ?? fieldValues[slot.fieldId] ?? ''
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
    return {
      date: fieldValues.date || today(),
      applicant: applicantName,
      apply_division: divUnit ? unitLabel(divUnit) : (fieldValues.apply_division ?? null),
      apply_section: secUnit ? unitLabel(secUnit) : (fieldValues.apply_section ?? null),
      apply_role: fieldValues.apply_role || null,
      institution: fieldValues.institution || null,
      payment_account: fieldValues.payment_account || null,
      expense_item: fieldValues.expense_item || null,
      name: fieldValues.name || null,
      amount: Number(fieldValues.amount) || 0,
      category: fieldValues.category || null,
      note: fieldValues.note || null,
      extra_data: extraData,
      status,
      flow_template_id: status === 'pending' ? flowTemplateId : null,
      current_step: status === 'pending' ? 1 : null,
      created_by: MOCK_USER_ID,
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

  async function handleSaveAsTemplate() {
    if (!saveAsName.trim()) return
    setSavingTemplate(true)
    const { error } = await saveUserFundTemplate(saveAsName.trim(), fieldValues)
    setSavingTemplate(false)
    if (!error) {
      setShowSaveAs(false)
      setSaveAsName('')
    }
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
    setSubmitting(true); setError(null)
    const serialNumber = await genSerialNumber()
    const { data, error: insertError } = await createFundsAllocation({ ...buildPayload('pending'), serial_number: serialNumber })
    if (insertError) { setError(insertError); setSubmitting(false); return }
    if (data?.id) await savePendingAttachments(data.id)
    router.push('/funds-allocation/my-funds')
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>新增資金分配申請單</h1>
      {error && <p style={errorStyle}>送出失敗：{error}</p>}

      <form onSubmit={handleSubmit}>
        {schema.filter(block => !block.showWhen || fieldValues[block.showWhen.fieldId] === block.showWhen.value).map(block => (
          <div key={block.id} style={{
            marginBottom: 16,
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            background: 'var(--bg-card)',
          }}>
            {(block.title || blockTaxMap[block.id]) && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 20px',
                background: 'var(--bg-sidebar)',
                borderBottom: '1px solid var(--border-color)',
                borderRadius: '9px 9px 0 0',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>{block.title ?? ''}</span>
                {blockTaxMap[block.id] && (() => {
                  const info = blockTaxMap[block.id]!
                  return (
                    <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        費用 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(info.taxBase)}</strong>
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        稅額 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(info.taxAmount)}</strong>
                      </span>
                    </div>
                  )
                })()}
              </div>
            )}
            <div style={{ padding: '20px 20px 4px' }}>
              {block.rows.map(row =>
                row.repeatable ? (
                  <div key={row.id}>{renderRepeatableRow(row)}</div>
                ) : (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: `repeat(${row.cols}, 1fr)`, gap: 20, marginBottom: 20 }}>
                    {row.slots.map((slot, idx) => {
                      if (slot && slot.showWhen && !slot.showWhen.values.includes(fieldValues[slot.showWhen.fieldId] ?? '')) {
                        return <div key={idx} />
                      }
                      return slot ? (
                        <div key={idx}>
                          <label style={labelStyle}>
                            {slot.label}
                            {slot.required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                            {computedTotalHints[slot.fieldId] && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, fontWeight: 400 }}>{computedTotalHints[slot.fieldId]}</span>}
                          </label>
                          {renderField(slot)}
                        </div>
                      ) : <div key={idx} />
                    })}
                  </div>
                )
              )}
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

        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
          <Button type="submit" disabled={submitting || savingDraft || (!!fieldValues.payment_account && !flowTemplateId)}>
            {submitting ? '送出中...' : '確定送出'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
        </div>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginBottom: 12 }
