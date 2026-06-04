'use client'

import { useState, useEffect } from 'react'
import { TaxRateOption, TaxFormulaStep } from '@/lib/types'
import { getTaxRateOptions, upsertTaxRateOption, deleteTaxRateOption } from '@/app/actions/tax-rates'
import { formulaSummary } from '@/lib/taxUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const OPS = ['+', '-', '*', '/'] as const
const OP_DISPLAY: Record<string, string> = { '+': '＋', '-': '－', '*': '×', '/': '÷' }
const selectCls = 'rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus:border-ring dark:bg-input/30'

export default function TaxTab() {
  const [options, setOptions] = useState<TaxRateOption[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editSteps, setEditSteps] = useState<TaxFormulaStep[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    getTaxRateOptions().then(data => { setOptions(data); setLoading(false) })
  }, [])

  function startEdit(opt: TaxRateOption) {
    setEditingId(opt.id)
    setEditLabel(opt.label)
    setEditSteps(opt.formula_steps.map(s => ({ ...s })))
  }

  function startNew() {
    setEditingId('new')
    setEditLabel('')
    setEditSteps([{ op: '*', value: 0.05 }])
  }

  function cancel() {
    setEditingId(null)
    setEditLabel('')
    setEditSteps([])
  }

  function setStep(idx: number, patch: Partial<TaxFormulaStep>) {
    setEditSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  function addStep() {
    setEditSteps(prev => [...prev, { op: '*', value: 1 }])
  }

  function removeStep(idx: number) {
    setEditSteps(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!editLabel.trim()) return
    setSaving(true)
    const sort_order = editingId === 'new'
      ? (options.length ? Math.max(...options.map(o => o.sort_order)) + 10 : 0)
      : (options.find(o => o.id === editingId)?.sort_order ?? 0)
    const { error } = await upsertTaxRateOption({
      ...(editingId !== 'new' ? { id: editingId as number } : {}),
      label: editLabel.trim(),
      formula_steps: editSteps,
      sort_order,
    })
    setSaving(false)
    if (error) { setMsg({ text: `錯誤：${error}`, ok: false }); return }
    const updated = await getTaxRateOptions()
    setOptions(updated)
    cancel()
    setMsg({ text: '已儲存', ok: true })
    setTimeout(() => setMsg(null), 3000)
  }

  async function handleDelete(id: number) {
    if (!confirm('確定要刪除此稅額選項嗎？')) return
    const { error } = await deleteTaxRateOption(id)
    if (error) { setMsg({ text: `刪除失敗：${error}`, ok: false }); return }
    setOptions(prev => prev.filter(o => o.id !== id))
    setMsg({ text: '已刪除', ok: true })
    setTimeout(() => setMsg(null), 3000)
  }

  if (loading) return <p className="text-sm text-muted-foreground">載入中...</p>

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">設定填表時「稅額選擇」下拉選單的選項與對應計算公式。</p>
        {msg && (
          <span className={`text-sm ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
            {msg.text}
          </span>
        )}
      </div>

      {/* 選項列表 */}
      {options.length > 0 && (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名稱</TableHead>
                <TableHead>計算公式（費用起始）</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {options.map(opt => (
                <TableRow key={opt.id}>
                  <TableCell className="text-sm font-medium">{opt.label}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    費用 {formulaSummary(opt.formula_steps)} ＝ 稅額
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => startEdit(opt)} disabled={editingId !== null}>
                        編輯
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(opt.id)} disabled={editingId !== null}>
                        刪除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {options.length === 0 && editingId === null && (
        <p className="text-sm text-muted-foreground">尚未設定任何稅額選項。</p>
      )}

      {/* 編輯 / 新增表單 */}
      {editingId !== null && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId === 'new' ? '新增稅額選項' : '編輯稅額選項'}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">稅額名稱</label>
              <Input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                placeholder="例：應稅5%、境外稅"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">計算步驟（起始值為「費用」）</label>
              <span className="mb-2 inline-flex items-center rounded bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                起始值：費用
              </span>

              <div className="flex flex-col gap-2">
                {editSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-10 text-xs text-muted-foreground">第 {idx + 1} 步</span>
                    <select
                      value={step.op}
                      onChange={e => setStep(idx, { op: e.target.value as TaxFormulaStep['op'] })}
                      className={`w-16 ${selectCls}`}
                    >
                      {OPS.map(op => <option key={op} value={op}>{OP_DISPLAY[op]}</option>)}
                    </select>
                    <Input
                      type="number"
                      step="any"
                      value={step.value}
                      onChange={e => setStep(idx, { value: parseFloat(e.target.value) || 0 })}
                      className="w-24"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeStep(idx)}
                      disabled={editSteps.length <= 1}
                    >
                      刪除
                    </Button>
                  </div>
                ))}
              </div>

              <span className="mt-2 inline-flex items-center rounded bg-green-50 px-2.5 py-1 text-xs text-green-700 dark:bg-green-950 dark:text-green-400">
                ＝ 稅額
              </span>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={addStep}
                  className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50"
                >
                  ＋ 新增步驟
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !editLabel.trim()}>
                {saving ? '儲存中...' : '儲存'}
              </Button>
              <Button variant="outline" onClick={cancel}>取消</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {editingId === null && (
        <Button onClick={startNew} className="w-fit">＋ 新增稅額選項</Button>
      )}
    </div>
  )
}
