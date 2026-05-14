'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { MOCK_USER_ID, FUNDS_STATUS } from '@/lib/constants'
import { DropdownOption, ExpenseItem, OrgUnit } from '@/lib/types'

type RoleRow = { id: number; org_unit_id: number; display_name: string | null; role_types: { name: string } }

function unitLabel(u: OrgUnit) {
  return [u.code, u.name].filter(Boolean).join(' ')
}

export default function AddFundsForm({ applicantName, userId }: { applicantName: string; userId: number | null }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, DropdownOption[]>>({
    institution: [],
    payment_account: [],
  })
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([])
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [orgUnitRoles, setOrgUnitRoles] = useState<RoleRow[]>([])
  const [userPositionRoleIds, setUserPositionRoleIds] = useState<number[]>([])
  const [divisionId, setDivisionId] = useState<number | null>(null)
  const [sectionId, setSectionId] = useState<number | null>(null)
  const [roleDisplayName, setRoleDisplayName] = useState('')

  // 從使用者的職位往上找所屬的「處」id
  const userDivisionIds: Set<number> = (() => {
    if (!userId || userPositionRoleIds.length === 0) return new Set()
    const unitMap = new Map(orgUnits.map(u => [u.id, u]))
    const ids = new Set<number>()
    for (const roleId of userPositionRoleIds) {
      const role = orgUnitRoles.find(r => r.id === roleId)
      if (!role) continue
      const unit = unitMap.get(role.org_unit_id)
      if (!unit) continue
      if (unit.level === '處') ids.add(unit.id)
      else if (unit.level === '課' && unit.parent_id != null) ids.add(unit.parent_id)
      else if (unit.level === '科' && unit.parent_id != null) {
        const section = unitMap.get(unit.parent_id)
        if (section?.parent_id != null) ids.add(section.parent_id)
      }
    }
    return ids
  })()

  const divisions = orgUnits.filter(u =>
    u.level === '處' && (userDivisionIds.size === 0 || userDivisionIds.has(u.id))
  )
  const sections = orgUnits.filter(u => u.level === '課' && u.parent_id === divisionId)
  const availableRoles = orgUnitRoles
    .filter(r => r.org_unit_id === sectionId)
    .map(r => {
      if (r.display_name) return r.display_name
      const unit = orgUnits.find(u => u.id === r.org_unit_id)
      return unit ? `${unitLabel(unit)} ${r.role_types.name}` : r.role_types.name
    })

  useEffect(() => {
    async function loadOptions() {
      const [optRes, expRes, unitsRes, rolesRes] = await Promise.all([
        supabase.from('dropdown_options').select('*').order('sort_order'),
        supabase.from('expense_items').select('*').order('sort_order'),
        supabase.from('org_units').select('*').order('sort_order'),
        supabase.from('org_unit_roles').select('id, org_unit_id, display_name, role_types(name)').order('sort_order'),
      ])
      if (optRes.data) {
        const grouped: Record<string, DropdownOption[]> = { institution: [], payment_account: [] }
        for (const opt of optRes.data as DropdownOption[]) grouped[opt.field]?.push(opt)
        setDropdownOptions(grouped)
      }
      if (expRes.data) setExpenseItems(expRes.data as ExpenseItem[])
      if (unitsRes.data) setOrgUnits(unitsRes.data as OrgUnit[])
      if (rolesRes.data) setOrgUnitRoles(rolesRes.data as unknown as RoleRow[])

      if (userId) {
        const { data: posData } = await supabase
          .from('user_positions')
          .select('org_unit_role_id')
          .eq('user_id', userId)
        if (posData) setUserPositionRoleIds(posData.map((p: { org_unit_role_id: number }) => p.org_unit_role_id))
      }
    }
    loadOptions()
  }, [userId])

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const form = e.currentTarget
    const divUnit = orgUnits.find(u => u.id === divisionId)
    const secUnit = orgUnits.find(u => u.id === sectionId)
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      applicant: applicantName,
      amount: Number((form.elements.namedItem('amount') as HTMLInputElement).value),
      date: (form.elements.namedItem('date') as HTMLInputElement).value,
      institution: (form.elements.namedItem('institution') as HTMLSelectElement).value || null,
      payment_account: (form.elements.namedItem('payment_account') as HTMLSelectElement).value || null,
      expense_item: (form.elements.namedItem('expense_item') as HTMLSelectElement).value || null,
      note: (form.elements.namedItem('note') as HTMLTextAreaElement).value || null,
      apply_division: divUnit ? unitLabel(divUnit) : null,
      apply_section: secUnit ? unitLabel(secUnit) : null,
      apply_role: roleDisplayName || null,
      status: FUNDS_STATUS.PENDING_STEP1,
      created_by: MOCK_USER_ID,
    }

    const { error: insertError } = await supabase.from('funds_allocation').insert(data)

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    router.push('/funds-allocation/my-funds')
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>新增資金分配申請單</h1>

      {error && <p style={errorStyle}>送出失敗：{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>申請日期 *</label>
          <input name="date" type="date" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>申請處別</label>
          <select
            value={divisionId ?? ''}
            onChange={e => { setDivisionId(Number(e.target.value) || null); setSectionId(null); setRoleDisplayName('') }}
            style={selectStyle}
          >
            <option value="">請選擇</option>
            {divisions.map(u => (
              <option key={u.id} value={u.id}>{unitLabel(u)}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>申請類別</label>
          <select
            value={sectionId ?? ''}
            onChange={e => { setSectionId(Number(e.target.value) || null); setRoleDisplayName('') }}
            disabled={!divisionId}
            style={selectStyle}
          >
            <option value="">請選擇</option>
            {sections.map(u => (
              <option key={u.id} value={u.id}>{unitLabel(u)}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>申請人</label>
          <input value={applicantName} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>職稱</label>
          <select
            value={roleDisplayName}
            onChange={e => setRoleDisplayName(e.target.value)}
            disabled={!sectionId}
            style={selectStyle}
          >
            <option value="">請選擇</option>
            {availableRoles.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />

        <div>
          <label style={labelStyle}>機構</label>
          <select name="institution" style={selectStyle}>
            <option value="">請選擇</option>
            {dropdownOptions.institution.map(opt => (
              <option key={opt.id} value={opt.label}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>出款帳戶</label>
          <select name="payment_account" style={selectStyle}>
            <option value="">請選擇</option>
            {dropdownOptions.payment_account.map(opt => (
              <option key={opt.id} value={opt.label}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>費用項目</label>
          <select name="expense_item" style={selectStyle}>
            <option value="">請選擇</option>
            {expenseItems.map(item => (
              <option key={item.id} value={item.label}>{item.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>項目 *</label>
          <input name="name" required style={inputStyle} />
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />

        <div>
          <label style={labelStyle}>金額 *</label>
          <input name="amount" type="number" min={0} required style={inputStyle} />
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />

        <div>
          <label style={labelStyle}>備註</label>
          <textarea name="note" rows={4} style={textareaStyle} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={submitting} style={btnStyle}>
            {submitting ? '送出中...' : '送出申請'}
          </button>
          <button type="button" onClick={() => router.back()} style={cancelStyle}>取消</button>
        </div>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }
const selectStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', background: 'white', cursor: 'pointer' }
const readonlyStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', background: '#f3f4f6', cursor: 'not-allowed' }
const textareaStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }
const btnStyle: React.CSSProperties = { padding: '8px 20px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const cancelStyle: React.CSSProperties = { padding: '8px 20px', background: 'none', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, cursor: 'pointer' }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginBottom: 8 }
