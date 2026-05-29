'use client'

import { useState } from 'react'
import { saveFormSchema } from '@/app/actions/form-schema'
import { FormBlock, FormSchemaRow, FormSlot, FormColCount, FormType, FormFieldType, FormDataSourceDef } from '@/lib/types'
import TemplateManagementTab from './_template-tab'
import CycleTab from './_cycle-tab'

type FieldDef = {
  id: string
  label: string
  type: FormFieldType
  dataSource: string
  dataSourceLabel: string
}

const FIELD_CATALOG: Record<FormType, FieldDef[]> = {
  funds_allocation: [
    { id: 'serial_number',    label: '資金分配申請單號', type: 'readonly', dataSource: 'auto_number',           dataSourceLabel: '系統自動流水號' },
    { id: 'date',             label: '申請日期', type: 'date',     dataSource: 'none',                          dataSourceLabel: '手動輸入' },
    { id: 'apply_division',   label: '申請處別', type: 'select',   dataSource: 'org_units:division',            dataSourceLabel: '組織單位（處）' },
    { id: 'apply_section',    label: '申請課別', type: 'select',   dataSource: 'org_units:section',             dataSourceLabel: '組織單位（課）' },
    { id: 'applicant',        label: '申請人',   type: 'readonly', dataSource: 'current_user_name',             dataSourceLabel: '目前登入使用者姓名' },
    { id: 'apply_role',       label: '職稱',     type: 'select',   dataSource: 'org_unit_roles',                dataSourceLabel: '組織職稱清單' },
    { id: 'institution',      label: '機構',     type: 'select',   dataSource: 'dropdown_options:institution',  dataSourceLabel: '機構清單（下拉選項設定）' },
    { id: 'payment_account',  label: '出款帳戶', type: 'select',   dataSource: 'dropdown_options:payment_account', dataSourceLabel: '出款帳戶清單（下拉選項設定）' },
    { id: 'expense_item',     label: '費用項目', type: 'select',   dataSource: 'expense_items',                 dataSourceLabel: '費用項目清單（支出欄位設定）' },
    { id: 'name',             label: '項目',     type: 'text',     dataSource: 'none',                          dataSourceLabel: '手動輸入' },
    { id: 'amount',           label: '金額',     type: 'number',   dataSource: 'none',                          dataSourceLabel: '手動輸入' },
    { id: 'category',         label: '類型',     type: 'radio',    dataSource: 'static',                        dataSourceLabel: '固定選項：一般 / 預支' },
    { id: 'note',             label: '備註',     type: 'textarea', dataSource: 'none',                          dataSourceLabel: '手動輸入' },
  ],
  payment_voucher: [
    { id: 'purchase_order_number', label: '採購單號', type: 'readonly', dataSource: 'none',                    dataSourceLabel: '系統自動產生（資金分配單號＋001）' },
    { id: 'date',             label: '日期',     type: 'date',     dataSource: 'none',                          dataSourceLabel: '手動輸入' },
    { id: 'apply_division',   label: '申請處別', type: 'select',   dataSource: 'org_units:division',            dataSourceLabel: '組織單位（處）' },
    { id: 'apply_section',    label: '申請課別', type: 'select',   dataSource: 'org_units:section',             dataSourceLabel: '組織單位（課）' },
    { id: 'applicant',        label: '申請人',   type: 'readonly', dataSource: 'current_user_name',             dataSourceLabel: '目前登入使用者姓名' },
    { id: 'apply_role',       label: '職稱',     type: 'select',   dataSource: 'org_unit_roles',                dataSourceLabel: '組織職稱清單' },
    { id: 'institution',      label: '機構',     type: 'select',   dataSource: 'dropdown_options:institution',  dataSourceLabel: '機構清單（下拉選項設定）' },
    { id: 'payment_account',  label: '出款帳戶', type: 'select',   dataSource: 'dropdown_options:payment_account', dataSourceLabel: '出款帳戶清單（下拉選項設定）' },
    { id: 'expense_item',     label: '費用項目', type: 'select',   dataSource: 'expense_items',                 dataSourceLabel: '費用項目清單（支出欄位設定）' },
    { id: 'name',             label: '項目',     type: 'text',     dataSource: 'none',                          dataSourceLabel: '手動輸入' },
    { id: 'amount',           label: '金額',     type: 'number',   dataSource: 'none',                          dataSourceLabel: '手動輸入' },
    { id: 'note',             label: '備註',     type: 'textarea', dataSource: 'none',                          dataSourceLabel: '手動輸入' },
    { id: 'payment_method',   label: '付款方式', type: 'select',   dataSource: 'static',                        dataSourceLabel: '固定選項（可自訂）' },
  ],
  temp_voucher: [
    { id: 'date',             label: '申請日期', type: 'date',     dataSource: 'none',                          dataSourceLabel: '手動輸入' },
    { id: 'apply_division',   label: '申請處別', type: 'select',   dataSource: 'org_units:division',            dataSourceLabel: '組織單位（處）' },
    { id: 'apply_section',    label: '申請課別', type: 'select',   dataSource: 'org_units:section',             dataSourceLabel: '組織單位（課）' },
    { id: 'applicant',        label: '申請人',   type: 'readonly', dataSource: 'current_user_name',             dataSourceLabel: '目前登入使用者姓名' },
    { id: 'apply_role',       label: '職稱',     type: 'select',   dataSource: 'org_unit_roles',                dataSourceLabel: '組織職稱清單' },
    { id: 'amount',           label: '暫付金額', type: 'number',   dataSource: 'none',                          dataSourceLabel: '手動輸入' },
    { id: 'note',             label: '備註',     type: 'textarea', dataSource: 'none',                          dataSourceLabel: '手動輸入' },
  ],
}

const CUSTOM_FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text',       label: '單行文字' },
  { value: 'number',     label: '數字' },
  { value: 'date',       label: '日期' },
  { value: 'select',     label: '下拉選單' },
  { value: 'radio',      label: '單選按鈕（Radio）' },
  { value: 'textarea',   label: '多行文字' },
  { value: 'attachment', label: '附件上傳' },
]

function fieldPlaceholder(type: FormFieldType): string {
  switch (type) {
    case 'date':       return '年 / 月 / 日'
    case 'select':     return '請選擇'
    case 'number':     return '0'
    case 'textarea':   return '備註內容...'
    case 'radio':      return '○ 一般  ○ 預支'
    case 'readonly':   return '（自動填入）'
    case 'attachment': return '📎 選擇檔案（PDF / JPG / PNG）'
    default:           return '請輸入'
  }
}

type Selection =
  | { kind: 'block'; blockId: string }
  | { kind: 'row';  blockId: string; rowId: string }
  | { kind: 'slot'; blockId: string; rowId: string; slotIdx: number }
  | null

export default function FormSettingsClient({
  initialSchemas,
  dataSources,
}: {
  initialSchemas: Record<FormType, FormBlock[]>
  dataSources: FormDataSourceDef[]
}) {
  const [activeTab, setActiveTab] = useState<FormType | 'templates' | 'cycle'>('funds_allocation')
  const [formType, setFormType]   = useState<FormType>('funds_allocation')
  const [newTemplateTrigger, setNewTemplateTrigger] = useState(0)
  const [schemas,  setSchemas]    = useState<Record<FormType, FormBlock[]>>(initialSchemas)
  const [selection, setSelection] = useState<Selection>(null)
  const [saving,    setSaving]    = useState(false)
  const [savedMsg,  setSavedMsg]  = useState<string | null>(null)
  const [customLabel, setCustomLabel] = useState('')
  const [customType,  setCustomType]  = useState<FormFieldType>('text')
  const [customDs,    setCustomDs]    = useState<string>('static')
  const [staticOptionsInput, setStaticOptionsInput] = useState('')

  const blocks  = schemas[formType]
  const catalog = FIELD_CATALOG[formType]

  // --- Block helpers ---
  function setBlocks(updater: (prev: FormBlock[]) => FormBlock[]) {
    setSchemas(prev => ({ ...prev, [formType]: updater(prev[formType]) }))
  }

  function updateBlock(blockId: string, updater: (b: FormBlock) => FormBlock) {
    setBlocks(prev => prev.map(b => b.id === blockId ? updater(b) : b))
  }

  function setBlockRows(blockId: string, updater: (prev: FormSchemaRow[]) => FormSchemaRow[]) {
    updateBlock(blockId, b => ({ ...b, rows: updater(b.rows) }))
  }

  function addBlock() {
    setBlocks(prev => [...prev, { id: `block_${Date.now()}`, title: null, rows: [] }])
  }

  function deleteBlock(blockId: string) {
    setBlocks(prev => prev.filter(b => b.id !== blockId))
    if (selection?.blockId === blockId) setSelection(null)
  }

  function updateBlockTitle(blockId: string, title: string) {
    updateBlock(blockId, b => ({ ...b, title: title || null }))
  }

  // --- Row helpers ---
  function addRow(blockId: string) {
    setBlockRows(blockId, prev => [...prev, { id: `row_${Date.now()}`, cols: 1, slots: [null] }])
  }

  function deleteRow(blockId: string, rowId: string) {
    setBlockRows(blockId, prev => prev.filter(r => r.id !== rowId))
    if (selection && 'rowId' in selection && selection.rowId === rowId) setSelection(null)
  }

  function setRowRepeatable(blockId: string, rowId: string, value: boolean) {
    setBlockRows(blockId, prev => prev.map(r => r.id === rowId ? { ...r, repeatable: value } : r))
  }

  function moveRow(blockId: string, rowId: string, dir: 'up' | 'down') {
    setBlockRows(blockId, prev => {
      const idx = prev.findIndex(r => r.id === rowId)
      if (idx === -1) return prev
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
  }

  function setRowCols(blockId: string, rowId: string, cols: FormColCount) {
    setBlockRows(blockId, prev => prev.map(r => {
      if (r.id !== rowId) return r
      const newSlots: FormSlot[] = Array(cols).fill(null)
      for (let i = 0; i < Math.min(r.slots.length, cols); i++) newSlots[i] = r.slots[i]
      return { ...r, cols, slots: newSlots }
    }))
    if (selection?.kind === 'slot' && selection.rowId === rowId) {
      setSelection({ kind: 'row', blockId, rowId })
    }
  }

  function placeField(blockId: string, rowId: string, slotIdx: number, def: FieldDef) {
    setBlockRows(blockId, prev => prev.map(r => {
      if (r.id !== rowId) return r
      const slots = [...r.slots]
      slots[slotIdx] = {
        fieldId: def.id, label: def.label, required: false,
        type: def.type, dataSource: def.dataSource,
        ...(def.dataSource === 'static' ? { staticOptions: def.id === 'category' ? ['一般', '預支'] : [] } : {}),
      }
      return { ...r, slots }
    }))
    setSelection({ kind: 'slot', blockId, rowId, slotIdx })
  }

  function placeCustomField(blockId: string, rowId: string, slotIdx: number) {
    const trimmed = customLabel.trim()
    if (!trimmed) return
    const options = staticOptionsInput.split('\n').map(s => s.trim()).filter(Boolean)
    setBlockRows(blockId, prev => prev.map(r => {
      if (r.id !== rowId) return r
      const slots = [...r.slots]
      const isStatic = dataSources.find(ds => ds.source_key === customDs)?.is_static_options
      slots[slotIdx] = {
        fieldId: `custom_${Date.now()}`, label: trimmed, required: false,
        type: customType, dataSource: customType !== 'textarea' ? customDs : 'none',
        ...(isStatic ? { staticOptions: options } : {}),
      }
      return { ...r, slots }
    }))
    setCustomLabel(''); setCustomType('text'); setCustomDs('static'); setStaticOptionsInput('')
    setSelection({ kind: 'slot', blockId, rowId, slotIdx })
  }

  function updateSlot(blockId: string, rowId: string, slotIdx: number, patch: Partial<FormSlot & object>) {
    setBlockRows(blockId, prev => prev.map(r => {
      if (r.id !== rowId) return r
      const slots = [...r.slots]
      const s = slots[slotIdx]
      if (!s) return r
      slots[slotIdx] = { ...s, ...patch }
      return { ...r, slots }
    }))
  }

  function removeField(blockId: string, rowId: string, slotIdx: number) {
    setBlockRows(blockId, prev => prev.map(r => {
      if (r.id !== rowId) return r
      const slots = [...r.slots]
      slots[slotIdx] = null
      return { ...r, slots }
    }))
    setSelection({ kind: 'row', blockId, rowId })
  }

  function swapSlots(blockId: string, rowId: string, idxA: number, idxB: number) {
    setBlockRows(blockId, prev => prev.map(r => {
      if (r.id !== rowId) return r
      const slots = [...r.slots]
      ;[slots[idxA], slots[idxB]] = [slots[idxB], slots[idxA]]
      return { ...r, slots }
    }))
    setSelection({ kind: 'slot', blockId, rowId, slotIdx: idxB })
  }

  function moveFieldToRow(blockId: string, rowId: string, slotIdx: number, direction: 'up' | 'down') {
    const block = blocks.find(b => b.id === blockId)
    if (!block) return
    const rows = block.rows
    const rowIdx = rows.findIndex(r => r.id === rowId)
    const targetRowIdx = direction === 'up' ? rowIdx - 1 : rowIdx + 1
    if (targetRowIdx < 0 || targetRowIdx >= rows.length) return
    const targetRow = rows[targetRowIdx]
    const targetSlotIdx = targetRow.slots.findIndex(s => s === null)
    if (targetSlotIdx === -1) return
    const field = rows[rowIdx].slots[slotIdx]
    setBlockRows(blockId, prev => prev.map((r, idx) => {
      if (idx === rowIdx) {
        const slots = [...r.slots]; slots[slotIdx] = null; return { ...r, slots }
      }
      if (idx === targetRowIdx) {
        const slots = [...r.slots]; slots[targetSlotIdx] = field; return { ...r, slots }
      }
      return r
    }))
    setSelection({ kind: 'slot', blockId, rowId: targetRow.id, slotIdx: targetSlotIdx })
  }

  async function handleSave() {
    setSaving(true); setSavedMsg(null)
    const { error } = await saveFormSchema(formType, schemas[formType])
    setSaving(false)
    if (error) { setSavedMsg(error) } else { setSavedMsg('已儲存'); setTimeout(() => setSavedMsg(null), 3000) }
  }

  // --- Derived state ---
  const allRows = blocks.flatMap(b => b.rows)
  const placedFieldIds = new Set(
    allRows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null).map(s => s.fieldId))
  )
  const availableFields = catalog.filter(f => !placedFieldIds.has(f.id))

  const selectedBlock = selection ? (blocks.find(b => b.id === selection.blockId) ?? null) : null
  const selectedRow   = (selection && 'rowId' in selection) ? (selectedBlock?.rows.find(r => r.id === selection.rowId) ?? null) : null
  const selectedSlot  = selection?.kind === 'slot' ? (selectedRow?.slots[selection.slotIdx] ?? null) : null
  const selectedCatalogDef = selectedSlot ? catalog.find(f => f.id === selectedSlot.fieldId) : null

  const allSelectSlots = blocks.flatMap(b =>
    b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null && (s.type === 'select' || s.type === 'radio')))
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>表單設定</h1>
        {activeTab !== 'templates' && activeTab !== 'cycle' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {savedMsg && <span style={{ fontSize: 13, color: savedMsg === '已儲存' ? '#16a34a' : '#dc2626' }}>{savedMsg}</span>}
            <button onClick={handleSave} disabled={saving} style={btnPrimary}>
              {saving ? '儲存中...' : '儲存設定'}
            </button>
          </div>
        ) : activeTab === 'templates' ? (
          <button onClick={() => setNewTemplateTrigger(c => c + 1)} style={btnPrimary}>
            ＋ 新增範本
          </button>
        ) : null}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 20 }}>
        {(['funds_allocation', 'payment_voucher', 'temp_voucher'] as FormType[]).map(ft => (
          <button key={ft} onClick={() => { setActiveTab(ft); setFormType(ft); setSelection(null) }}
            style={{ padding: '8px 20px', fontSize: 14, fontWeight: 500, background: 'none', border: 'none',
              borderBottom: activeTab === ft ? '2px solid #111827' : '2px solid transparent',
              marginBottom: -1, cursor: 'pointer', color: activeTab === ft ? '#111827' : '#6b7280' }}>
            {ft === 'funds_allocation' ? '資金分配申請單' : ft === 'payment_voucher' ? '付款憑單' : '暫付款沖銷憑單'}
          </button>
        ))}
        <button onClick={() => { setActiveTab('cycle'); setSelection(null) }}
          style={{ padding: '8px 20px', fontSize: 14, fontWeight: 500, background: 'none', border: 'none',
            borderBottom: activeTab === 'cycle' ? '2px solid #111827' : '2px solid transparent',
            marginBottom: -1, cursor: 'pointer', color: activeTab === 'cycle' ? '#111827' : '#6b7280' }}>
          申請週期
        </button>
        <button onClick={() => { setActiveTab('templates'); setSelection(null) }}
          style={{ padding: '8px 20px', fontSize: 14, fontWeight: 500, background: 'none', border: 'none',
            borderBottom: activeTab === 'templates' ? '2px solid #111827' : '2px solid transparent',
            marginBottom: -1, cursor: 'pointer', color: activeTab === 'templates' ? '#111827' : '#6b7280' }}>
          範本管理
        </button>
      </div>

      {/* Cycle tab */}
      {activeTab === 'cycle' && <CycleTab />}

      {/* Templates tab */}
      {activeTab === 'templates' && <TemplateManagementTab newTrigger={newTemplateTrigger} />}

      {/* Main layout */}
      {activeTab !== 'templates' && activeTab !== 'cycle' && <div style={{ display: 'flex', gap: 0, minHeight: 500 }}>
        {/* Canvas */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 20 }}>
          {blocks.map((block, blockIdx) => {
            const isBlockSel = selection?.kind === 'block' && selection.blockId === block.id
            return (
            <div key={block.id} style={{
              marginBottom: 16,
              border: `1.5px solid ${isBlockSel ? '#2563eb' : 'var(--border-color)'}`,
              borderRadius: 10,
              overflow: 'hidden',
            }}>
              {/* Block header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                background: isBlockSel ? '#eff6ff' : '#f3f4f6', borderBottom: '1px solid var(--border-color)',
              }}>
                <span
                  onClick={() => setSelection({ kind: 'block', blockId: block.id })}
                  style={{ fontSize: 12, color: isBlockSel ? '#2563eb' : 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                  第 {blockIdx + 1} 區塊
                </span>
                <input
                  value={block.title ?? ''}
                  onChange={e => updateBlockTitle(block.id, e.target.value)}
                  placeholder="區塊名稱（選填）"
                  style={{
                    flex: 1, padding: '4px 8px', fontSize: 13, border: '1px solid #d1d5db',
                    borderRadius: 5, background: 'white', color: 'var(--text-body)',
                  }}
                />
                <button
                  onClick={() => deleteBlock(block.id)}
                  title="刪除區塊"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, padding: '0 4px', lineHeight: 1 }}>
                  ×
                </button>
              </div>

              {/* Rows inside block */}
              <div style={{ padding: '8px 10px' }}>
                {block.rows.map((row, rowIdx) => {
                  const isRowSel = selection?.kind === 'row' && selection.rowId === row.id && selection.blockId === block.id
                  return (
                    <div key={row.id} style={{ marginBottom: 8, border: `1.5px solid ${isRowSel ? '#2563eb' : '#e5e7eb'}`, borderRadius: 7, overflow: 'hidden' }}>
                      {/* Row header */}
                      <div onClick={() => setSelection({ kind: 'row', blockId: block.id, rowId: row.id })}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px',
                          background: isRowSel ? '#eff6ff' : '#f9fafb', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>第 {rowIdx + 1} 列</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {([1, 2, 3] as FormColCount[]).map(c => (
                            <button key={c} onClick={e => { e.stopPropagation(); setRowCols(block.id, row.id, c) }}
                              style={{ padding: '2px 7px', fontSize: 11, border: '1px solid',
                                borderColor: row.cols === c ? '#2563eb' : '#d1d5db', borderRadius: 4,
                                background: row.cols === c ? '#2563eb' : 'white',
                                color: row.cols === c ? 'white' : '#374151', cursor: 'pointer', fontWeight: row.cols === c ? 600 : 400 }}>
                              {c}欄
                            </button>
                          ))}
                          <button onClick={e => { e.stopPropagation(); deleteRow(block.id, row.id) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
                        </div>
                      </div>
                      {/* Slots */}
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${row.cols}, 1fr)` }}>
                        {row.slots.map((slot, slotIdx) => {
                          const isSlotSel = selection?.kind === 'slot' && selection.blockId === block.id && selection.rowId === row.id && selection.slotIdx === slotIdx
                          return (
                            <div key={slotIdx} onClick={() => setSelection({ kind: 'slot', blockId: block.id, rowId: row.id, slotIdx })}
                              style={{ padding: 12, borderRight: slotIdx < row.cols - 1 ? '1px solid var(--border-color)' : 'none',
                                background: isSlotSel ? '#eff6ff' : 'white', cursor: 'pointer', minHeight: 64 }}>
                              {slot ? (
                                <>
                                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                                    {slot.label}{slot.required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                                    {slot.showWhen && <span style={{ fontSize: 10, marginLeft: 5, padding: '1px 5px', background: '#fef3c7', color: '#92400e', borderRadius: 3 }}>條件</span>}
                                  </div>
                                  <div style={{ padding: '5px 10px', border: '1px solid var(--btn-border)', borderRadius: 5,
                                    fontSize: 13, color: 'var(--text-subtle)', background: slot.type === 'readonly' ? '#f3f4f6' : 'white' }}>
                                    {slot.type === 'radio' && slot.staticOptions?.length
                                      ? slot.staticOptions.map(o => `○ ${o}`).join('  ')
                                      : fieldPlaceholder(slot.type)}
                                  </div>
                                </>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  height: '100%', minHeight: 40,
                                  border: `1.5px dashed ${isSlotSel ? '#93c5fd' : '#d1d5db'}`, borderRadius: 5,
                                  color: isSlotSel ? '#2563eb' : '#9ca3af', fontSize: 13 }}>
                                  ＋ 點選新增欄位
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {/* Add row button inside block */}
                <button onClick={() => addRow(block.id)}
                  style={{ width: '100%', padding: '7px 10px', border: '1.5px dashed #d1d5db', borderRadius: 6,
                    background: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                  ＋ 新增列
                </button>
              </div>
            </div>
            )
          })}

          {/* Add block button */}
          <button onClick={addBlock}
            style={{ width: '100%', padding: 12, border: '2px dashed #d1d5db', borderRadius: 10,
              background: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}>
            ＋ 新增區塊
          </button>
        </div>

        {/* Right panel */}
        <div style={{ width: 260, flexShrink: 0, borderLeft: '1px solid var(--border-color)', paddingLeft: 20, overflowY: 'auto', position: 'sticky', top: 60, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 60px)' }}>

          {selection === null && (
            <div style={{ paddingTop: 60, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13, lineHeight: 1.8 }}>
              點選欄位或列<br />可在此編輯設定
            </div>
          )}

          {/* Block settings */}
          {selection?.kind === 'block' && (() => {
            const block = blocks.find(b => b.id === selection.blockId)
            if (!block) return null
            return (
              <div>
                <p style={panelTitle}>區塊設定</p>
                <button onClick={() => deleteBlock(selection.blockId)} style={btnDanger}>刪除此區塊</button>
              </div>
            )
          })()}

          {/* Row settings */}
          {selection?.kind === 'row' && selectedRow && selectedBlock && (
            <div>
              <p style={panelTitle}>列設定</p>
              <p style={panelLabel}>移動列</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                {([{ label: '↑ 上移', dir: 'up' as const }, { label: '↓ 下移', dir: 'down' as const }]).map(({ label, dir }) => {
                  const rows = selectedBlock.rows
                  const idx = rows.findIndex(r => r.id === selectedRow.id)
                  const disabled = dir === 'up' ? idx <= 0 : idx >= rows.length - 1
                  return (
                    <button key={dir} onClick={() => moveRow(selectedBlock.id, selectedRow.id, dir)}
                      disabled={disabled}
                      style={{ flex: 1, padding: '7px 0', fontSize: 13, border: '1px solid var(--btn-border)', borderRadius: 6,
                        background: disabled ? '#f9fafb' : 'white',
                        color: disabled ? '#d1d5db' : '#374151',
                        cursor: disabled ? 'not-allowed' : 'pointer' }}>
                      {label}
                    </button>
                  )
                })}
              </div>
              <p style={panelLabel}>欄數</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                {([1, 2, 3] as FormColCount[]).map(c => (
                  <button key={c} onClick={() => setRowCols(selectedBlock.id, selectedRow.id, c)}
                    style={{ flex: 1, padding: '7px 0', fontSize: 13, border: '1px solid',
                      borderColor: selectedRow.cols === c ? '#2563eb' : '#d1d5db', borderRadius: 6,
                      background: selectedRow.cols === c ? '#2563eb' : 'white',
                      color: selectedRow.cols === c ? 'white' : '#374151', cursor: 'pointer' }}>
                    {c} 欄
                  </button>
                ))}
              </div>
              <p style={panelLabel}>允許新增多列</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                {[true, false].map(val => (
                  <button key={String(val)} onClick={() => setRowRepeatable(selectedBlock.id, selectedRow.id, val)}
                    style={{ flex: 1, padding: '7px 0', fontSize: 13, border: '1px solid',
                      borderColor: (selectedRow.repeatable ?? false) === val ? '#2563eb' : '#d1d5db', borderRadius: 6,
                      background: (selectedRow.repeatable ?? false) === val ? '#2563eb' : 'white',
                      color: (selectedRow.repeatable ?? false) === val ? 'white' : '#374151', cursor: 'pointer' }}>
                    {val ? '是' : '否'}
                  </button>
                ))}
              </div>
              <button onClick={() => deleteRow(selectedBlock.id, selectedRow.id)} style={btnDanger}>刪除此列</button>
            </div>
          )}

          {/* Empty slot */}
          {selection?.kind === 'slot' && !selectedSlot && selectedBlock && (
            <div>
              <p style={panelTitle}>新增欄位</p>
              {availableFields.length > 0 && (
                <>
                  <p style={panelLabel}>從現有欄位選取</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
                    {availableFields.map(f => (
                      <button key={f.id} onClick={() => placeField(selectedBlock.id, selection.rowId, selection.slotIdx, f)}
                        style={{ padding: '7px 12px', textAlign: 'left', border: '1px solid var(--border-color)',
                          borderRadius: 6, background: 'white', fontSize: 13, cursor: 'pointer', color: 'var(--text-body)' }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
                <p style={panelLabel}>新增自訂欄位</p>
                <input value={customLabel} onChange={e => setCustomLabel(e.target.value)}
                  placeholder="欄位名稱" style={{ ...panelInput, marginBottom: 8 }} />
                <select value={customType}
                  onChange={e => {
                    const t = e.target.value as FormFieldType
                    setCustomType(t)
                    setCustomDs(t === 'select' || t === 'radio' ? 'static' : 'none')
                    setStaticOptionsInput('')
                  }}
                  style={{ ...panelInput, marginBottom: 8, cursor: 'pointer' }}>
                  {CUSTOM_FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {customType !== 'textarea' && customType !== 'attachment' && (
                  <>
                    <p style={{ ...panelLabel }}>資料來源</p>
                    <select value={customDs}
                      onChange={e => { setCustomDs(e.target.value); setStaticOptionsInput('') }}
                      style={{ ...panelInput, marginBottom: 8, cursor: 'pointer' }}>
                      {dataSources.filter(ds => ds.applicable_types.includes(customType)).map(ds => (
                        <option key={ds.source_key} value={ds.source_key}>{ds.label}</option>
                      ))}
                    </select>
                    {dataSources.find(ds => ds.source_key === customDs)?.is_static_options && (
                      <>
                        <p style={{ ...panelLabel }}>選項內容（每行一個）</p>
                        <textarea value={staticOptionsInput} onChange={e => setStaticOptionsInput(e.target.value)}
                          placeholder={'選項一\n選項二\n選項三'} rows={4}
                          style={{ ...panelInput, resize: 'vertical', marginBottom: 8 }} />
                      </>
                    )}
                  </>
                )}
                <button onClick={() => placeCustomField(selectedBlock.id, selection.rowId, selection.slotIdx)}
                  disabled={!customLabel.trim()}
                  style={{ width: '100%', padding: '7px', fontSize: 13, border: '1px solid var(--btn-border)', borderRadius: 6,
                    background: customLabel.trim() ? '#111827' : '#f3f4f6',
                    color: customLabel.trim() ? 'white' : '#9ca3af',
                    cursor: customLabel.trim() ? 'pointer' : 'not-allowed' }}>
                  新增
                </button>
              </div>
            </div>
          )}

          {/* Filled slot */}
          {selection?.kind === 'slot' && selectedSlot && selectedRow && selectedBlock && (
            <div>
              <p style={panelTitle}>欄位設定</p>

              <p style={panelLabel}>顯示標籤</p>
              <input value={selectedSlot.label}
                onChange={e => updateSlot(selectedBlock.id, selectedRow.id, selection.slotIdx, { label: e.target.value })}
                style={{ ...panelInput, marginBottom: 14 }} />

              <p style={panelLabel}>必填</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {[true, false].map(val => (
                  <button key={String(val)} onClick={() => updateSlot(selectedBlock.id, selectedRow.id, selection.slotIdx, { required: val })}
                    style={{ flex: 1, padding: '7px 0', fontSize: 13, border: '1px solid',
                      borderColor: selectedSlot.required === val ? '#2563eb' : '#d1d5db', borderRadius: 6,
                      background: selectedSlot.required === val ? '#2563eb' : 'white',
                      color: selectedSlot.required === val ? 'white' : '#374151', cursor: 'pointer' }}>
                    {val ? '必填' : '選填'}
                  </button>
                ))}
              </div>

              {(!selectedCatalogDef || selectedCatalogDef.type !== 'readonly') && (
                <>
                  <p style={panelLabel}>欄位類型</p>
                  <select
                    value={selectedSlot.type}
                    onChange={e => {
                      const t = e.target.value as FormFieldType
                      const defaultDs = (t === 'select' || t === 'radio') ? 'static' : 'none'
                      updateSlot(selectedBlock.id, selectedRow.id, selection.slotIdx, { type: t, dataSource: defaultDs, staticOptions: undefined })
                    }}
                    style={{ ...panelInput, marginBottom: 14, cursor: 'pointer' }}>
                    {CUSTOM_FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </>
              )}

              {selectedSlot.type !== 'textarea' && selectedSlot.type !== 'attachment' && (
                <div style={{ marginBottom: 14, padding: 10, background: 'var(--bg-sidebar)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  <p style={{ ...panelLabel, marginBottom: 4 }}>資料來源</p>
                  {(!selectedCatalogDef || selectedSlot.type === 'select' || selectedSlot.type === 'radio' || selectedCatalogDef.type !== 'readonly') ? (
                    <>
                      <select
                        value={selectedSlot.dataSource}
                        onChange={e => {
                          const isStatic = dataSources.find(ds => ds.source_key === e.target.value)?.is_static_options
                          updateSlot(selectedBlock.id, selectedRow.id, selection.slotIdx, {
                            dataSource: e.target.value,
                            staticOptions: isStatic ? (selectedSlot.staticOptions ?? []) : undefined,
                          })
                        }}
                        style={{ ...panelInput, marginBottom: 8, cursor: 'pointer' }}>
                        {dataSources.filter(ds => ds.applicable_types.includes(selectedSlot.type)).map(ds => (
                          <option key={ds.source_key} value={ds.source_key}>{ds.label}</option>
                        ))}
                      </select>
                      {dataSources.find(ds => ds.source_key === selectedSlot.dataSource)?.is_static_options && (
                        <>
                          <p style={{ ...panelLabel, marginTop: 4 }}>選項內容（每行一個）</p>
                          <textarea
                            value={(selectedSlot.staticOptions ?? []).join('\n')}
                            onChange={e => updateSlot(selectedBlock.id, selectedRow.id, selection.slotIdx, {
                              staticOptions: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                            })}
                            rows={4}
                            style={{ ...panelInput, resize: 'vertical' }} />
                        </>
                      )}
                    </>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--text-body)', margin: 0 }}>
                      {selectedCatalogDef?.dataSourceLabel ?? '—'}
                    </p>
                  )}
                </div>
              )}

              {/* 條件顯示 */}
              <div style={{ marginBottom: 14, padding: 10, background: 'var(--bg-sidebar)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                <p style={{ ...panelLabel, marginBottom: 6 }}>條件顯示</p>
                <select
                  value={selectedSlot.showWhen?.fieldId ?? ''}
                  onChange={e => {
                    const fId = e.target.value
                    updateSlot(selectedBlock.id, selectedRow.id, selection.slotIdx, {
                      showWhen: fId ? { fieldId: fId, values: [] } : undefined,
                    })
                  }}
                  style={{ ...panelInput, marginBottom: 6, cursor: 'pointer' }}>
                  <option value="">永遠顯示</option>
                  {allSelectSlots
                    .filter(s => s.fieldId !== selectedSlot.fieldId)
                    .map(s => <option key={s.fieldId} value={s.fieldId}>{s.label}</option>)}
                </select>
                {selectedSlot.showWhen?.fieldId && (() => {
                  const triggerSlot = allSelectSlots.find(s => s.fieldId === selectedSlot.showWhen?.fieldId)
                  const checkedValues = selectedSlot.showWhen.values
                  return (
                    <>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>當上述欄位等於（可多選）</p>
                      {triggerSlot?.staticOptions?.length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {triggerSlot.staticOptions.map(o => (
                            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={checkedValues.includes(o)}
                                onChange={e => {
                                  const newValues = e.target.checked
                                    ? [...checkedValues, o]
                                    : checkedValues.filter(v => v !== o)
                                  updateSlot(selectedBlock.id, selectedRow.id, selection.slotIdx, {
                                    showWhen: { fieldId: selectedSlot.showWhen!.fieldId, values: newValues },
                                  })
                                }}
                              />
                              {o}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <textarea
                          value={checkedValues.join('\n')}
                          onChange={e => updateSlot(selectedBlock.id, selectedRow.id, selection.slotIdx, {
                            showWhen: { fieldId: selectedSlot.showWhen!.fieldId, values: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) },
                          })}
                          placeholder={'觸發值一\n觸發值二'}
                          rows={3}
                          style={{ ...panelInput, resize: 'vertical' }} />
                      )}
                    </>
                  )
                })()}
              </div>

              <p style={panelLabel}>調整位置</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                {[{ label: '← 左移', delta: -1 }, { label: '右移 →', delta: 1 }].map(({ label, delta }) => {
                  const target = selection.slotIdx + delta
                  const disabled = target < 0 || target >= selectedRow.cols
                  return (
                    <button key={label} onClick={() => swapSlots(selectedBlock.id, selectedRow.id, selection.slotIdx, target)}
                      disabled={disabled}
                      style={{ flex: 1, padding: '7px 0', fontSize: 13, border: '1px solid var(--btn-border)', borderRadius: 6,
                        background: disabled ? '#f9fafb' : 'white',
                        color: disabled ? '#d1d5db' : '#374151',
                        cursor: disabled ? 'not-allowed' : 'pointer' }}>
                      {label}
                    </button>
                  )
                })}
              </div>
              {(() => {
                const blockRows = selectedBlock.rows
                const rowIdx = blockRows.findIndex(r => r.id === selectedRow.id)
                const canUp   = rowIdx > 0 && blockRows[rowIdx - 1].slots.some(s => s === null)
                const canDown = rowIdx < blockRows.length - 1 && blockRows[rowIdx + 1].slots.some(s => s === null)
                return (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                    {[{ label: '↑ 移至上列', dir: 'up' as const, ok: canUp }, { label: '↓ 移至下列', dir: 'down' as const, ok: canDown }].map(({ label, dir, ok }) => (
                      <button key={label} onClick={() => moveFieldToRow(selectedBlock.id, selectedRow.id, selection.slotIdx, dir)}
                        disabled={!ok}
                        style={{ flex: 1, padding: '7px 0', fontSize: 12, border: '1px solid var(--btn-border)', borderRadius: 6,
                          background: !ok ? '#f9fafb' : 'white',
                          color: !ok ? '#d1d5db' : '#374151',
                          cursor: !ok ? 'not-allowed' : 'pointer' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                )
              })()}

              <button onClick={() => removeField(selectedBlock.id, selectedRow.id, selection.slotIdx)} style={btnDanger}>
                移除此欄位
              </button>
            </div>
          )}
        </div>
      </div>}
    </div>
  )
}

const panelTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: 'var(--text-title)', marginBottom: 14, marginTop: 0 }
const panelLabel: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6, marginTop: 0 }
const panelInput: React.CSSProperties = { width: '100%', padding: '6px 10px', border: '1px solid var(--btn-border)', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties = { padding: '8px 20px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const btnDanger: React.CSSProperties = { width: '100%', padding: '8px 12px', background: 'white', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 13, cursor: 'pointer' }
