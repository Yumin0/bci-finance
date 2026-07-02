'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsAllocationTemplate, OrgUnit, DropdownOption } from '@/lib/types'
import { allDivisionOptions, allSectionOptions } from '@/lib/orgPositions'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getSharedFundTemplates,
  createSharedFundTemplate,
  updateSharedFundTemplate,
  deleteSharedFundTemplate,
} from '@/app/actions/fund-templates'

type RoleRow = { id: number; org_unit_id: number; display_name: string | null; role_types: { name: string } }

const CATEGORY_OPTIONS = ['一般', '預支']

type EditorValues = {
  name: string
  apply_division: string
  apply_section: string
  apply_role: string
  institution: string
  payment_account: string
  item_name: string
  amount: string
  category: string
  note: string
}

const EMPTY_EDITOR: EditorValues = {
  name: '', apply_division: '', apply_section: '', apply_role: '',
  institution: '', payment_account: '',
  item_name: '', amount: '', category: '', note: '',
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

  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [orgUnitRoles, setOrgUnitRoles] = useState<RoleRow[]>([])
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, DropdownOption[]>>({})
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
    const [ouRes, orRes, doRes] = await Promise.all([
      supabase.from('org_units').select('*').order('sort_order'),
      supabase.from('org_unit_roles').select('id, org_unit_id, display_name, role_types(name)').order('sort_order'),
      supabase.from('dropdown_options').select('*').in('field', ['institution', 'payment_account']).order('sort_order'),
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

  const divisionId = Number(editorValues.apply_division) || null
  const sectionId = Number(editorValues.apply_section) || null
  const divisions = allDivisionOptions(orgUnits)
  const sections = allSectionOptions(orgUnits, divisionId)
  const roleOptions = orgUnitRoles
    .filter(r => r.org_unit_id === sectionId)
    .map(r => r.display_name ?? `${r.role_types.name}`)

  const institutionOptions = (dropdownOptions['institution'] ?? []).map(o => ({ value: o.label, label: o.label }))
  const paymentAccountOptions = (dropdownOptions['payment_account'] ?? []).map(o => ({ value: o.label, label: o.label }))

  if (loading) return <p className="text-sm text-muted-foreground">載入中...</p>

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        設定共用範本，使用者填寫資金分配申請時可選取範本快速帶入欄位值。
      </p>

      {/* 編輯 / 新增表單 */}
      {editingId !== null && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="text-primary">
              {editingId === 'new' ? '新增範本' : '編輯範本'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

            <FieldRow label="範本名稱 *">
              <Input
                value={editorValues.name}
                onChange={e => setVal('name', e.target.value)}
                placeholder="例：主要帳戶—會計師費用"
              />
            </FieldRow>

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-xs text-muted-foreground">
                以下欄位可選填，只有填寫的欄位會預先帶入申請表單。
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="申請處別">
                  <SearchableSelect
                    value={editorValues.apply_division}
                    onChange={v => setVal('apply_division', v)}
                    options={divisions}
                    placeholder="選填"
                  />
                </FieldRow>
                <FieldRow label="申請課別">
                  <SearchableSelect
                    value={editorValues.apply_section}
                    onChange={v => setVal('apply_section', v)}
                    options={sections}
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
                <FieldRow label="項目名稱">
                  <Input
                    value={editorValues.item_name}
                    onChange={e => setVal('item_name', e.target.value)}
                    placeholder="選填"
                  />
                </FieldRow>
                <FieldRow label="金額">
                  <Input
                    type="number"
                    value={editorValues.amount}
                    onChange={e => setVal('amount', e.target.value)}
                    placeholder="選填"
                  />
                </FieldRow>
                <FieldRow label="類型">
                  <div className="flex gap-4 py-1">
                    {['', ...CATEGORY_OPTIONS].map(opt => (
                      <label key={opt} className="flex cursor-pointer items-center gap-1.5 text-sm text-foreground">
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
                    className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-ring dark:bg-input/30"
                  />
                </FieldRow>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '儲存中...' : '儲存範本'}
              </Button>
              <Button variant="outline" onClick={cancelEdit} disabled={saving}>取消</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 範本列表 */}
      {templates.length === 0 && editingId === null && (
        <p className="py-10 text-center text-sm text-muted-foreground">尚未建立任何共用範本</p>
      )}

      {templates.map(t => {
        const v = t.field_values
        const summary = [
          v.payment_account && `出款帳戶：${v.payment_account}`,
          v.expense_item && `費用項目：${v.expense_item}`,
          v.name && `項目：${v.name}`,
        ].filter(Boolean).join('　｜　')

        return (
          <Card key={t.id}>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-foreground">{t.name}</p>
                {summary && <p className="mt-1 text-xs text-muted-foreground">{summary}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(t)} disabled={editingId !== null}>
                  編輯
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(t.id)} disabled={deletingId === t.id}>
                  {deletingId === t.id ? '刪除中...' : '刪除'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
