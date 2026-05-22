'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { FUNDS_STATUS, MOCK_USER_ID } from '@/lib/constants'
import { DropdownOption, ExpenseItem, OrgUnit, FormBlock, FormSlot } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

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
}: {
  applicantName: string
  userId: number | null
  schema: FormBlock[]
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data source state
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [orgUnitRoles, setOrgUnitRoles] = useState<RoleRow[]>([])
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, DropdownOption[]>>({})
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([])
  const [userPositionRoleIds, setUserPositionRoleIds] = useState<number[]>([])

  // Cascade state for org units
  const [divisionId, setDivisionId] = useState<number | null>(null)
  const [sectionId, setSectionId] = useState<number | null>(null)

  // Generic field values (for non-cascade fields)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})

  // 審核流程（根據出款帳號自動帶入）
  const [flowTemplateId, setFlowTemplateId] = useState<number | null>(null)
  const [flowTemplateName, setFlowTemplateName] = useState<string | null>(null)

  // Collect which data sources are needed
  const allSlots: NonNullable<FormSlot>[] = schema.flatMap(b =>
    b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null))
  )
  const neededSources = new Set(allSlots.map(s => s.dataSource))

  const setField = useCallback((id: string, val: string) => {
    setFieldValues(prev => ({ ...prev, [id]: val }))
  }, [])

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
    .map(r => r.display_name ?? `${unitLabel(unitMap.get(r.org_unit_id)!)} ${r.role_types.name}`)

  function renderField(slot: NonNullable<FormSlot>) {
    const { fieldId, label: _label, required, type, dataSource, staticOptions } = slot

    // Catalog fields with special behavior
    if (fieldId === 'applicant' || dataSource === 'current_user_name') {
      return <Input value={applicantName} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
    }
    if (fieldId === 'apply_division') {
      return (
        <select
          value={divisionId ?? ''}
          onChange={e => { setDivisionId(Number(e.target.value) || null); setSectionId(null); setField('apply_role', '') }}
          required={required}
          style={selectStyle}
        >
          <option value="">請選擇</option>
          {divisions.map(u => <option key={u.id} value={u.id}>{unitLabel(u)}</option>)}
        </select>
      )
    }
    if (fieldId === 'apply_section') {
      return (
        <select
          value={sectionId ?? ''}
          onChange={e => { setSectionId(Number(e.target.value) || null); setField('apply_role', '') }}
          disabled={!divisionId}
          required={required}
          style={selectStyle}
        >
          <option value="">請選擇</option>
          {sections.map(u => <option key={u.id} value={u.id}>{unitLabel(u)}</option>)}
        </select>
      )
    }
    if (fieldId === 'apply_role') {
      return (
        <select
          value={fieldValues.apply_role ?? ''}
          onChange={e => setField('apply_role', e.target.value)}
          disabled={!sectionId}
          required={required}
          style={selectStyle}
        >
          <option value="">請選擇</option>
          {availableRoles.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      )
    }

    // Generic rendering by type
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

    if (type === 'select') {
      let options: { value: string; label: string }[] = []
      if (dataSource === 'static') {
        options = (staticOptions ?? []).map(o => ({ value: o, label: o }))
      } else if (dataSource === 'expense_items') {
        options = expenseItems.map(i => ({ value: i.label, label: i.label }))
      } else if (dataSource.startsWith('dropdown_options:')) {
        const field = dataSource.replace('dropdown_options:', '')
        options = (dropdownOptions[field] ?? []).map(o => ({ value: o.label, label: o.label }))
      }
      return (
        <select
          name={fieldId}
          value={fieldValues[fieldId] ?? ''}
          onChange={e => setField(fieldId, e.target.value)}
          required={required}
          style={selectStyle}
        >
          <option value="">請選擇</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }

    if (type === 'textarea') {
      return (
        <Textarea
          name={fieldId}
          value={fieldValues[fieldId] ?? ''}
          onChange={e => setField(fieldId, e.target.value)}
          required={required}
          rows={4}
        />
      )
    }

    if (type === 'readonly') {
      const autoVal = dataSource === 'today_date' ? today()
        : dataSource === 'current_user_name' ? applicantName
        : dataSource === 'current_user_id' ? String(userId ?? '')
        : fieldValues[fieldId] ?? ''
      return <Input value={autoVal} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
    }

    // text / number / date
    const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'
    const autoVal = dataSource === 'today_date' ? today() : undefined
    return (
      <Input
        type={inputType}
        name={fieldId}
        value={autoVal ?? fieldValues[fieldId] ?? ''}
        onChange={e => setField(fieldId, e.target.value)}
        readOnly={!!autoVal}
        required={required}
        className={autoVal ? 'bg-[var(--bg-page)] cursor-not-allowed' : ''}
      />
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const divUnit = orgUnits.find(u => u.id === divisionId)
    const secUnit = orgUnits.find(u => u.id === sectionId)

    // Separate catalog fields from custom fields
    const catalogIds = new Set([
      'date', 'apply_division', 'apply_section', 'applicant', 'apply_role',
      'institution', 'payment_account', 'expense_item', 'name', 'amount', 'category', 'note',
    ])

    const extraData: Record<string, string> = {}
    for (const slot of allSlots) {
      if (!catalogIds.has(slot.fieldId) && slot.fieldId.startsWith('custom_')) {
        const val = slot.type === 'radio'
          ? fieldValues[slot.fieldId] ?? ''
          : fieldValues[slot.fieldId] ?? ''
        extraData[slot.label] = val
      }
    }

    const data = {
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
      status: FUNDS_STATUS.PENDING,
      flow_template_id: flowTemplateId,
      current_step: 1,
      created_by: MOCK_USER_ID,
    }

    const { error: insertError } = await supabase.from('funds_allocation').insert(data)
    if (insertError) { setError(insertError.message); setSubmitting(false); return }
    router.push('/funds-allocation/my-funds')
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>新增資金分配申請單</h1>
      {error && <p style={errorStyle}>送出失敗：{error}</p>}

      <form onSubmit={handleSubmit}>
        {schema.map(block => (
          <div key={block.id} style={{
            marginBottom: 16,
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            {block.title && (
              <div style={{
                padding: '10px 20px',
                background: 'var(--bg-sidebar)',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>{block.title}</span>
              </div>
            )}
            <div style={{ padding: '20px 20px 4px' }}>
              {block.rows.map(row => (
                <div
                  key={row.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${row.cols}, 1fr)`,
                    gap: 20,
                    marginBottom: 20,
                  }}
                >
                  {row.slots.map((slot, idx) => slot ? (
                    <div key={idx}>
                      <label style={labelStyle}>
                        {slot.label}
                        {slot.required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                      </label>
                      {renderField(slot)}
                    </div>
                  ) : (
                    <div key={idx} />
                  ))}
                </div>
              ))}
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

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button type="submit" disabled={submitting || (!!fieldValues.payment_account && !flowTemplateId)}>
            {submitting ? '送出中...' : '送出申請'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
        </div>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const selectStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--btn-border)', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', background: 'white', cursor: 'pointer' }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginBottom: 12 }
