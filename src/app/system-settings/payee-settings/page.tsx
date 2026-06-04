'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import PageHeader from '@/app/_components/PageHeader'
import type { PayeeCategory, PayeeCategoryField, PayeeFieldType, PayeeRecord } from '@/lib/types'
import {
  getPayeeCategories, getAllPayeeCategoryFields, getPayeeRecords,
  addPayeeCategory, updatePayeeCategory, deletePayeeCategory,
  addPayeeCategoryField, updatePayeeCategoryField, deletePayeeCategoryField,
  addPayeeRecord, updatePayeeRecord, deletePayeeRecord,
} from '@/app/actions/payee'

const FIELD_TYPE_LABELS: Record<PayeeFieldType, string> = {
  text: '文字（單行）',
  number: '數字',
  dropdown: '下拉選單',
  date: '日期',
}

const inputCls = 'w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm outline-none transition-colors focus:border-ring dark:bg-input/30'

// ---- Inline 欄位表單 ----
function InlineFieldForm({
  initial, onSave, onCancel,
}: {
  initial?: PayeeCategoryField
  onSave: (label: string, fieldType: PayeeFieldType, options: string[] | null) => Promise<void>
  onCancel: () => void
}) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [fieldType, setFieldType] = useState<PayeeFieldType>(initial?.field_type ?? 'text')
  const [optionsText, setOptionsText] = useState((initial?.options ?? []).join('\n'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!label.trim()) { setError('請輸入欄位名稱'); return }
    const options = fieldType === 'dropdown'
      ? optionsText.split('\n').map(s => s.trim()).filter(Boolean)
      : null
    setSaving(true); setError(null)
    await onSave(label.trim(), fieldType, options)
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-primary bg-primary/5 p-3.5">
      <div className="grid grid-cols-[1fr_140px] gap-2.5">
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">欄位名稱</p>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="例如：銀行帳號" />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">欄位類型</p>
          <select value={fieldType} onChange={e => setFieldType(e.target.value as PayeeFieldType)} className={inputCls}>
            {(Object.entries(FIELD_TYPE_LABELS) as [PayeeFieldType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      {fieldType === 'dropdown' && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">選項（每行一個）</p>
          <textarea
            value={optionsText}
            onChange={e => setOptionsText(e.target.value)}
            rows={3}
            placeholder={'選項一\n選項二\n選項三'}
            className={`${inputCls} resize-y`}
          />
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>取消</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? '儲存中...' : '儲存'}</Button>
      </div>
    </div>
  )
}

// ---- 新增類別 Modal ----
function AddCategoryModal({ onSave, onClose }: { onSave: (name: string) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError('請輸入類別名稱'); return }
    setSaving(true); setError(null)
    await onSave(name.trim())
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45">
      <div className="w-[360px] rounded-xl bg-card p-7 shadow-xl">
        <h3 className="mb-5 text-base font-bold text-foreground">新增付款對象類別</h3>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          placeholder="例如：職員、廠商"
        />
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" onClick={onClose} disabled={saving}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '儲存中...' : '儲存'}</Button>
        </div>
      </div>
    </div>
  )
}

// ---- 類別設定 Modal ----
function CategorySettingsModal({
  category, fields, onSaveName, onSaveField, onDeleteField, onDeleteCategory, onClose,
}: {
  category: PayeeCategory
  fields: PayeeCategoryField[]
  onSaveName: (name: string) => Promise<void>
  onSaveField: (label: string, fieldType: PayeeFieldType, options: string[] | null, editingId?: number) => Promise<void>
  onDeleteField: (field: PayeeCategoryField) => Promise<void>
  onDeleteCategory: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(category.name)
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [editingFieldId, setEditingFieldId] = useState<number | 'new' | null>(null)

  async function handleSaveName() {
    if (!name.trim()) { setNameError('請輸入類別名稱'); return }
    setSavingName(true); setNameError(null)
    await onSaveName(name.trim())
    setSavingName(false); setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2000)
  }

  async function handleSaveField(label: string, fieldType: PayeeFieldType, options: string[] | null) {
    const id = typeof editingFieldId === 'number' ? editingFieldId : undefined
    await onSaveField(label, fieldType, options, id)
    setEditingFieldId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
      <div className="flex max-h-[88vh] w-[580px] flex-col rounded-2xl bg-card p-7 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">類別設定</h3>
          <button onClick={onClose} className="text-xl leading-none text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="flex flex-1 flex-col gap-7 overflow-y-auto">
          <section>
            <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">類別名稱</p>
            <div className="flex gap-2">
              <Input value={name} onChange={e => { setName(e.target.value); setNameSaved(false) }} className="flex-1" />
              <Button onClick={handleSaveName} disabled={savingName} className="shrink-0">
                {savingName ? '儲存中...' : nameSaved ? '✓ 已儲存' : '儲存'}
              </Button>
            </div>
            {nameError && <p className="mt-1.5 text-xs text-destructive">{nameError}</p>}
          </section>

          <section>
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">欄位管理</p>
              {editingFieldId === null && (
                <Button size="sm" onClick={() => setEditingFieldId('new')}>+ 新增欄位</Button>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {fields.map(field => (
                editingFieldId === field.id ? (
                  <InlineFieldForm key={field.id} initial={field} onSave={handleSaveField} onCancel={() => setEditingFieldId(null)} />
                ) : (
                  <div key={field.id} className="grid items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5" style={{ gridTemplateColumns: '1fr 130px 80px' }}>
                    <div>
                      <span className="text-sm font-medium text-foreground">{field.label}</span>
                      {field.field_type === 'dropdown' && field.options && field.options.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">選項：{field.options.join('、')}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{FIELD_TYPE_LABELS[field.field_type]}</span>
                    <div className="flex gap-2.5">
                      <button onClick={() => setEditingFieldId(field.id)} disabled={editingFieldId !== null}
                        className="text-sm text-primary disabled:opacity-40 hover:underline">編輯</button>
                      <button onClick={() => onDeleteField(field)} disabled={editingFieldId !== null}
                        className="text-sm text-destructive disabled:opacity-40 hover:underline">刪除</button>
                    </div>
                  </div>
                )
              ))}
              {editingFieldId === 'new' && (
                <InlineFieldForm onSave={handleSaveField} onCancel={() => setEditingFieldId(null)} />
              )}
              {fields.length === 0 && editingFieldId === null && (
                <p className="py-3 text-center text-sm text-muted-foreground">尚未設定任何欄位</p>
              )}
            </div>
          </section>

          <section>
            <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-destructive">危險區域</p>
            <div className="flex items-center justify-between rounded-xl border border-red-200 px-4 py-3.5 dark:border-red-900">
              <div>
                <p className="text-sm font-semibold text-foreground">刪除此類別</p>
                <p className="mt-0.5 text-xs text-muted-foreground">此操作無法復原，所有欄位與付款對象資料也會一併刪除。</p>
              </div>
              <Button variant="outline" onClick={onDeleteCategory} className="ml-4 shrink-0 border-red-300 text-destructive hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950">
                刪除類別
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// ---- 付款對象記錄 Modal ----
function RecordModal({
  fields, initial, onSave, onClose,
}: {
  fields: PayeeCategoryField[]
  initial?: PayeeRecord
  onSave: (values: Record<string, string>) => Promise<void>
  onClose: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    fields.forEach(f => { init[String(f.id)] = initial?.field_values?.[String(f.id)] ?? '' })
    return init
  })
  const [saving, setSaving] = useState(false)

  function set(fieldId: number, val: string) {
    setValues(prev => ({ ...prev, [String(fieldId)]: val }))
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45">
      <div className="max-h-[80vh] w-[480px] overflow-y-auto rounded-xl bg-card p-7 shadow-xl">
        <h3 className="mb-5 text-base font-bold text-foreground">{initial ? '編輯付款對象' : '新增付款對象'}</h3>
        <div className="flex flex-col gap-3.5">
          {fields.map(f => (
            <label key={f.id} className="text-sm font-semibold text-foreground">
              {f.label}
              {f.field_type === 'dropdown' ? (
                <select
                  value={values[String(f.id)] ?? ''}
                  onChange={e => set(f.id, e.target.value)}
                  className={`mt-1.5 block ${inputCls}`}
                >
                  <option value="">— 請選擇 —</option>
                  {(f.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                  value={values[String(f.id)] ?? ''}
                  onChange={e => set(f.id, e.target.value)}
                  className={`mt-1.5 block ${inputCls}`}
                />
              )}
            </label>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="outline" onClick={onClose} disabled={saving}>取消</Button>
          <Button onClick={async () => { setSaving(true); await onSave(values); setSaving(false) }} disabled={saving}>
            {saving ? '儲存中...' : '儲存'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---- 主頁面 ----
export default function PayeeSettingsPage() {
  const [categories, setCategories] = useState<PayeeCategory[]>([])
  const [fields, setFields] = useState<PayeeCategoryField[]>([])
  const [records, setRecords] = useState<PayeeRecord[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showCategorySettings, setShowCategorySettings] = useState(false)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<PayeeRecord | undefined>()

  async function loadBase() {
    const [cats, flds] = await Promise.all([getPayeeCategories(), getAllPayeeCategoryFields()])
    setCategories(cats)
    setFields(flds)
    return cats
  }

  async function loadRecords(categoryId: number) {
    setRecords(await getPayeeRecords(categoryId))
  }

  async function load(keepActive?: number) {
    setError(null)
    const cats = await loadBase()
    const target = keepActive ?? (cats.length > 0 ? cats[0].id : null)
    const resolved = target !== null && cats.find(c => c.id === target) ? target : (cats[0]?.id ?? null)
    setActiveId(resolved)
    if (resolved !== null) await loadRecords(resolved)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function switchCategory(id: number) {
    setActiveId(id)
    await loadRecords(id)
  }

  const activeFields = fields.filter(f => f.category_id === activeId)
  const activeRecords = records.filter(r => r.category_id === activeId)
  const activeCat = categories.find(c => c.id === activeId)

  async function handleAddCategory(name: string) {
    const res = await addPayeeCategory(name)
    if (res.error) { setError(res.error); return }
    setShowAddCategory(false)
    await load()
  }

  async function handleEditCategoryName(name: string) {
    if (!activeCat) return
    const res = await updatePayeeCategory(activeCat.id, name)
    if (res.error) { setError(res.error); return }
    await load(activeId ?? undefined)
  }

  async function handleDeleteCategory() {
    if (!activeCat) return
    if (!confirm(`確定要刪除「${activeCat.name}」類別嗎？此類別下的所有欄位與付款對象資料也會一併刪除。`)) return
    const res = await deletePayeeCategory(activeCat.id)
    if (res.error) { setError(res.error); return }
    setShowCategorySettings(false)
    await load()
  }

  async function handleSaveField(label: string, fieldType: PayeeFieldType, options: string[] | null, editingId?: number) {
    const res = editingId
      ? await updatePayeeCategoryField(editingId, label, fieldType, options)
      : await addPayeeCategoryField(activeId!, label, fieldType, options)
    if (res.error) { setError(res.error); return }
    await load(activeId ?? undefined)
  }

  async function handleDeleteField(field: PayeeCategoryField) {
    if (!confirm(`確定要刪除欄位「${field.label}」嗎？`)) return
    const res = await deletePayeeCategoryField(field.id)
    if (res.error) { setError(res.error); return }
    await load(activeId ?? undefined)
  }

  async function handleSaveRecord(values: Record<string, string>) {
    const res = editingRecord
      ? await updatePayeeRecord(editingRecord.id, values)
      : await addPayeeRecord(activeId!, values)
    if (res.error) { setError(res.error); return }
    setShowRecordModal(false); setEditingRecord(undefined)
    if (activeId) await loadRecords(activeId)
  }

  async function handleDeleteRecord(record: PayeeRecord) {
    const firstName = activeFields[0] ? record.field_values[String(activeFields[0].id)] : ''
    if (!confirm(`確定要刪除「${firstName || '此付款對象'}」嗎？`)) return
    const res = await deletePayeeRecord(record.id)
    if (res.error) { setError(res.error); return }
    if (activeId) await loadRecords(activeId)
  }

  if (loading) return <p className="text-muted-foreground">載入中...</p>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader
          title="付款對象設定"
          action={<Button onClick={() => setShowAddCategory(true)}>+ 新增類別</Button>}
        />
        <p className="mt-1 text-sm text-muted-foreground">自訂付款對象類別，並管理各類別的付款對象資料。</p>
      </div>

      {error && <p className="text-sm text-destructive">錯誤：{error}</p>}

      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          尚未建立任何類別，請點右上角「+ 新增類別」開始設定。
        </div>
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          {/* 類別 Tab 列 */}
          <div className="flex border-b border-border px-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => switchCategory(cat.id)}
                className={`-mb-px whitespace-nowrap border-b-2 px-5 py-2.5 text-sm transition-colors ${
                  activeId === cat.id
                    ? 'border-primary font-bold text-primary'
                    : 'border-transparent font-normal text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {activeCat && (
            <CardContent className="flex flex-col gap-5 py-5">
              <div>
                <Button variant="outline" size="sm" onClick={() => setShowCategorySettings(true)}>
                  類別設定
                </Button>
              </div>

              {activeFields.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  請先點「類別設定」建立此類別的欄位，再新增付款對象。
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* 欄位標題列 */}
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `repeat(${activeFields.length}, 1fr) 64px` }}
                  >
                    {activeFields.map(f => (
                      <p key={f.id} className="pl-1 text-xs font-semibold text-muted-foreground">{f.label}</p>
                    ))}
                    <p className="pl-1 text-xs font-semibold text-muted-foreground">功能</p>
                  </div>

                  {/* 記錄列 */}
                  {activeRecords.length === 0 ? (
                    <p className="py-3 text-center text-sm text-muted-foreground">尚無付款對象</p>
                  ) : activeRecords.map(record => (
                    <div
                      key={record.id}
                      className="grid items-center gap-3"
                      style={{ gridTemplateColumns: `repeat(${activeFields.length}, 1fr) 64px` }}
                    >
                      {activeFields.map(f => (
                        <div key={f.id} className="flex min-h-10 items-center overflow-hidden rounded-lg border border-border bg-muted/40 px-3.5 py-2 text-sm text-foreground">
                          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                            {record.field_values[String(f.id)] || <span className="text-muted-foreground">—</span>}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pl-1">
                        <button
                          onClick={() => { setEditingRecord(record); setShowRecordModal(true) }}
                          className="text-base text-muted-foreground hover:text-foreground"
                          title="編輯"
                        >✏️</button>
                        <button
                          onClick={() => handleDeleteRecord(record)}
                          className="text-sm text-muted-foreground hover:text-destructive"
                          title="刪除"
                        >✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => { setEditingRecord(undefined); setShowRecordModal(true) }}
                className="w-fit text-sm font-medium text-primary hover:underline"
              >
                + 新增付款對象
              </button>
            </CardContent>
          )}
        </Card>
      )}

      {showAddCategory && (
        <AddCategoryModal onSave={handleAddCategory} onClose={() => setShowAddCategory(false)} />
      )}
      {showCategorySettings && activeCat && (
        <CategorySettingsModal
          category={activeCat}
          fields={activeFields}
          onSaveName={handleEditCategoryName}
          onSaveField={handleSaveField}
          onDeleteField={handleDeleteField}
          onDeleteCategory={handleDeleteCategory}
          onClose={() => setShowCategorySettings(false)}
        />
      )}
      {showRecordModal && (
        <RecordModal
          fields={activeFields}
          initial={editingRecord}
          onSave={handleSaveRecord}
          onClose={() => { setShowRecordModal(false); setEditingRecord(undefined) }}
        />
      )}
    </div>
  )
}
