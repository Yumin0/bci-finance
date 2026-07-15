'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/app/_components/useConfirm'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PageHeader from '@/app/_components/PageHeader'

type ModuleOption = { id: number; label: string; sort_order: number }
type ModalMode = { kind: 'add' } | { kind: 'edit'; id: number }

const arrowCls = (disabled: boolean) =>
  `flex h-[18px] w-[22px] items-center justify-center rounded border border-border text-[9px] leading-none ${
    disabled ? 'cursor-not-allowed text-muted-foreground/30 bg-muted/30' : 'cursor-pointer text-foreground bg-background hover:bg-muted'
  }`

export default function IssueModuleSettingsPage() {
  const [confirm, confirmDialog] = useConfirm()
  const [options, setOptions] = useState<ModuleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalMode | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadData() {
    const { data, error: e } = await supabase.from('issue_module_options').select('*').order('sort_order')
    if (e) { setError(e.message); setLoading(false); return }
    setOptions(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function openAdd() { setInputValue(''); setModal({ kind: 'add' }) }
  function openEdit(opt: ModuleOption) { setInputValue(opt.label); setModal({ kind: 'edit', id: opt.id }) }
  function closeModal() { setModal(null); setInputValue('') }

  async function handleSave() {
    const label = inputValue.trim()
    if (!label) return
    setSaving(true); setError(null)
    if (modal?.kind === 'add') {
      const maxOrder = options.reduce((m, o) => Math.max(m, o.sort_order), -1)
      const { error: e } = await supabase.from('issue_module_options').insert({ label, sort_order: maxOrder + 1 })
      if (e) { setError(e.message); setSaving(false); return }
    } else if (modal?.kind === 'edit') {
      const { error: e } = await supabase.from('issue_module_options').update({ label }).eq('id', modal.id)
      if (e) { setError(e.message); setSaving(false); return }
    }
    setSaving(false); closeModal(); await loadData()
  }

  async function handleDelete(id: number) {
    if (!(await confirm({ message: '確定要刪除此模組選項嗎？', danger: true, confirmText: '刪除' }))) return
    setError(null)
    const { error: e } = await supabase.from('issue_module_options').delete().eq('id', id)
    if (e) { setError(e.message); return }
    await loadData()
  }

  async function handleMove(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= options.length) return
    const next = [...options]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setOptions(next)
    await Promise.all(next.map((opt, i) => supabase.from('issue_module_options').update({ sort_order: i }).eq('id', opt.id)))
  }

  if (loading) return <p className="text-muted-foreground">載入中...</p>

  return (
    <div className="flex flex-col gap-6">
      {confirmDialog}
      <div>
        <PageHeader title="影響模組自定義" action={<Button onClick={openAdd}>＋ 新增</Button>} />
        <p className="mt-1 text-sm text-muted-foreground">
          管理「回報問題」表單中「影響模組」下拉選單的選項，可自訂排序與名稱。
        </p>
      </div>

      {error && <p className="text-sm text-destructive">錯誤：{error}</p>}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {['項次', '模組名稱', '排序', '操作'].map(col => <TableHead key={col}>{col}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {options.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  尚無模組選項，點擊「新增」加入第一項。
                </TableCell>
              </TableRow>
            )}
            {options.map((opt, idx) => (
              <TableRow key={opt.id}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell className="font-medium">{opt.label}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => handleMove(idx, -1)} disabled={idx === 0} className={arrowCls(idx === 0)}>▲</button>
                    <button onClick={() => handleMove(idx, 1)} disabled={idx === options.length - 1} className={arrowCls(idx === options.length - 1)}>▼</button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(opt)}>編輯</Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(opt.id)} className="border-red-200 text-red-600 hover:bg-red-50">刪除</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="w-[480px] max-w-[90vw] overflow-hidden rounded-xl bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <span className="text-base font-semibold text-foreground">
                {modal.kind === 'add' ? '新增模組選項' : '編輯模組名稱'}
              </span>
              <button onClick={closeModal} className="text-xl leading-none text-muted-foreground hover:text-foreground">×</button>
            </div>
            <div className="px-6 py-7">
              <label className="mb-2 block text-sm font-medium text-foreground">模組名稱</label>
              <Input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                placeholder="請輸入模組名稱"
                autoFocus
              />
            </div>
            <div className="flex justify-end border-t border-border px-6 py-4">
              <Button onClick={handleSave} disabled={saving} className="bg-green-500 hover:bg-green-600 text-white">
                確認
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
