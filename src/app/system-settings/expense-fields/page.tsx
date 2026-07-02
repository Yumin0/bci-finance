'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DropdownOption, DropdownField } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PageHeader from '@/app/_components/PageHeader'

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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>選項名稱</TableHead>
              <TableHead className="w-20">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  尚無選項
                </TableCell>
              </TableRow>
            ) : items.map(item => (
              <TableRow key={item.id}>
                <TableCell>{item.label}</TableCell>
                <TableCell>
                  <Button variant="destructive" size="sm" onClick={() => onDelete(item.id)}>
                    刪除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={e => onNewLabelChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd() } }}
            placeholder={`新增${title}選項`}
            className="max-w-xs"
          />
          <Button onClick={onAdd}>新增</Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ExpenseFieldsPage() {
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newDropdownLabel, setNewDropdownLabel] = useState<Record<DropdownField, string>>({
    institution: '',
    payment_account: '',
  })

  async function loadAll() {
    const optRes = await supabase.from('dropdown_options').select('*').order('field').order('sort_order')
    if (optRes.error) setError(optRes.error.message)
    else setDropdownOptions((optRes.data as DropdownOption[]) ?? [])
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

  if (loading) return <p className="text-muted-foreground">載入中...</p>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader title="支出欄位設定" />
        <p className="mt-1 text-sm text-muted-foreground">管理資金分配申請單中各下拉選單的選項。</p>
      </div>

      {error && <p className="text-sm text-destructive">錯誤：{error}</p>}

      <div className="flex flex-col gap-6">
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

      </div>
    </div>
  )
}
