'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsAllocationTemplate, OrgUnit, DropdownOption, FormBlock, FormSlot, FormSchemaRow, TaxRateOption } from '@/lib/types'
import { allDivisionOptions, allSectionOptions } from '@/lib/orgPositions'
import { OrgScopeTree } from '@/app/_components/OrgScopeTree'
import GroupEditTable from '@/app/_components/GroupEditTable'
import { getFormSchemas } from '@/app/actions/form-schema'
import { getTaxRateOptions } from '@/app/actions/tax-rates'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getSharedFundTemplates,
  createSharedFundTemplate,
  updateSharedFundTemplate,
  deleteSharedFundTemplate,
} from '@/app/actions/fund-templates'

type MemberRoleRow = { org_unit_id: number; role_type_id: number | null; role_types: { name: string } | null }

// dataSource 屬於系統自動帶入或需要即時上下文的欄位，範本不需要（也無法）預先設定
const SKIP_DATA_SOURCES = new Set([
  'current_user_name', 'current_user_id', 'current_user_email', 'current_user_role', 'today_date', 'auto_number',
])

function shouldSkipSlot(slot: NonNullable<FormSlot>): boolean {
  if (slot.type === 'attachment' || slot.type === 'readonly') return true
  if (slot.fieldId === 'serial_number' || slot.fieldId === 'applicant') return true
  if (SKIP_DATA_SOURCES.has(slot.dataSource)) return true
  return false
}

function getGroupRows(block: FormBlock): FormSchemaRow[] {
  const startIdx = block.rows.findIndex(r => r.rowGroupStart)
  if (startIdx === -1) return []
  return block.rows.slice(startIdx)
}

function unitLabel(u: OrgUnit): string {
  return [u.code, u.name].filter(Boolean).join(' ')
}

export default function TemplateManagementTab({ newTrigger }: { newTrigger: number }) {
  const [templates, setTemplates] = useState<FundsAllocationTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [schema, setSchema] = useState<FormBlock[]>([])
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [memberRoles, setMemberRoles] = useState<MemberRoleRow[]>([])
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, DropdownOption[]>>({})
  const [taxRateOptions, setTaxRateOptions] = useState<TaxRateOption[]>([])
  const [dynamicSelectOptions, setDynamicSelectOptions] = useState<Record<string, { value: string; label: string }[]>>({})
  const [dataLoaded, setDataLoaded] = useState(false)

  // 範本名稱本身（與表單欄位 fieldId 完全分開，避免跟表單的「項目」等欄位 key 撞名）
  const [templateName, setTemplateName] = useState('')
  // 適用組織範圍（org_units.id），勾選節點涵蓋其所有子孫
  const [scopeUnitIds, setScopeUnitIds] = useState<number[]>([])
  const [scopeModalOpen, setScopeModalOpen] = useState(false)
  const [divisionId, setDivisionId] = useState<number | null>(null)
  const [sectionId, setSectionId] = useState<number | null>(null)
  const [editorValues, setEditorValues] = useState<Record<string, string>>({})
  // 可重複列：範本只需保存「一組」預設值
  const [editorRepeatable, setEditorRepeatable] = useState<Record<string, Record<string, string>>>({})
  // 群組區塊（付款明細）：比照申請表單支援整組重複，key = blockId，value = 每組欄位值陣列
  const [editorGroup, setEditorGroup] = useState<Record<string, Record<string, string>[]>>({})

  // 按「編輯／新增」後自動捲到編輯卡片（卡片固定 render 在列表最上方，避免使用者要往上滑）
  const editCardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (editingId !== null) editCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editingId])

  useEffect(() => {
    getSharedFundTemplates().then(data => { setTemplates(data); setLoading(false) })
    // 卡片列表需要顯示適用範圍名稱，組織架構先載起來
    supabase.from('org_units').select('*').order('sort_order').then(({ data }) => {
      if (data) setOrgUnits(data as OrgUnit[])
    })
  }, [])

  useEffect(() => {
    if (newTrigger === 0) return
    openNew()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newTrigger])

  async function loadDataSources() {
    const schemas = await getFormSchemas()
    const blocks = schemas.funds_allocation
    setSchema(blocks)
    if (dataLoaded) return

    const allSlots = blocks.flatMap(b => b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => !!s)))
    const neededSources = new Set(allSlots.map(s => s.dataSource))

    const fetches: Promise<void>[] = []
    fetches.push(
      (async () => {
        const { data } = await supabase.from('org_units').select('*').order('sort_order')
        if (data) setOrgUnits(data as OrgUnit[])
      })()
    )
    fetches.push(
      (async () => {
        const { data } = await supabase.from('org_unit_members').select('org_unit_id, role_type_id, role_types(name)').order('sort_order')
        if (data) setMemberRoles(data as unknown as MemberRoleRow[])
      })()
    )
    const dropdownFields = ['institution', 'payment_account'].filter(f => neededSources.has(`dropdown_options:${f}`))
    if (dropdownFields.length) {
      fetches.push(
        (async () => {
          const { data } = await supabase.from('dropdown_options').select('*').in('field', dropdownFields).order('sort_order')
          if (!data) return
          const grouped: Record<string, DropdownOption[]> = {}
          for (const opt of data as DropdownOption[]) {
            if (!grouped[opt.field]) grouped[opt.field] = []
            grouped[opt.field].push(opt)
          }
          setDropdownOptions(grouped)
        })()
      )
    }
    if (neededSources.has('tax_rates')) {
      fetches.push(getTaxRateOptions().then(data => setTaxRateOptions(data)))
    }
    for (const src of neededSources) {
      if (!src.startsWith('fee_records:') && !src.startsWith('payee_records:')) continue
      const [table, idStr] = src.startsWith('fee_records:')
        ? ['fee_records', src.replace('fee_records:', '')] as const
        : ['payee_records', src.replace('payee_records:', '')] as const
      const fieldsTable = table === 'fee_records' ? 'fee_category_fields' : 'payee_category_fields'
      const categoryId = Number(idStr)
      fetches.push(
        Promise.all([
          supabase.from(fieldsTable).select('id, sort_order').eq('category_id', categoryId).order('sort_order'),
          supabase.from(table).select('field_values').eq('category_id', categoryId).order('sort_order'),
        ]).then(([fieldsRes, recordsRes]) => {
          const fieldIds = (fieldsRes.data ?? []).map(f => String(f.id))
          const options = (recordsRes.data ?? []).map(r => {
            const vals = fieldIds.map(fId => (r.field_values as Record<string, string>)[fId]).filter(Boolean)
            const label = vals.join(' ')
            return { value: label, label }
          }).filter(o => o.label)
          setDynamicSelectOptions(prev => ({ ...prev, [src]: options }))
        })
      )
    }
    await Promise.all(fetches)
    setDataLoaded(true)
  }

  function openNew() {
    loadDataSources()
    setTemplateName('')
    setScopeUnitIds([])
    setDivisionId(null)
    setSectionId(null)
    setEditorValues({})
    setEditorRepeatable({})
    setEditorGroup({})
    setEditingId('new')
    setErrorMsg(null)
  }

  function openEdit(t: FundsAllocationTemplate) {
    loadDataSources()
    setTemplateName(t.name)
    setScopeUnitIds(t.org_unit_ids ?? [])
    const v = t.field_values
    setDivisionId(Number(v.apply_division) || null)
    setSectionId(Number(v.apply_section) || null)
    const flat: Record<string, string> = {}
    const repeatable: Record<string, Record<string, string>> = {}
    const group: Record<string, Record<string, string>[]> = {}
    for (const [key, val] of Object.entries(v)) {
      if (key === 'apply_division' || key === 'apply_section') continue
      if (key.startsWith('__repeatable_')) {
        try {
          const parsed = JSON.parse(val)
          if (Array.isArray(parsed) && parsed[0]) repeatable[key.replace('__repeatable_', '')] = parsed[0]
        } catch { /* 忽略解析錯誤，保留空值 */ }
        continue
      }
      if (key.startsWith('__group_')) {
        try {
          const parsed = JSON.parse(val)
          if (Array.isArray(parsed) && parsed.length) group[key.replace('__group_', '')] = parsed
        } catch { /* 忽略解析錯誤，保留空值 */ }
        continue
      }
      flat[key] = val
    }
    setEditorValues(flat)
    setEditorRepeatable(repeatable)
    setEditorGroup(group)
    setEditingId(t.id)
    setErrorMsg(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setErrorMsg(null)
    setScopeModalOpen(false)
  }

  function setEditorField(fieldId: string, value: string) {
    setEditorValues(prev => ({ ...prev, [fieldId]: value }))
  }
  function setRepeatableField(rowId: string, fieldId: string, value: string) {
    setEditorRepeatable(prev => ({ ...prev, [rowId]: { ...(prev[rowId] ?? {}), [fieldId]: value } }))
  }
  function setGroupField(blockId: string, instIdx: number, fieldId: string, value: string) {
    setEditorGroup(prev => {
      const insts = [...(prev[blockId] ?? [{}])]
      insts[instIdx] = { ...(insts[instIdx] ?? {}), [fieldId]: value }
      return { ...prev, [blockId]: insts }
    })
  }
  function addGroupInstance(blockId: string) {
    setEditorGroup(prev => ({ ...prev, [blockId]: [...(prev[blockId] ?? [{}]), {}] }))
  }
  function removeGroupInstance(blockId: string, instIdx: number) {
    setEditorGroup(prev => {
      const insts = (prev[blockId] ?? [{}]).filter((_, i) => i !== instIdx)
      return { ...prev, [blockId]: insts.length ? insts : [{}] }
    })
  }

  function buildFieldValues(): Record<string, string> {
    const values: Record<string, string> = { ...editorValues }
    if (divisionId) values.apply_division = String(divisionId)
    if (sectionId) values.apply_section = String(sectionId)
    for (const row of schema.flatMap(b => b.rows).filter(r => r.repeatable)) {
      const inst = editorRepeatable[row.id]
      if (inst && Object.values(inst).some(Boolean)) values[`__repeatable_${row.id}`] = JSON.stringify([inst])
    }
    for (const block of schema) {
      const groupRows = getGroupRows(block)
      if (!groupRows.length) continue
      // 只保留有填任何值的組（整組空白的略過不存）
      const insts = (editorGroup[block.id] ?? []).filter(inst => inst && Object.values(inst).some(Boolean))
      if (insts.length) values[`__group_${block.id}`] = JSON.stringify(insts)
    }
    return values
  }

  async function handleSave() {
    if (!templateName.trim()) { setErrorMsg('請輸入範本名稱'); return }
    if (!scopeUnitIds.length) { setErrorMsg('請至少勾選一個適用組織範圍'); return }
    setSaving(true); setErrorMsg(null)
    const fieldValues = buildFieldValues()
    let result: { error: string | null }
    if (editingId === 'new') {
      result = await createSharedFundTemplate(templateName.trim(), fieldValues, scopeUnitIds)
    } else {
      result = await updateSharedFundTemplate(editingId as number, templateName.trim(), fieldValues, scopeUnitIds)
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

  const divisions = allDivisionOptions(orgUnits)
  const sections = allSectionOptions(orgUnits, divisionId)
  const sectionUnit = orgUnits.find(u => u.id === sectionId)
  const roleOptions = sectionUnit
    ? [...new Set(
        memberRoles
          .filter(r => r.org_unit_id === sectionId)
          .map(r => r.role_types?.name ? `${unitLabel(sectionUnit)} ${r.role_types.name}` : unitLabel(sectionUnit))
      )]
    : []

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

  // inTable：欄位放在 GroupEditTable 儲存格內（overflow 容器），下拉需開 portal 才不會被裁切
  function renderSlotInput(slot: NonNullable<FormSlot>, value: string, onChange: (v: string) => void, inTable = false) {
    const { fieldId, type, dataSource, staticOptions } = slot

    if (fieldId === 'apply_division') {
      return (
        <SearchableSelect
          value={String(divisionId ?? '')}
          onChange={v => { setDivisionId(Number(v) || null); setSectionId(null); setEditorField('apply_role', '') }}
          options={divisions}
          placeholder="選填"
        />
      )
    }
    if (fieldId === 'apply_section') {
      return (
        <SearchableSelect
          value={String(sectionId ?? '')}
          onChange={v => { setSectionId(Number(v) || null); setEditorField('apply_role', '') }}
          options={sections}
          disabled={!divisionId}
          placeholder="選填"
        />
      )
    }
    if (fieldId === 'apply_role') {
      return (
        <SearchableSelect
          value={value}
          onChange={onChange}
          options={roleOptions.map(name => ({ value: name, label: name }))}
          disabled={!sectionId}
          placeholder="選填"
        />
      )
    }
    if (type === 'radio') {
      return (
        <div className="flex gap-4 py-1">
          {['', ...(staticOptions ?? [])].map(opt => (
            <label key={opt} className="flex cursor-pointer items-center gap-1.5 text-sm text-foreground">
              <input type="radio" name={fieldId} checked={value === opt} onChange={() => onChange(opt)} />
              {opt || '不指定'}
            </label>
          ))}
        </div>
      )
    }
    if (type === 'select') {
      let options: { value: string; label: string }[] = []
      if (dataSource === 'static') options = (staticOptions ?? []).map(o => ({ value: o, label: o }))
      else if (dataSource.startsWith('dropdown_options:')) {
        const field = dataSource.replace('dropdown_options:', '')
        options = (dropdownOptions[field] ?? []).map(o => ({ value: o.label, label: o.label }))
      } else if (dataSource === 'tax_rates') {
        options = taxRateOptions.map(o => ({ value: o.label, label: o.label }))
      } else if (dataSource.startsWith('fee_records:') || dataSource.startsWith('payee_records:')) {
        options = dynamicSelectOptions[dataSource] ?? []
      }
      return <SearchableSelect value={value} onChange={onChange} options={options} placeholder="選填" portal={inTable} />
    }
    if (type === 'textarea') {
      return <Textarea value={value} onChange={e => onChange(e.target.value)} rows={2} placeholder="選填" />
    }
    const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'
    return <Input type={inputType} value={value} onChange={e => onChange(e.target.value)} placeholder="選填" />
  }

  if (loading) return <p className="text-sm text-muted-foreground">載入中...</p>

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        設定共用範本，使用者填寫資金分配申請時可選取範本快速帶入欄位值。範本欄位會跟著「表單設定」的申請表單自動同步。每個範本必須指定適用組織範圍，只有範圍內的成員才會在「選取範本」看到它。
      </p>

      {/* 編輯 / 新增表單 */}
      {editingId !== null && (
        <Card ref={editCardRef} className="border-primary/50">
          <CardHeader>
            <CardTitle className="text-primary">
              {editingId === 'new' ? '新增範本' : '編輯範本'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

            <FieldRow label="範本名稱 *">
              <Input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="例：主要帳戶—會計師費用"
              />
            </FieldRow>

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-xs text-muted-foreground">
                以下欄位可選填，只有填寫的欄位會預先帶入申請表單。
              </p>
              <div className="flex flex-col gap-4">
                {schema.map(block => {
                  const groupRows = getGroupRows(block)
                  const normalRows = block.rows.filter(r => !r.repeatable && !groupRows.includes(r))
                  const repeatableRows = block.rows.filter(r => r.repeatable)
                  const hasAnyVisible =
                    normalRows.some(r => r.slots.some(s => s && !shouldSkipSlot(s))) ||
                    repeatableRows.some(r => r.slots.some(s => s && !shouldSkipSlot(s))) ||
                    groupRows.some(r => r.slots.some(s => s && !shouldSkipSlot(s)))
                  if (!hasAnyVisible) return null
                  return (
                    <div key={block.id} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
                      {block.title && <p className="mb-2 text-xs font-semibold text-muted-foreground">{block.title}</p>}
                      <div className="grid grid-cols-2 gap-3">
                        {normalRows.flatMap(row => row.slots.map((slot, idx) => {
                          if (!slot || shouldSkipSlot(slot)) return null
                          return (
                            <FieldRow key={`${row.id}_${idx}`} label={slot.label}>
                              {renderSlotInput(slot, editorValues[slot.fieldId] ?? '', v => setEditorField(slot.fieldId, v))}
                            </FieldRow>
                          )
                        }))}
                      </div>
                      {repeatableRows.map(row => {
                        const visible = row.slots.filter((s): s is NonNullable<FormSlot> => !!s && !shouldSkipSlot(s))
                        if (!visible.length) return null
                        const inst = editorRepeatable[row.id] ?? {}
                        return (
                          <div key={row.id} className="mt-3 grid grid-cols-2 gap-3">
                            {visible.map(slot => (
                              <FieldRow key={slot.fieldId} label={slot.label}>
                                {renderSlotInput(slot, inst[slot.fieldId] ?? '', v => setRepeatableField(row.id, slot.fieldId, v))}
                              </FieldRow>
                            ))}
                          </div>
                        )
                      })}
                      {groupRows.length > 0 && (() => {
                        const instances = editorGroup[block.id] ?? [{}]
                        // 範本欄位皆選填：去掉 required 星號，避免與「以下欄位可選填」說明矛盾
                        const visibleSlots = groupRows
                          .flatMap(r => r.slots)
                          .filter((s): s is NonNullable<FormSlot> => !!s && !shouldSkipSlot(s))
                          .map(s => ({ ...s, required: false }))
                        if (!visibleSlots.length) return null
                        return (
                          <div className="mt-3">
                            <GroupEditTable
                              slots={visibleSlots}
                              instances={instances}
                              selectOptionLabels={groupSelectOptionLabels}
                              onAdd={() => addGroupInstance(block.id)}
                              onRemove={instIdx => removeGroupInstance(block.id, instIdx)}
                              addLabel="＋ 新增此組"
                              renderCell={(slot, inst, instIdx) =>
                                renderSlotInput(slot, inst[slot.fieldId] ?? '', v => setGroupField(block.id, instIdx, slot.fieldId, v), true)
                              }
                            />
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setScopeModalOpen(true)} disabled={saving}>
                適用組織範圍{scopeUnitIds.length > 0 ? `（已選 ${scopeUnitIds.length} 個節點）` : ' *（未設定）'}
              </Button>
              <Button variant="outline" onClick={cancelEdit} disabled={saving}>取消</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '儲存中...' : '儲存範本'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 適用組織範圍 Modal */}
      {scopeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setScopeModalOpen(false) }}
        >
          <div className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="m-0 text-base font-bold text-foreground">適用組織範圍</h3>
              <button
                onClick={() => setScopeModalOpen(false)}
                className="cursor-pointer border-none bg-transparent text-xl leading-none text-muted-foreground"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="mb-3 mt-0 text-xs text-muted-foreground">
                勾選的節點及其底下所有單位的成員才能使用此範本；勾選上層節點即涵蓋整個分支，不需逐一勾選。
              </p>
              <OrgScopeTree
                orgUnits={orgUnits}
                selected={scopeUnitIds}
                onToggle={id => setScopeUnitIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              />
            </div>
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="m-0 text-xs text-muted-foreground">
                {scopeUnitIds.length > 0 ? `已選 ${scopeUnitIds.length} 個節點` : '尚未勾選任何節點'}
              </p>
              <Button onClick={() => setScopeModalOpen(false)}>完成</Button>
            </div>
          </div>
        </div>
      )}

      {/* 範本列表 */}
      {templates.length === 0 && editingId === null && (
        <p className="py-10 text-center text-sm text-muted-foreground">尚未建立任何共用範本</p>
      )}

      {templates.map(t => {
        const v = t.field_values
        const summary = [
          v.payment_account && `出款帳戶：${v.payment_account}`,
          v.institution && `機構：${v.institution}`,
        ].filter(Boolean).join('　｜　')
        const unitMap = new Map(orgUnits.map(u => [u.id, u]))
        const scopeNames = (t.org_unit_ids ?? []).map(id => unitMap.get(id)).filter((u): u is OrgUnit => !!u).map(unitLabel)

        return (
          <Card key={t.id}>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-foreground">{t.name}</p>
                {summary && <p className="mt-1 text-xs text-muted-foreground">{summary}</p>}
                {scopeNames.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">適用範圍：{scopeNames.join('、')}</p>
                ) : (
                  <p className="mt-1 text-xs text-destructive">尚未設定適用組織範圍，所有使用者都看不到此範本，請編輯補上</p>
                )}
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
