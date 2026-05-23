'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { PayeeCategory, PayeeCategoryField, PayeeFieldType, PayeeRecord } from '@/lib/types'
import {
  getPayeeCategories,
  getAllPayeeCategoryFields,
  getPayeeRecords,
  addPayeeCategory,
  updatePayeeCategory,
  deletePayeeCategory,
  addPayeeCategoryField,
  updatePayeeCategoryField,
  deletePayeeCategoryField,
  addPayeeRecord,
  updatePayeeRecord,
  deletePayeeRecord,
} from '@/app/actions/payee'

const FIELD_TYPE_LABELS: Record<PayeeFieldType, string> = {
  text: '文字（單行）',
  number: '數字',
  dropdown: '下拉選單',
  date: '日期',
}

// ---- Inline 欄位表單（在 CategorySettingsModal 內使用）----
function InlineFieldForm({
  initial,
  onSave,
  onCancel,
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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 7,
    border: '1px solid var(--border-color)', background: 'var(--bg-page)',
    color: 'var(--text-body)', boxSizing: 'border-box',
  }

  return (
    <div style={{ border: '1px solid var(--primary)', borderRadius: 10, padding: '14px 14px 12px', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>欄位名稱</p>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="例如：銀行帳號" style={inputStyle} />
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>欄位類型</p>
          <select value={fieldType} onChange={e => setFieldType(e.target.value as PayeeFieldType)} style={inputStyle}>
            {(Object.entries(FIELD_TYPE_LABELS) as [PayeeFieldType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      {fieldType === 'dropdown' && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>選項（每行一個）</p>
          <textarea value={optionsText} onChange={e => setOptionsText(e.target.value)} rows={3}
            placeholder={'選項一\n選項二\n選項三'} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      )}
      {error && <p style={{ color: '#dc2626', fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="outline" onClick={onCancel} disabled={saving} style={{ fontSize: 12, padding: '4px 12px' }}>取消</Button>
        <Button onClick={handleSave} disabled={saving} style={{ fontSize: 12, padding: '4px 12px' }}>
          {saving ? '儲存中...' : '儲存'}
        </Button>
      </div>
    </div>
  )
}

// ---- 新增類別 Modal（僅新增用）----
function AddCategoryModal({
  onSave,
  onClose,
}: {
  onSave: (name: string) => Promise<void>
  onClose: () => void
}) {
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 28, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>新增付款對象類別</h3>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          placeholder="例如：職員、廠商"
          style={{ width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-body)', boxSizing: 'border-box' }} />
        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <Button variant="outline" onClick={onClose} disabled={saving}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '儲存中...' : '儲存'}</Button>
        </div>
      </div>
    </div>
  )
}

// ---- 類別設定 Modal（改名 + 管理欄位inline + 刪除，三合一）----
function CategorySettingsModal({
  category,
  fields,
  onSaveName,
  onSaveField,
  onDeleteField,
  onDeleteCategory,
  onClose,
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
  // 'new' = 新增表單展開, field.id = 該欄位編輯展開, null = 無
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 28, width: 580, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700 }}>類別設定</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* 類別名稱 */}
          <section>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>類別名稱</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={name} onChange={e => { setName(e.target.value); setNameSaved(false) }}
                style={{ flex: 1, padding: '8px 12px', fontSize: 14, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-body)', boxSizing: 'border-box' }} />
              <Button onClick={handleSaveName} disabled={savingName} style={{ fontSize: 13, padding: '5px 16px', whiteSpace: 'nowrap' }}>
                {savingName ? '儲存中...' : nameSaved ? '✓ 已儲存' : '儲存'}
              </Button>
            </div>
            {nameError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{nameError}</p>}
          </section>

          {/* 欄位管理 */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>欄位管理</p>
              {editingFieldId === null && (
                <Button onClick={() => setEditingFieldId('new')} style={{ fontSize: 12, padding: '4px 12px' }}>+ 新增欄位</Button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fields.map(field => (
                editingFieldId === field.id ? (
                  <InlineFieldForm key={field.id} initial={field}
                    onSave={handleSaveField}
                    onCancel={() => setEditingFieldId(null)} />
                ) : (
                  <div key={field.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 80px', padding: '10px 14px', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-card)' }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-body)' }}>{field.label}</span>
                      {field.field_type === 'dropdown' && field.options && field.options.length > 0 && (
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>選項：{field.options.join('、')}</p>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{FIELD_TYPE_LABELS[field.field_type]}</span>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setEditingFieldId(field.id)} disabled={editingFieldId !== null}
                        style={{ fontSize: 13, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: editingFieldId !== null ? 0.4 : 1 }}>編輯</button>
                      <button onClick={() => onDeleteField(field)} disabled={editingFieldId !== null}
                        style={{ fontSize: 13, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: editingFieldId !== null ? 0.4 : 1 }}>刪除</button>
                    </div>
                  </div>
                )
              ))}

              {/* 新增欄位 inline 表單 */}
              {editingFieldId === 'new' && (
                <InlineFieldForm
                  onSave={handleSaveField}
                  onCancel={() => setEditingFieldId(null)} />
              )}

              {fields.length === 0 && editingFieldId === null && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>尚未設定任何欄位</p>
              )}
            </div>
          </section>

          {/* 危險區域 */}
          <section style={{ paddingTop: 4 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>危險區域</p>
            <div style={{ border: '1px solid #fca5a5', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)' }}>刪除此類別</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>此操作無法復原，所有欄位與付款對象資料也會一併刪除。</p>
              </div>
              <Button variant="outline" onClick={onDeleteCategory}
                style={{ fontSize: 13, padding: '5px 14px', color: '#dc2626', borderColor: '#fca5a5', whiteSpace: 'nowrap', marginLeft: 16 }}>
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
  fields,
  initial,
  onSave,
  onClose,
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 28, width: 480, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{initial ? '編輯付款對象' : '新增付款對象'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {fields.map(f => (
            <label key={f.id} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)' }}>
              {f.label}
              {f.field_type === 'dropdown' ? (
                <select value={values[String(f.id)] ?? ''} onChange={e => set(f.id, e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 12px', fontSize: 14, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-body)', boxSizing: 'border-box' }}>
                  <option value="">— 請選擇 —</option>
                  {(f.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                  value={values[String(f.id)] ?? ''}
                  onChange={e => set(f.id, e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 12px', fontSize: 14, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-body)', boxSizing: 'border-box' }}
                />
              )}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
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

  // 付款對象 Modal
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<PayeeRecord | undefined>()

  async function loadBase() {
    const [cats, flds] = await Promise.all([getPayeeCategories(), getAllPayeeCategoryFields()])
    setCategories(cats)
    setFields(flds)
    return cats
  }

  async function loadRecords(categoryId: number) {
    const recs = await getPayeeRecords(categoryId)
    setRecords(recs)
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

  // Category handlers
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

  // Field handlers
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

  // Record handlers
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

  if (loading) return <p style={{ color: 'var(--text-muted)', padding: 32 }}>載入中...</p>

  return (
    <div>
      {/* 頁首 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>付款對象設定</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            自訂付款對象類別，並管理各類別的付款對象資料。
          </p>
        </div>
        <Button onClick={() => setShowAddCategory(true)}>+ 新增類別</Button>
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 16 }}>錯誤：{error}</p>}

      {categories.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 12, color: 'var(--text-muted)' }}>
          尚未建立任何類別，請點右上角「+ 新增類別」開始設定。
        </div>
      ) : (
        <>
          {/* 類別 Tab 列 */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border-color)', marginBottom: 0 }}>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => switchCategory(cat.id)}
                style={{
                  padding: '8px 20px', fontSize: 14, fontWeight: activeId === cat.id ? 700 : 400,
                  color: activeId === cat.id ? 'var(--primary)' : 'var(--text-muted)',
                  background: 'none', border: 'none',
                  borderBottom: activeId === cat.id ? '2px solid var(--primary)' : '2px solid transparent',
                  marginBottom: -2, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                {cat.name}
              </button>
            ))}
          </div>

          {activeCat && (
            <div style={{ marginTop: 20 }}>
              {/* 類別設定按鈕 */}
              <div style={{ marginBottom: 20 }}>
                <Button variant="outline" onClick={() => setShowCategorySettings(true)}
                  style={{ fontSize: 13, padding: '5px 14px' }}>類別設定</Button>
              </div>

              {/* 付款對象卡片區塊 */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: '20px 24px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text-body)' }}>{activeCat.name}</h3>

                {activeFields.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0 12px', textAlign: 'center' }}>
                    請先點「類別設定」建立此類別的欄位，再新增付款對象。
                  </p>
                ) : (
                  <>
                    {/* 欄位標題 */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${activeFields.length}, 1fr) 64px`, gap: 12, marginBottom: 8 }}>
                      {activeFields.map(f => (
                        <p key={f.id} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', paddingLeft: 2 }}>{f.label}</p>
                      ))}
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', paddingLeft: 2 }}>功能</p>
                    </div>

                    {/* 項目列 */}
                    {activeRecords.map(record => (
                      <div key={record.id} style={{ display: 'grid', gridTemplateColumns: `repeat(${activeFields.length}, 1fr) 64px`, gap: 12, marginBottom: 8, alignItems: 'center' }}>
                        {activeFields.map(f => (
                          <div key={f.id} style={{ padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 14, color: 'var(--text-body)', border: '1px solid var(--border-color)', minHeight: 40, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {record.field_values[String(f.id)] || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 4 }}>
                          <button onClick={() => { setEditingRecord(record); setShowRecordModal(true) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', fontSize: 16, lineHeight: 1, color: 'var(--text-muted)' }} title="編輯">✏️</button>
                          <button onClick={() => handleDeleteRecord(record)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', fontSize: 13, color: 'var(--text-muted)' }} title="刪除">✕</button>
                        </div>
                      </div>
                    ))}

                    {activeRecords.length === 0 && (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0 12px', textAlign: 'center' }}>尚無付款對象</p>
                    )}
                  </>
                )}

                <button onClick={() => { setEditingRecord(undefined); setShowRecordModal(true) }}
                  style={{ marginTop: 4, fontSize: 13, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontWeight: 500 }}>
                  + 新增付款對象
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {showAddCategory && (
        <AddCategoryModal
          onSave={handleAddCategory}
          onClose={() => setShowAddCategory(false)} />
      )}

      {showCategorySettings && activeCat && (
        <CategorySettingsModal
          category={activeCat}
          fields={activeFields}
          onSaveName={handleEditCategoryName}
          onSaveField={handleSaveField}
          onDeleteField={handleDeleteField}
          onDeleteCategory={handleDeleteCategory}
          onClose={() => setShowCategorySettings(false)} />
      )}

      {showRecordModal && (
        <RecordModal fields={activeFields} initial={editingRecord}
          onSave={handleSaveRecord}
          onClose={() => { setShowRecordModal(false); setEditingRecord(undefined) }} />
      )}
    </div>
  )
}
