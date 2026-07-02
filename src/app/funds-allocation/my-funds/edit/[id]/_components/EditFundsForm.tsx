'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { FUNDS_STATUS, MOCK_USER_ID } from '@/lib/constants'
import { FundsAllocation, DropdownOption, OrgUnit, FormBlock, FormSchemaRow, FormSlot, StepDecision, TaxRateOption } from '@/lib/types'
import { computeBlockTax, formatTaxNumber, applyTaxFormula } from '@/lib/taxUtils'
import { deriveUserOrgCombos, divisionOptionsFromCombos, sectionOptionsFromCombos, allDivisionOptions, allSectionOptions } from '@/lib/orgPositions'
import { getTaxRateOptions } from '@/app/actions/tax-rates'
import { type StatusLabelConfig } from '@/lib/status-label-config'
import ApprovalPanel from '@/app/funds-allocation/_components/ApprovalPanel'
import StatusBadge from '@/app/_components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import AttachmentUpload, { AttachmentItem } from '@/app/_components/AttachmentUpload'
import { getAttachmentsByAllocationId, saveAttachments, deleteAttachmentRecord } from '@/app/actions/attachments'
import { deleteFundsAllocation, updateFundsAllocation } from '@/app/actions/funds-allocation'


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
}: {
  record: FundsAllocation
  schema: FormBlock[]
  applicantName: string
  userId: number | null
  labelConfig: StatusLabelConfig
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [memberUnitIds, setMemberUnitIds] = useState<number[]>([])
  const [memberRoleMap, setMemberRoleMap] = useState<Record<number, string[]>>({})
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, DropdownOption[]>>({})
  const [dynamicSelectOptions, setDynamicSelectOptions] = useState<Record<string, { value: string; label: string }[]>>({})

  const [divisionId, setDivisionId] = useState<number | null>(null)
  const [sectionId, setSectionId] = useState<number | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [approvalDecision, setApprovalDecision] = useState<StepDecision>(null)
  const [approvalComment, setApprovalComment] = useState('')

  // 附件
  const [existingAttachments, setExistingAttachments] = useState<AttachmentItem[]>([])
  const [newAttachments, setNewAttachments] = useState<AttachmentItem[]>([])
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([])

  // 草稿送出時需要的審核流程資訊
  const [flowTemplateId, setFlowTemplateId] = useState<number | null>(record.flow_template_id ?? null)
  const [flowTemplateName, setFlowTemplateName] = useState<string | null>(null)

  const isDraft = record.status === FUNDS_STATUS.DRAFT
  const canEdit = isDraft || (record.status === FUNDS_STATUS.PENDING && record.current_step === 1)

  const allSlots: NonNullable<FormSlot>[] = schema.flatMap(b =>
    b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null))
  )
  const allRows = schema.flatMap(b => b.rows)
  const repeatableSlotFieldIds = new Set(
    allRows.filter(r => r.repeatable).flatMap(r => r.slots.filter(Boolean).map(s => s!.fieldId))
  )
  const neededSources = new Set(allSlots.map(s => s.dataSource))

  const [repeatableValues, setRepeatableValues] = useState<Record<string, Record<string, string>[]>>({})
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
          setMemberUnitIds(rows.map(m => m.org_unit_id))
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
        fetches.push(loadOrgUnits(), loadMyMemberships())
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
  const userCombos = deriveUserOrgCombos(memberUnitIds, orgUnits)
  const divisions = userCombos.length > 0 ? divisionOptionsFromCombos(userCombos) : allDivisionOptions(orgUnits)
  if (divisionId != null && !divisions.some(d => d.value === String(divisionId))) {
    const u = unitMap.get(divisionId)
    if (u) divisions.push({ value: String(u.id), label: unitLabel(u) })
  }
  const sections = userCombos.length > 0 ? sectionOptionsFromCombos(userCombos, divisionId) : allSectionOptions(orgUnits, divisionId)
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
  for (const block of schema) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const taxSelectors = JSON.parse(taxSelectorStr) as Record<string, string>
    const fieldUpdates: Record<string, string> = {}
    const repeatableUpdates: Record<string, Record<string, string>[]> = {}

    for (const block of schema) {
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
  }, [repeatableValues, taxSelectorStr, taxRateOptions])

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
        )
      }
      if (fieldId === 'apply_section') {
        return (
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
        <div style={{ display: 'flex', gap: 20, padding: '8px 0' }}>
          {(staticOptions ?? []).map(opt => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer' }}>
              <input type="radio" name={fieldId} value={opt}
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
      return (
        <SearchableSelect value={values[fieldId] ?? ''} onChange={v => onChange(fieldId, v)}
          options={options} disabled={disabled} required={required} />
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
                  borderRadius: 6, background: 'white', color: '#dc2626', cursor: 'pointer' }}>
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
      if (slot.fieldId.startsWith('custom_') && !repeatableSlotFieldIds.has(slot.fieldId)) {
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
    return {
      date: fieldValues.date || record.date,
      apply_division: divUnit ? unitLabel(divUnit) : (fieldValues.apply_division ?? null),
      apply_section: secUnit ? unitLabel(secUnit) : (fieldValues.apply_section ?? null),
      apply_division_id: divisionId,
      apply_section_id: sectionId,
      apply_role: fieldValues.apply_role || null,
      institution: fieldValues.institution || null,
      payment_account: fieldValues.payment_account || null,
      expense_item: fieldValues.expense_item || null,
      name: fieldValues.name || null,
      amount: Number(fieldValues.amount) || 0,
      category: fieldValues.category || null,
      note: fieldValues.note || null,
      extra_data: extraData,
      updated_at: new Date().toISOString(),
    }
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
    setSubmitting(true); setError(null)
    const { error: updateError } = await updateFundsAllocation(record.id, buildUpdates())
    if (updateError) { setError(updateError); setSubmitting(false); return }
    await persistAttachmentChanges()
    router.push('/funds-allocation/my-funds')
  }

  const stepName = (() => {
    if (record.status === 'pending') return null  // step name handled by list page
    return null
  })()

  return (
    <div>
      {/* 標題列 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>
            {isDraft ? '編輯資金分配申請單' : '資金分配申請單'}
          </h1>
          <StatusBadge module="funds_allocation" status={record.status} stepName={stepName} labelConfig={labelConfig} />
        </div>
        {canEdit && (
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
          <div key={block.id} style={{ marginBottom: 16, border: '1px solid var(--border-color)', borderRadius: 10, background: 'var(--bg-card)' }}>
            {(block.title || blockTaxMap[block.id]) && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--border-color)', borderRadius: '9px 9px 0 0', background: 'var(--bg-sidebar)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>{block.title ?? ''}</span>
                {blockTaxMap[block.id] && (() => {
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
            <div style={{ paddingTop: 20, paddingLeft: 20, paddingBottom: 4, paddingRight: block.rows.some(r => r.repeatable) ? 96 : 20 }}>
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
              ))}
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

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {isDraft && (
            <>
              <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={savingDraft || submitting}>
                {savingDraft ? '儲存中...' : '儲存草稿'}
              </Button>
              <Button type="submit" disabled={submitting || savingDraft || (!!fieldValues.payment_account && !flowTemplateId)}>
                {submitting ? '送出中...' : '確定送出'}
              </Button>
            </>
          )}
          {!isDraft && canEdit && (
            <Button type="submit" disabled={submitting}>{submitting ? '儲存中...' : '儲存變更'}</Button>
          )}
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {isDraft ? '取消' : '返回'}
          </Button>
          {record.status === FUNDS_STATUS.APPROVED && record.current_step === null && (
            <Button type="button" onClick={() => router.push(`/funds-payment/my-payment/add/${record.id}`)}>
              建立付款憑單
            </Button>
          )}
        </div>
      </form>

      {!isDraft && (
        <div style={{ marginTop: 40 }}>
          <ApprovalPanel
            record={record}
            currentStep={((record.current_step ?? 1) as 1 | 2 | 3 | 4 | 5)}
            canReview={false}
            decision={approvalDecision}
            comment={approvalComment}
            submitting={false}
            onDecisionChange={setApprovalDecision}
            onCommentChange={setApprovalComment}
            onSubmit={() => {}}
          />
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginBottom: 12 }
