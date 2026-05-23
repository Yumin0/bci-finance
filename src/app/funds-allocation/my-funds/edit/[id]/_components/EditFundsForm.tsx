'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { FUNDS_STATUS, MOCK_USER_ID } from '@/lib/constants'
import { FundsAllocation, DropdownOption, ExpenseItem, OrgUnit, FormBlock, FormSlot, StepDecision } from '@/lib/types'
import { type StatusLabelConfig } from '@/lib/status-label-config'
import ApprovalPanel from '@/app/funds-allocation/_components/ApprovalPanel'
import StatusBadge from '@/app/_components/StatusBadge'
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
  const [orgUnitRoles, setOrgUnitRoles] = useState<RoleRow[]>([])
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, DropdownOption[]>>({})
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([])

  const [divisionId, setDivisionId] = useState<number | null>(null)
  const [sectionId, setSectionId] = useState<number | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [approvalDecision, setApprovalDecision] = useState<StepDecision>(null)
  const [approvalComment, setApprovalComment] = useState('')

  // 草稿送出時需要的審核流程資訊
  const [flowTemplateId, setFlowTemplateId] = useState<number | null>(record.flow_template_id ?? null)
  const [flowTemplateName, setFlowTemplateName] = useState<string | null>(null)

  const isDraft = record.status === FUNDS_STATUS.DRAFT
  const canEdit = isDraft || (record.status === FUNDS_STATUS.PENDING && record.current_step === 1)

  const allSlots: NonNullable<FormSlot>[] = schema.flatMap(b =>
    b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null))
  )
  const neededSources = new Set(allSlots.map(s => s.dataSource))

  function setField(id: string, val: string) {
    setFieldValues(prev => ({ ...prev, [id]: val }))
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
          if (record.apply_division) {
            const divUnit = units.find(u => u.level === '處' && unitLabel(u) === record.apply_division)
            if (divUnit) {
              setDivisionId(divUnit.id)
              if (record.apply_section) {
                const secUnit = units.find(u => u.level === '課' && unitLabel(u) === record.apply_section)
                if (secUnit) setSectionId(secUnit.id)
              }
            }
          }
        }
      }
      const loadOrgRoles = async () => {
        const r = await supabase.from('org_unit_roles').select('id, org_unit_id, display_name, role_types(name)').order('sort_order')
        if (r.data) setOrgUnitRoles(r.data as unknown as RoleRow[])
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
        fetches.push(loadOrgUnits(), loadOrgRoles())
      }
      const dropdownFields: string[] = []
      if (neededSources.has('dropdown_options:institution')) dropdownFields.push('institution')
      if (neededSources.has('dropdown_options:payment_account')) dropdownFields.push('payment_account')
      if (dropdownFields.length) fetches.push(loadDropdowns(dropdownFields))
      if (neededSources.has('expense_items')) fetches.push(loadExpenseItems())

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
        if (slot.fieldId.startsWith('custom_') && extraData[slot.label]) {
          customValues[slot.fieldId] = extraData[slot.label]
        }
      }
      setFieldValues({ ...catalogMap, ...customValues })
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id])

  const unitMap = new Map(orgUnits.map(u => [u.id, u]))
  const divisions = orgUnits.filter(u => u.level === '處')
  const sections = orgUnits.filter(u => u.level === '課' && u.parent_id === divisionId)
  const availableRoles = orgUnitRoles
    .filter(r => r.org_unit_id === sectionId)
    .map(r => r.display_name ?? `${unitLabel(unitMap.get(r.org_unit_id)!)} ${r.role_types.name}`)

  function renderField(slot: NonNullable<FormSlot>) {
    const { fieldId, required, type, dataSource, staticOptions } = slot
    const disabled = !canEdit

    if (fieldId === 'serial_number') {
      return <Input value={record.serial_number ?? '（自動產生）'} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
    }
    if (fieldId === 'applicant' || dataSource === 'current_user_name') {
      return <Input value={record.applicant ?? applicantName} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
    }
    if (fieldId === 'apply_division') {
      return (
        <select value={divisionId ?? ''} disabled={disabled}
          onChange={e => { setDivisionId(Number(e.target.value) || null); setSectionId(null); setField('apply_role', '') }}
          required={required} style={disabled ? readonlyStyle : selectStyle}>
          <option value="">請選擇</option>
          {divisions.map(u => <option key={u.id} value={u.id}>{unitLabel(u)}</option>)}
        </select>
      )
    }
    if (fieldId === 'apply_section') {
      return (
        <select value={sectionId ?? ''} disabled={disabled || !divisionId}
          onChange={e => { setSectionId(Number(e.target.value) || null); setField('apply_role', '') }}
          required={required} style={disabled ? readonlyStyle : selectStyle}>
          <option value="">請選擇</option>
          {sections.map(u => <option key={u.id} value={u.id}>{unitLabel(u)}</option>)}
        </select>
      )
    }
    if (fieldId === 'apply_role') {
      return (
        <select value={fieldValues.apply_role ?? ''} disabled={disabled || !sectionId}
          onChange={e => setField('apply_role', e.target.value)}
          required={required} style={disabled ? readonlyStyle : selectStyle}>
          <option value="">請選擇</option>
          {availableRoles.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      )
    }

    if (type === 'radio') {
      return (
        <div style={{ display: 'flex', gap: 20, padding: '8px 0' }}>
          {(staticOptions ?? []).map(opt => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer' }}>
              <input type="radio" name={fieldId} value={opt}
                checked={fieldValues[fieldId] === opt}
                onChange={e => !disabled && setField(fieldId, e.target.value)}
                disabled={disabled} required={required && !fieldValues[fieldId]} />
              {opt}
            </label>
          ))}
        </div>
      )
    }

    if (type === 'select') {
      let options: { value: string; label: string }[] = []
      if (dataSource === 'static') options = (staticOptions ?? []).map(o => ({ value: o, label: o }))
      else if (dataSource === 'expense_items') options = expenseItems.map(i => ({ value: i.label, label: i.label }))
      else if (dataSource.startsWith('dropdown_options:')) {
        options = (dropdownOptions[dataSource.replace('dropdown_options:', '')] ?? []).map(o => ({ value: o.label, label: o.label }))
      }
      return (
        <select value={fieldValues[fieldId] ?? ''} disabled={disabled}
          onChange={e => setField(fieldId, e.target.value)}
          required={required} style={disabled ? readonlyStyle : selectStyle}>
          <option value="">請選擇</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }

    if (type === 'textarea') {
      return (
        <Textarea value={fieldValues[fieldId] ?? ''} disabled={disabled}
          onChange={e => setField(fieldId, e.target.value)}
          required={required} rows={4}
          className={disabled ? 'bg-[var(--bg-page)]' : ''} />
      )
    }

    if (type === 'readonly') {
      return <Input value={fieldValues[fieldId] ?? ''} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
    }

    const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'
    return (
      <Input type={inputType} value={fieldValues[fieldId] ?? ''} disabled={disabled}
        onChange={e => setField(fieldId, e.target.value)}
        required={required}
        className={disabled ? 'bg-[var(--bg-page)]' : ''} />
    )
  }

  function buildUpdates() {
    const divUnit = orgUnits.find(u => u.id === divisionId)
    const secUnit = orgUnits.find(u => u.id === sectionId)
    const extraData: Record<string, string> = {}
    for (const slot of allSlots) {
      if (slot.fieldId.startsWith('custom_')) extraData[slot.label] = fieldValues[slot.fieldId] ?? ''
    }
    return {
      date: fieldValues.date || record.date,
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
      updated_at: new Date().toISOString(),
    }
  }

  async function handleDelete() {
    if (!confirm('確定要刪除此單據嗎？此操作無法復原。')) return
    setSubmitting(true)
    const { error: deleteError } = await supabase.from('funds_allocation').delete().eq('id', record.id)
    if (deleteError) { setError(deleteError.message); setSubmitting(false); return }
    router.push('/funds-allocation/my-funds')
  }

  async function handleSaveDraft() {
    setSavingDraft(true); setError(null)
    const { error: updateError } = await supabase.from('funds_allocation')
      .update({ ...buildUpdates(), status: 'draft', flow_template_id: null, current_step: null })
      .eq('id', record.id)
    setSavingDraft(false)
    if (updateError) { setError(updateError.message); return }
    router.push('/funds-allocation/my-funds')
  }

  async function handleSubmitFromDraft(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true); setError(null)
    const { error: updateError } = await supabase.from('funds_allocation')
      .update({ ...buildUpdates(), status: 'pending', flow_template_id: flowTemplateId, current_step: 1 })
      .eq('id', record.id)
    if (updateError) { setError(updateError.message); setSubmitting(false); return }
    router.push('/funds-allocation/my-funds')
  }

  async function handleSaveChanges(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true); setError(null)
    const { error: updateError } = await supabase.from('funds_allocation').update(buildUpdates()).eq('id', record.id)
    if (updateError) { setError(updateError.message); setSubmitting(false); return }
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
        {schema.map(block => (
          <div key={block.id} style={{ marginBottom: 16, border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)' }}>
            {block.title && (
              <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>{block.title}</span>
              </div>
            )}
            <div style={{ padding: '20px 20px 4px' }}>
              {block.rows.map(row => (
                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: `repeat(${row.cols}, 1fr)`, gap: 20, marginBottom: 20 }}>
                  {row.slots.map((slot, idx) => slot ? (
                    <div key={idx}>
                      <label style={labelStyle}>
                        {slot.label}
                        {slot.required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                      </label>
                      {renderField(slot)}
                    </div>
                  ) : <div key={idx} />)}
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
const selectStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--btn-border)', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', background: 'white', cursor: 'pointer' }
const readonlyStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--btn-border)', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', background: 'var(--bg-page)', cursor: 'not-allowed' }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginBottom: 12 }
