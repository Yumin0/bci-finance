'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FUNDS_STATUS } from '@/lib/constants'
import { FundsAllocation, DropdownOption, ExpenseItem, OrgUnit, StepDecision } from '@/lib/types'
import ApprovalPanel from '@/app/funds-allocation/_components/ApprovalPanel'

type RoleRow = { id: number; org_unit_id: number; display_name: string | null; role_types: { name: string } }

function unitLabel(u: OrgUnit) {
  return [u.code, u.name].filter(Boolean).join(' ')
}

export default function EditFundsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<FundsAllocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, DropdownOption[]>>({
    institution: [],
    payment_account: [],
  })
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([])
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [orgUnitRoles, setOrgUnitRoles] = useState<RoleRow[]>([])
  const [divisionId, setDivisionId] = useState<number | null>(null)
  const [sectionId, setSectionId] = useState<number | null>(null)
  const [roleDisplayName, setRoleDisplayName] = useState('')
  const [approvalDecision, setApprovalDecision] = useState<StepDecision>(null)
  const [approvalComment, setApprovalComment] = useState('')

  const divisions = orgUnits.filter(u => u.level === '處')
  const sections = orgUnits.filter(u => u.level === '課' && u.parent_id === divisionId)
  const availableRoles = orgUnitRoles
    .filter(r => r.org_unit_id === sectionId)
    .map(r => {
      if (r.display_name) return r.display_name
      const unit = orgUnits.find(u => u.id === r.org_unit_id)
      return unit ? `${unitLabel(unit)} ${r.role_types.name}` : r.role_types.name
    })

  useEffect(() => {
    async function load() {
      const { id } = await params
      const [recordRes, optRes, expRes, unitsRes, rolesRes] = await Promise.all([
        supabase.from('funds_allocation').select('*').eq('id', Number(id)).single(),
        supabase.from('dropdown_options').select('*').order('sort_order'),
        supabase.from('expense_items').select('*').order('sort_order'),
        supabase.from('org_units').select('*').in('level', ['處', '課']).order('sort_order'),
        supabase.from('org_unit_roles').select('id, org_unit_id, display_name, role_types(name)').order('sort_order'),
      ])

      if (recordRes.error) { setError(recordRes.error.message); setLoading(false); return }
      const rec = recordRes.data as FundsAllocation
      setRecord(rec)

      if (optRes.data) {
        const grouped: Record<string, DropdownOption[]> = { institution: [], payment_account: [] }
        for (const opt of optRes.data as DropdownOption[]) {
          grouped[opt.field]?.push(opt)
        }
        setDropdownOptions(grouped)
      }
      if (expRes.data) setExpenseItems(expRes.data as ExpenseItem[])

      const units = (unitsRes.data ?? []) as OrgUnit[]
      const roles = (rolesRes.data ?? []) as unknown as RoleRow[]
      setOrgUnits(units)
      setOrgUnitRoles(roles)

      // 從已儲存的文字值反查 ID，恢復 cascade 狀態
      if (rec.apply_division) {
        const divUnit = units.find(u => u.level === '處' && unitLabel(u) === rec.apply_division)
        if (divUnit) {
          setDivisionId(divUnit.id)
          if (rec.apply_section) {
            const secUnit = units.find(u => u.level === '課' && unitLabel(u) === rec.apply_section)
            if (secUnit) setSectionId(secUnit.id)
          }
        }
      }
      if (rec.apply_role) setRoleDisplayName(rec.apply_role)

      setLoading(false)
    }
    load()
  }, [params])

  const canEdit = record?.status === FUNDS_STATUS.PENDING_STEP1

  function currentStep(status: string): 1 | 2 | 3 | 4 | 5 {
    if (status === FUNDS_STATUS.PENDING_STEP2 || status === FUNDS_STATUS.REJECTED_STEP2) return 2
    if (status === FUNDS_STATUS.PENDING_STEP3 || status === FUNDS_STATUS.REJECTED_STEP3) return 3
    if (status === FUNDS_STATUS.PENDING_STEP4 || status === FUNDS_STATUS.REJECTED_STEP4) return 4
    if (status === FUNDS_STATUS.PENDING_STEP5 || status === FUNDS_STATUS.REJECTED_STEP5 || status === FUNDS_STATUS.APPROVED) return 5
    return 1
  }

  async function handleDelete() {
    if (!record) return
    if (!confirm('確定要刪除此單據嗎？此操作無法復原。')) return
    setSubmitting(true)
    setError(null)

    const { error: deleteError } = await supabase.from('funds_allocation').delete().eq('id', record.id)
    if (deleteError) { setError(deleteError.message); setSubmitting(false); return }
    router.push('/funds-allocation/my-funds')
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!record) return
    setSubmitting(true)
    setError(null)

    const form = e.currentTarget
    const divUnit = orgUnits.find(u => u.id === divisionId)
    const secUnit = orgUnits.find(u => u.id === sectionId)
    const updates = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      amount: Number((form.elements.namedItem('amount') as HTMLInputElement).value),
      date: (form.elements.namedItem('date') as HTMLInputElement).value,
      institution: (form.elements.namedItem('institution') as HTMLSelectElement).value || null,
      payment_account: (form.elements.namedItem('payment_account') as HTMLSelectElement).value || null,
      expense_item: (form.elements.namedItem('expense_item') as HTMLSelectElement).value || null,
      category: (form.elements.namedItem('category') as HTMLInputElement).value || null,
      note: (form.elements.namedItem('note') as HTMLTextAreaElement).value || null,
      apply_division: divUnit ? unitLabel(divUnit) : null,
      apply_section: secUnit ? unitLabel(secUnit) : null,
      apply_role: roleDisplayName || null,
      updated_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase.from('funds_allocation').update(updates).eq('id', record.id)
    if (updateError) { setError(updateError.message); setSubmitting(false); return }
    router.push('/funds-allocation/my-funds')
  }

  if (loading) return <p>載入中...</p>
  if (!record) return <p style={{ color: 'red' }}>找不到此申請單</p>

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>資金分配申請單</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>狀態：<strong>{record.status}</strong></p>

      {error && <p style={errorStyle}>錯誤：{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>日期 *</label>
          <input name="date" type="date" defaultValue={record.date} required disabled={!canEdit} style={canEdit ? inputStyle : readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>申請處別</label>
          <select
            value={divisionId ?? ''}
            onChange={e => { setDivisionId(Number(e.target.value) || null); setSectionId(null); setRoleDisplayName('') }}
            disabled={!canEdit}
            style={canEdit ? selectStyle : readonlyStyle}
          >
            <option value="">請選擇</option>
            {divisions.map(u => (
              <option key={u.id} value={u.id}>{unitLabel(u)}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>申請課別</label>
          <select
            value={sectionId ?? ''}
            onChange={e => { setSectionId(Number(e.target.value) || null); setRoleDisplayName('') }}
            disabled={!canEdit || !divisionId}
            style={canEdit ? selectStyle : readonlyStyle}
          >
            <option value="">請選擇</option>
            {sections.map(u => (
              <option key={u.id} value={u.id}>{unitLabel(u)}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>申請人</label>
          <input value={record.applicant ?? ''} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>職稱</label>
          <select
            value={roleDisplayName}
            onChange={e => setRoleDisplayName(e.target.value)}
            disabled={!canEdit || !sectionId}
            style={canEdit ? selectStyle : readonlyStyle}
          >
            <option value="">請選擇</option>
            {availableRoles.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>機構</label>
          <select name="institution" defaultValue={record.institution ?? ''} disabled={!canEdit} style={canEdit ? selectStyle : readonlyStyle}>
            <option value="">請選擇</option>
            {dropdownOptions.institution.map(opt => (
              <option key={opt.id} value={opt.label}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>出款帳戶</label>
          <select name="payment_account" defaultValue={record.payment_account ?? ''} disabled={!canEdit} style={canEdit ? selectStyle : readonlyStyle}>
            <option value="">請選擇</option>
            {dropdownOptions.payment_account.map(opt => (
              <option key={opt.id} value={opt.label}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>費用項目</label>
          <select name="expense_item" defaultValue={record.expense_item ?? ''} disabled={!canEdit} style={canEdit ? selectStyle : readonlyStyle}>
            <option value="">請選擇</option>
            {expenseItems.map(item => (
              <option key={item.id} value={item.label}>{item.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>名稱 *</label>
          <input name="name" defaultValue={record.name} required disabled={!canEdit} style={canEdit ? inputStyle : readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>金額 *</label>
          <input name="amount" type="number" min={0} defaultValue={record.amount} required disabled={!canEdit} style={canEdit ? inputStyle : readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>類別</label>
          <input name="category" defaultValue={record.category ?? ''} disabled={!canEdit} style={canEdit ? inputStyle : readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>備註</label>
          <textarea name="note" rows={4} defaultValue={record.note ?? ''} disabled={!canEdit} style={canEdit ? textareaStyle : { ...textareaStyle, background: '#f3f4f6', cursor: 'not-allowed' }} />
        </div>

        {!canEdit && <p style={{ fontSize: 13, color: '#6b7280' }}>此申請單已進入審核程序，無法編輯。</p>}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canEdit && (
            <button type="submit" disabled={submitting} style={btnStyle}>
              {submitting ? '儲存中...' : '儲存變更'}
            </button>
          )}
          <button type="button" onClick={() => router.back()} style={cancelStyle}>返回</button>
          {canEdit && (
            <button type="button" onClick={handleDelete} disabled={submitting} style={deleteStyle}>
              刪除此單據
            </button>
          )}
          {record.status === FUNDS_STATUS.APPROVED && (
            <button
              type="button"
              onClick={async () => { const { id } = await params; router.push(`/funds-payment/my-payment/add/${id}`) }}
              style={paymentBtnStyle}
            >
              建立付款憑單
            </button>
          )}
        </div>
      </form>

      <div style={{ marginTop: 40 }}>
        <ApprovalPanel
          record={record}
          currentStep={currentStep(record.status)}
          canReview={false}
          decision={approvalDecision}
          comment={approvalComment}
          submitting={false}
          onDecisionChange={setApprovalDecision}
          onCommentChange={setApprovalComment}
          onSubmit={() => {}}
        />
      </div>
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
const deleteStyle: React.CSSProperties = { padding: '8px 20px', background: 'none', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 14, cursor: 'pointer' }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginBottom: 8 }
const paymentBtnStyle: React.CSSProperties = { padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
