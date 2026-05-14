'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DropdownOption, DropdownField, ExpenseItem } from '@/lib/types'

const DROPDOWN_FIELDS: { field: DropdownField; label: string }[] = [
  { field: 'institution', label: '機構' },
  { field: 'payment_account', label: '出款帳戶' },
]

function OptionSection({
  title,
  items,
  newLabel,
  onNewLabelChange,
  onAdd,
  onDelete,
}: {
  title: string
  items: { id: number; label: string }[]
  newLabel: string
  onNewLabelChange: (v: string) => void
  onAdd: () => void
  onDelete: (id: number) => void
}) {
  return (
    <section>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>{title}</h2>
      <table border={1} cellPadding={8} style={{ marginBottom: 12, borderCollapse: 'collapse', minWidth: 320 }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ textAlign: 'left' }}>選項名稱</th>
            <th style={{ width: 80 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={2} style={{ color: '#9ca3af' }}>尚無選項</td></tr>
          ) : items.map(item => (
            <tr key={item.id}>
              <td>{item.label}</td>
              <td>
                <button onClick={() => onDelete(item.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>
                  刪除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={newLabel}
          onChange={e => onNewLabelChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd() } }}
          placeholder={`新增${title}選項`}
          style={{ flex: 1, maxWidth: 280 }}
        />
        <button onClick={onAdd}>新增</button>
      </div>
    </section>
  )
}

export default function ExpenseFieldsPage() {
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOption[]>([])
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newDropdownLabel, setNewDropdownLabel] = useState<Record<DropdownField, string>>({
    institution: '',
    payment_account: '',
  })
  const [newExpenseLabel, setNewExpenseLabel] = useState('')

  async function loadAll() {
    const [optRes, expRes] = await Promise.all([
      supabase.from('dropdown_options').select('*').order('field').order('sort_order'),
      supabase.from('expense_items').select('*').order('sort_order'),
    ])
    if (optRes.error) setError(optRes.error.message)
    else setDropdownOptions((optRes.data as DropdownOption[]) ?? [])
    if (expRes.error) setError(expRes.error.message)
    else setExpenseItems((expRes.data as ExpenseItem[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  async function handleAddDropdown(field: DropdownField) {
    const label = newDropdownLabel[field].trim()
    if (!label) return
    setError(null)
    const maxOrder = dropdownOptions
      .filter(o => o.field === field)
      .reduce((max, o) => Math.max(max, o.sort_order), -1)
    const { error: e } = await supabase.from('dropdown_options').insert({ field, label, sort_order: maxOrder + 1 })
    if (e) { setError(e.message); return }
    setNewDropdownLabel(prev => ({ ...prev, [field]: '' }))
    await loadAll()
  }

  async function handleDeleteDropdown(id: number) {
    if (!confirm('確定要刪除此選項嗎？')) return
    setError(null)
    const { error: e } = await supabase.from('dropdown_options').delete().eq('id', id)
    if (e) { setError(e.message); return }
    await loadAll()
  }

  async function handleAddExpense() {
    const label = newExpenseLabel.trim()
    if (!label) return
    setError(null)
    const maxOrder = expenseItems.reduce((max, o) => Math.max(max, o.sort_order), -1)
    const { error: e } = await supabase.from('expense_items').insert({ label, sort_order: maxOrder + 1 })
    if (e) { setError(e.message); return }
    setNewExpenseLabel('')
    await loadAll()
  }

  async function handleDeleteExpense(id: number) {
    if (!confirm('確定要刪除此費用項目嗎？')) return
    setError(null)
    const { error: e } = await supabase.from('expense_items').delete().eq('id', id)
    if (e) { setError(e.message); return }
    await loadAll()
  }

  if (loading) return <p>載入中...</p>

  return (
    <div>
      <h1>支出欄位設定</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>管理資金分配申請單中各下拉選單的選項。</p>

      {error && <p style={{ color: 'red', marginBottom: 16 }}>錯誤：{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {DROPDOWN_FIELDS.map(({ field, label }) => (
          <OptionSection
            key={field}
            title={label}
            items={dropdownOptions.filter(o => o.field === field)}
            newLabel={newDropdownLabel[field]}
            onNewLabelChange={v => setNewDropdownLabel(prev => ({ ...prev, [field]: v }))}
            onAdd={() => handleAddDropdown(field)}
            onDelete={handleDeleteDropdown}
          />
        ))}

        <OptionSection
          title="費用項目"
          items={expenseItems}
          newLabel={newExpenseLabel}
          onNewLabelChange={setNewExpenseLabel}
          onAdd={handleAddExpense}
          onDelete={handleDeleteExpense}
        />
      </div>
    </div>
  )
}
