'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsAllocationTemplate, OrgUnit, DropdownOption, ExpenseItem } from '@/lib/types'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  getSharedFundTemplates,
  createSharedFundTemplate,
  updateSharedFundTemplate,
  deleteSharedFundTemplate,
} from '@/app/actions/fund-templates'

type RoleRow = { id: number; org_unit_id: number; display_name: string | null; role_types: { name: string } }

function unitLabel(u: OrgUnit) {
  return [u.code, u.name].filter(Boolean).join(' ')
}

const CATEGORY_OPTIONS = ['一般', '預支']

type EditorValues = {
  name: string
  apply_division: string
  apply_section: string
  apply_role: string
  institution: string
  payment_account: string
  expense_item: string
  item_name: string
  amount: string
  category: string
  note: string
}

const EMPTY_EDITOR: EditorValues = {
  name: '',
  apply_division: '',
  apply_section: '',
  apply_role: '',
  institution: '',
  payment_account: '',
  expense_item: '',
  item_name: '',
  amount: '',
  category: '',
  note: '',
}

function templateToEditor(t: FundsAllocationTemplate): EditorValues {
  const v = t.field_values
  return {
    name: t.name,
    apply_division: v.apply_division ?? '',
    apply_section: v.apply_section ?? '',
    apply_role: v.apply_role ?? '',
    institution: v.institution ?? '',
    payment_account: v.payment_account ?? '',
    expense_item: v.expense_item ?? '',
    item_name: v.name ?? '',
    amount: v.amount ?? '',
    category: v.category ?? '',
    note: v.note ?? '',
  }
}

function editorToFieldValues(ev: EditorValues): Record<string, string> {
  return {
    apply_division: ev.apply_division,
    apply_section: ev.apply_section,
    apply_role: ev.apply_role,
    institution: ev.institution,
    payment_account: ev.payment_account,
    expense_item: ev.expense_item,
    name: ev.item_name,
    amount: ev.amount,
    category: ev.category,
    note: ev.note,
  }
}

export default function TemplateManagementTab({ newTrigger }: { newTrigger: number }) {
  const [templates, setTemplates] = useState<FundsAllocationTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [editorValues, setEditorValues] = useState<EditorValues>(EMPTY_EDITOR)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Data sources for dropdowns
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [orgUnitRoles, setOrgUnitRoles] = useState<RoleRow[]>([])
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, DropdownOption[]>>({})
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    getSharedFundTemplates().then(data => { setTemplates(data); setLoading(false) })
  }, [])

  useEffect(() => {
    if (newTrigger === 0) return
    openNew()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newTrigger])

  async function loadDataSources() {
    if (dataLoaded) return
    const [ouRes, orRes, doRes, eiRes] = await Promise.all([
      supabase.from('org_units').select('*').order('sort_order'),
      supabase.from('org_unit_roles').select('id, org_unit_id, display_name, role_types(name)').order('sort_order'),
      supabase.from('dropdown_options').select('*').in('field', ['institution', 'payment_account']).order('sort_order'),
      supabase.from('expense_items').select('*').order('sort_order'),
    ])
    if (ouRes.data) setOrgUnits(ouRes.data as OrgUnit[])
    if (orRes.data) setOrgUnitRoles(orRes.data as unknown as RoleRow[])
    if (doRes.data) {
      const grouped: Record<string, DropdownOption[]> = {}
      for (const opt of doRes.data as DropdownOption[]) {
        if (!grouped[opt.field]) grouped[opt.field] = []
        grouped[opt.field].push(opt)
      }
      setDropdownOptions(grouped)
    }
    if (eiRes.data) setExpenseItems(eiRes.data as ExpenseItem[])
    setDataLoaded(true)
  }

  function openNew() {
    loadDataSources()
    setEditorValues(EMPTY_EDITOR)
    setEditingId('new')
    setErrorMsg(null)
  }

  function openEdit(t: FundsAllocationTemplate) {
    loadDataSources()
    setEditorValues(templateToEditor(t))
    setEditingId(t.id)
    setErrorMsg(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setErrorMsg(null)
  }

  function setVal(key: keyof EditorValues, value: string) {
    setEditorValues(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'apply_division') { next.apply_section = ''; next.apply_role = '' }
      if (key === 'apply_section') { next.apply_role = '' }
      return next
    })
  }

  async function handleSave() {
    if (!editorValues.name.trim()) { setErrorMsg('請輸入範本名稱'); return }
    setSaving(true); setErrorMsg(null)
    const fieldValues = editorToFieldValues(editorValues)
    let result: { error: string | null }
    if (editingId === 'new') {
      result = await createSharedFundTemplate(editorValues.name.trim(), fieldValues)
    } else {
      result = await updateSharedFundTemplate(editingId as number, editorValues.name.trim(), fieldValues)
    }
    setSaving(false)
    if (result.error) { setErrorMsg(result.error); return }
    const updated = await getSharedFundTemplates()
    setTemplates(updated)
    setEditingId(null)
  }

  async function handleDelete(id: number) {
    setDeletingId(id)
    const { error } = await deleteSharedFundTemplate(id)
    setDeletingId(null)
    if (!error) setTemplates(prev => prev.filter(t => t.id !== id))
  }

  // Derived cascade options
  const divisionId = Number(editorValues.apply_division) || null
  const sectionId = Number(editorValues.apply_section) || null
  const divisions = orgUnits.filter(u => u.level === '處')
  const sections = orgUnits.filter(u => u.level === '課' && u.parent_id === divisionId)
  const roleOptions = orgUnitRoles
    .filter(r => r.org_unit_id === sectionId)
    .map(r => r.display_name ?? `${r.role_types.name}`)

  const institutionOptions = (dropdownOptions['institution'] ?? []).map(o => ({ value: o.label, label: o.label }))
  const paymentAccountOptions = (dropdownOptions['payment_account'] ?? []).map(o => ({ value: o.label, label: o.label }))
  const expenseItemOptions = expenseItems.map(i => ({ value: i.label, label: i.label }))

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', textAlign: 'center' }}>載入中...</div>

  return (
    <div>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>
        設定共用範本，使用者填寫資金分配申請時可選取範本快速帶入欄位值。
      </p>

      {/* Editor form */}
      {editingId !== null && (
        <div style={{ border: '1.5px solid #2563eb', borderRadius: 10, padding: 20, marginBottom: 20, background: '#f8faff' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1e40af', marginTop: 0, marginBottom: 16 }}>
            {editingId === 'new' ? '新增範本' : '編輯範本'}
          </p>

          {errorMsg && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{errorMsg}</p>}

          <FieldRow label="範本名稱 *">
            <input
              value={editorValues.name}
              onChange={e => setVal('name', e.target.value)}
              placeholder="例：主要帳戶—會計師費用"
              style={inputStyle}
            />
          </FieldRow>

          <div style={{ borderTop: '1px solid #dbeafe', margin: '14px 0', paddingTop: 14 }}>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              以下欄位可選填，只有填寫的欄位會預先帶入申請表單。
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FieldRow label="申請處別">
                <SearchableSelect
                  value={editorValues.apply_division}
                  onChange={v => setVal('apply_division', v)}
                  options={divisions.map(u => ({ value: String(u.id), label: unitLabel(u) }))}
                  placeholder="選填"
                />
              </FieldRow>

              <FieldRow label="申請課別">
                <SearchableSelect
                  value={editorValues.apply_section}
                  onChange={v => setVal('apply_section', v)}
                  options={sections.map(u => ({ value: String(u.id), label: unitLabel(u) }))}
                  disabled={!divisionId}
                  placeholder="選填"
                />
              </FieldRow>

              <FieldRow label="職稱">
                <SearchableSelect
                  value={editorValues.apply_role}
                  onChange={v => setVal('apply_role', v)}
                  options={roleOptions.map(name => ({ value: name, label: name }))}
                  disabled={!sectionId}
                  placeholder="選填"
                />
              </FieldRow>

              <FieldRow label="機構">
                <SearchableSelect
                  value={editorValues.institution}
                  onChange={v => setVal('institution', v)}
                  options={institutionOptions}
                  placeholder="選填"
                />
              </FieldRow>

              <FieldRow label="出款帳戶">
                <SearchableSelect
                  value={editorValues.payment_account}
                  onChange={v => setVal('payment_account', v)}
                  options={paymentAccountOptions}
                  placeholder="選填"
                />
              </FieldRow>

              <FieldRow label="費用項目">
                <SearchableSelect
                  value={editorValues.expense_item}
                  onChange={v => setVal('expense_item', v)}
                  options={expenseItemOptions}
                  placeholder="選填"
                />
              </FieldRow>

              <FieldRow label="項目名稱">
                <input
                  value={editorValues.item_name}
                  onChange={e => setVal('item_name', e.target.value)}
                  placeholder="選填"
                  style={inputStyle}
                />
              </FieldRow>

              <FieldRow label="金額">
                <input
                  type="number"
                  value={editorValues.amount}
                  onChange={e => setVal('amount', e.target.value)}
                  placeholder="選填"
                  style={inputStyle}
                />
              </FieldRow>

              <FieldRow label="類型">
                <div style={{ display: 'flex', gap: 16, padding: '8px 0' }}>
                  {['', ...CATEGORY_OPTIONS].map(opt => (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="template_category"
                        value={opt}
                        checked={editorValues.category === opt}
                        onChange={() => setVal('category', opt)}
                      />
                      {opt || '不指定'}
                    </label>
                  ))}
                </div>
              </FieldRow>

              <FieldRow label="備註">
                <textarea
                  value={editorValues.note}
                  onChange={e => setVal('note', e.target.value)}
                  placeholder="選填"
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </FieldRow>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={handleSave} disabled={saving} style={btnPrimary}>
              {saving ? '儲存中...' : '儲存範本'}
            </button>
            <button onClick={cancelEdit} disabled={saving} style={btnCancel}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      {templates.length === 0 && editingId === null && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          尚未建立任何共用範本
        </div>
      )}

      {templates.map(t => {
        const v = t.field_values
        const summary = [
          v.payment_account && `出款帳戶：${v.payment_account}`,
          v.expense_item && `費用項目：${v.expense_item}`,
          v.name && `項目：${v.name}`,
        ].filter(Boolean).join('　｜　')

        return (
          <div key={t.id} style={{
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 10,
            background: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-title)' }}>{t.name}</p>
              {summary && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{summary}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => openEdit(t)}
                disabled={editingId !== null}
                style={btnOutline}
              >
                編輯
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                disabled={deletingId === t.id}
                style={btnDanger}
              >
                {deletingId === t.id ? '刪除中...' : '刪除'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid var(--btn-border)',
  borderRadius: 6,
  fontSize: 13,
  boxSizing: 'border-box',
  background: 'white',
}

const btnPrimary: React.CSSProperties = { padding: '8px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnCancel: React.CSSProperties = { padding: '8px 16px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer' }
const btnOutline: React.CSSProperties = { padding: '6px 14px', background: 'white', color: '#374151', border: '1px solid var(--btn-border)', borderRadius: 6, fontSize: 13, cursor: 'pointer' }
const btnDanger: React.CSSProperties = { padding: '6px 14px', background: 'white', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 13, cursor: 'pointer' }
