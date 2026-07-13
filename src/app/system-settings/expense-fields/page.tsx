'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DropdownOption, DropdownField, OrgUnit } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PageHeader from '@/app/_components/PageHeader'
import { OrgScopeTree, unitLabel } from '@/app/_components/OrgScopeTree'

// 去頭尾空白、不分大小寫，用於出款帳戶名稱防重複比對
function normalizeLabel(s: string): string {
  return s.trim().toLowerCase()
}

// ── 機構：維持原本單純的新增/刪除 ──
function InstitutionSection({
  items,
  newLabel,
  onNewLabelChange,
  onAdd,
  onDelete,
}: {
  items: DropdownOption[]
  newLabel: string
  onNewLabelChange: (v: string) => void
  onAdd: () => void
  onDelete: (id: number) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>機構</CardTitle>
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
                <TableCell colSpan={2} className="text-center text-muted-foreground">尚無選項</TableCell>
              </TableRow>
            ) : items.map(item => (
              <TableRow key={item.id}>
                <TableCell>{item.label}</TableCell>
                <TableCell>
                  <Button variant="destructive" size="sm" onClick={() => onDelete(item.id)}>刪除</Button>
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
            placeholder="新增機構選項"
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
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newInstitution, setNewInstitution] = useState('')
  const [newAccount, setNewAccount] = useState('')
  // 出款帳戶新增/改名的就地錯誤訊息（顯示在區塊內，避免使用者看不到頁首的錯誤）
  const [accountError, setAccountError] = useState<string | null>(null)

  // 出款帳戶就地改名
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingLabel, setEditingLabel] = useState('')

  // 可見範圍 Modal（記錄正在編輯的帳戶與勾選中的節點）
  const [scopeModal, setScopeModal] = useState<{ optionId: number; selected: number[] } | null>(null)

  // 排序 Modal
  const [sortModal, setSortModal] = useState<DropdownOption[] | null>(null)
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)

  async function loadAll() {
    const [optRes, orgRes] = await Promise.all([
      supabase.from('dropdown_options').select('*').order('field').order('sort_order'),
      supabase.from('org_units').select('*').order('sort_order'),
    ])
    if (optRes.error) setError(optRes.error.message)
    else setDropdownOptions((optRes.data as DropdownOption[]) ?? [])
    if (orgRes.data) setOrgUnits(orgRes.data as OrgUnit[])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const institutions = dropdownOptions.filter(o => o.field === 'institution')
  const accounts = dropdownOptions.filter(o => o.field === 'payment_account')

  // 同一欄位內是否已有相同名稱（去空白、不分大小寫），可排除指定 id（改名時排除自己）
  function isDuplicate(field: DropdownField, label: string, excludeId?: number): boolean {
    const norm = normalizeLabel(label)
    return dropdownOptions.some(o => o.field === field && o.id !== excludeId && normalizeLabel(o.label) === norm)
  }

  async function handleAddInstitution() {
    const label = newInstitution.trim()
    if (!label) return
    setError(null)
    const maxOrder = institutions.reduce((max, o) => Math.max(max, o.sort_order), -1)
    const { error: e } = await supabase.from('dropdown_options').insert({ field: 'institution', label, sort_order: maxOrder + 1 })
    if (e) { setError(e.message); return }
    setNewInstitution('')
    await loadAll()
  }

  async function handleAddAccount() {
    const label = newAccount.trim()
    if (!label) return
    setAccountError(null)
    if (isDuplicate('payment_account', label)) { setAccountError(`已有相同的出款帳戶名稱「${label}」，請勿重複新增。`); return }
    const maxOrder = accounts.reduce((max, o) => Math.max(max, o.sort_order), -1)
    const { error: e } = await supabase.from('dropdown_options').insert({ field: 'payment_account', label, sort_order: maxOrder + 1 })
    if (e) { setAccountError(e.message); return }
    setNewAccount('')
    await loadAll()
  }

  function startEdit(opt: DropdownOption) {
    setEditingId(opt.id)
    setEditingLabel(opt.label)
    setAccountError(null)
  }

  async function saveEdit(id: number) {
    const label = editingLabel.trim()
    if (!label) { setAccountError('名稱不可空白。'); return }
    if (isDuplicate('payment_account', label, id)) { setAccountError(`已有相同的出款帳戶名稱「${label}」，請換個名稱。`); return }
    setAccountError(null)
    const { error: e } = await supabase.from('dropdown_options').update({ label }).eq('id', id)
    if (e) { setAccountError(e.message); return }
    setEditingId(null)
    setEditingLabel('')
    await loadAll()
  }

  async function handleDeleteAccount(id: number) {
    if (!confirm('確定要刪除此選項嗎？')) return
    setError(null)
    const { error: e } = await supabase.from('dropdown_options').delete().eq('id', id)
    if (e) { setError(e.message); return }
    await loadAll()
  }

  async function saveScope() {
    if (!scopeModal) return
    setError(null)
    const { error: e } = await supabase
      .from('dropdown_options')
      .update({ visible_org_unit_ids: scopeModal.selected })
      .eq('id', scopeModal.optionId)
    if (e) { setError(e.message); return }
    setScopeModal(null)
    await loadAll()
  }

  // 排序 Modal 拖曳：以目前拖到的目標位置即時重排暫存清單
  function handleSortDrop(targetId: number) {
    if (!sortModal || draggedId === null || draggedId === targetId) return
    const fromIdx = sortModal.findIndex(o => o.id === draggedId)
    const toIdx = sortModal.findIndex(o => o.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...sortModal]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    setSortModal(next)
  }

  async function saveSort() {
    if (!sortModal) return
    setError(null)
    // 逐筆更新 sort_order（依 Modal 內排好的順序）
    const updates = sortModal.map((o, i) =>
      supabase.from('dropdown_options').update({ sort_order: i }).eq('id', o.id)
    )
    const results = await Promise.all(updates)
    const failed = results.find(r => r.error)
    if (failed?.error) { setError(failed.error.message); return }
    setSortModal(null)
    await loadAll()
  }

  // 可見範圍欄位的文字：全公司 / 節點名稱（多個以 +N 表示）
  function scopeSummary(opt: DropdownOption): string {
    const ids = opt.visible_org_unit_ids ?? []
    if (!ids.length) return '全公司'
    const names = ids
      .map(id => orgUnits.find(u => u.id === id))
      .filter((u): u is OrgUnit => !!u)
      .map(unitLabel)
    if (!names.length) return '全公司'
    return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`
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
        <InstitutionSection
          items={institutions}
          newLabel={newInstitution}
          onNewLabelChange={setNewInstitution}
          onAdd={handleAddInstitution}
          onDelete={async id => {
            if (!confirm('確定要刪除此選項嗎？')) return
            setError(null)
            const { error: e } = await supabase.from('dropdown_options').delete().eq('id', id)
            if (e) { setError(e.message); return }
            await loadAll()
          }}
        />

        {/* ── 出款帳戶 ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>出款帳戶</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortModal(accounts)}
              disabled={accounts.length < 2}
            >
              調整排序
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>選項名稱</TableHead>
                  <TableHead>可見範圍</TableHead>
                  <TableHead className="w-36">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">尚無選項</TableCell>
                  </TableRow>
                ) : accounts.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {editingId === item.id ? (
                        <div className="flex flex-col gap-1">
                          <Input
                            value={editingLabel}
                            autoFocus
                            onChange={e => { setEditingLabel(e.target.value); if (accountError) setAccountError(null) }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); saveEdit(item.id) }
                              if (e.key === 'Escape') { setEditingId(null); setEditingLabel(''); setAccountError(null) }
                            }}
                            className="max-w-xs"
                          />
                          {accountError && <p className="text-sm text-destructive">{accountError}</p>}
                        </div>
                      ) : item.label}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setScopeModal({ optionId: item.id, selected: item.visible_org_unit_ids ?? [] })}
                        className="text-sm text-primary underline-offset-2 hover:underline"
                      >
                        {scopeSummary(item)}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {editingId === item.id ? (
                          <>
                            <Button size="sm" onClick={() => saveEdit(item.id)}>儲存</Button>
                            <Button variant="outline" size="sm" onClick={() => { setEditingId(null); setEditingLabel('') }}>取消</Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={() => startEdit(item)}>編輯</Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteAccount(item.id)}>刪除</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <Input
                  value={newAccount}
                  onChange={e => { setNewAccount(e.target.value); if (accountError) setAccountError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddAccount() } }}
                  placeholder="新增出款帳戶選項"
                  className="max-w-xs"
                />
                <Button onClick={handleAddAccount}>新增</Button>
              </div>
              {editingId === null && accountError && <p className="text-sm text-destructive">{accountError}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 可見範圍 Modal */}
      {scopeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="m-0 text-base font-bold text-foreground">可見範圍</h3>
              <button type="button" onClick={() => setScopeModal(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="mb-3 mt-0 text-xs text-muted-foreground">
                勾選的節點及其底下所有單位的成員，才會在申請單／付款憑單的「出款帳戶」下拉看到此帳戶；勾選上層節點即涵蓋整個分支。不勾任何節點＝全公司皆可見。
              </p>
              <OrgScopeTree
                orgUnits={orgUnits}
                selected={scopeModal.selected}
                onToggle={id => setScopeModal(prev => prev && ({
                  ...prev,
                  selected: prev.selected.includes(id) ? prev.selected.filter(x => x !== id) : [...prev.selected, id],
                }))}
              />
            </div>
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="m-0 text-xs text-muted-foreground">
                {scopeModal.selected.length > 0 ? `已選 ${scopeModal.selected.length} 個節點` : '未勾選＝全公司可見'}
              </p>
              <Button onClick={saveScope}>完成</Button>
            </div>
          </div>
        </div>
      )}

      {/* 排序 Modal */}
      {sortModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-lg border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="m-0 text-base font-bold text-foreground">調整出款帳戶排序</h3>
              <button type="button" onClick={() => setSortModal(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="mb-3 mt-0 text-xs text-muted-foreground">拖曳項目上下移動來調整順序，按「完成」儲存。</p>
              <div className="flex flex-col gap-1">
                {sortModal.map(o => (
                  <div
                    key={o.id}
                    draggable
                    onDragStart={() => setDraggedId(o.id)}
                    onDragOver={e => { e.preventDefault(); setDragOverId(o.id); handleSortDrop(o.id) }}
                    onDragEnd={() => { setDraggedId(null); setDragOverId(null) }}
                    className={`flex cursor-grab items-center gap-2 rounded border border-border bg-card px-3 py-2 text-sm transition-all active:cursor-grabbing ${dragOverId === o.id ? 'ring-2 ring-primary' : ''} ${draggedId === o.id ? 'opacity-40' : ''}`}
                  >
                    <span className="text-muted-foreground">⠿</span>
                    <span className="text-foreground">{o.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end border-t border-border px-5 py-3">
              <Button onClick={saveSort}>完成</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
