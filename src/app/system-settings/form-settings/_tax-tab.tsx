'use client'

import { useState, useEffect } from 'react'
import { TaxRateOption, TaxFormulaStep } from '@/lib/types'
import { getTaxRateOptions, upsertTaxRateOption, deleteTaxRateOption } from '@/app/actions/tax-rates'
import { formulaSummary } from '@/lib/taxUtils'

const OPS = ['+', '-', '*', '/'] as const
const OP_DISPLAY: Record<string, string> = { '+': '＋', '-': '－', '*': '×', '/': '÷' }

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

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>載入中...</p>

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
          設定填表時「稅額選擇」下拉選單的選項與對應計算公式。
        </p>
        {msg && (
          <span style={{ fontSize: 13, color: msg.ok ? '#16a34a' : '#dc2626' }}>{msg.text}</span>
        )}
      </div>

      {/* Option list */}
      {options.length > 0 && (
        <div style={{ marginBottom: 16, border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 0, background: '#f9fafb', padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>名稱</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>計算公式（費用起始）</span>
            <span />
          </div>
          {options.map(opt => (
            <div key={opt.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', alignItems: 'center', gap: 0, padding: '10px 16px', borderBottom: '1px solid var(--border-color)', background: 'white' }}>
              <span style={{ fontSize: 14, color: 'var(--text-body)' }}>{opt.label}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                費用 {formulaSummary(opt.formula_steps)} ＝ 稅額
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => startEdit(opt)}
                  disabled={editingId !== null}
                  style={{ padding: '4px 10px', fontSize: 12, border: '1px solid var(--btn-border)', borderRadius: 5, background: 'white', cursor: editingId !== null ? 'not-allowed' : 'pointer', color: 'var(--text-body)' }}>
                  編輯
                </button>
                <button
                  onClick={() => handleDelete(opt.id)}
                  disabled={editingId !== null}
                  style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #fca5a5', borderRadius: 5, background: 'white', cursor: editingId !== null ? 'not-allowed' : 'pointer', color: '#dc2626' }}>
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {options.length === 0 && editingId === null && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>尚未設定任何稅額選項。</p>
      )}

      {/* Edit / New form */}
      {editingId !== null && (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 20, marginBottom: 16, background: 'white' }}>
          <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px 0' }}>
            {editingId === 'new' ? '新增稅額選項' : '編輯稅額選項'}
          </p>

          <label style={labelStyle}>稅額名稱</label>
          <input
            value={editLabel}
            onChange={e => setEditLabel(e.target.value)}
            placeholder="例：應稅5%、境外稅"
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: 16 }}>計算步驟（起始值為「費用」）</label>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#f3f4f6', borderRadius: 5, fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
              起始值：費用
            </div>
          </div>

          {editSteps.map((step, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', minWidth: 40 }}>第 {idx + 1} 步</span>
              <select
                value={step.op}
                onChange={e => setStep(idx, { op: e.target.value as TaxFormulaStep['op'] })}
                style={{ ...inputStyle, width: 64, marginBottom: 0 }}>
                {OPS.map(op => (
                  <option key={op} value={op}>{OP_DISPLAY[op]}</option>
                ))}
              </select>
              <input
                type="number"
                step="any"
                value={step.value}
                onChange={e => setStep(idx, { value: parseFloat(e.target.value) || 0 })}
                style={{ ...inputStyle, width: 100, marginBottom: 0 }}
              />
              <button
                type="button"
                onClick={() => removeStep(idx)}
                disabled={editSteps.length <= 1}
                style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #fca5a5', borderRadius: 5, background: 'white', color: editSteps.length <= 1 ? '#d1d5db' : '#dc2626', cursor: editSteps.length <= 1 ? 'not-allowed' : 'pointer' }}>
                刪除
              </button>
            </div>
          ))}

          <div style={{ padding: '4px 10px', background: '#f0fdf4', borderRadius: 5, fontSize: 13, color: '#16a34a', marginBottom: 12, display: 'inline-block' }}>
            ＝ 稅額
          </div>

          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              onClick={addStep}
              style={{ padding: '6px 12px', fontSize: 13, border: '1.5px dashed #d1d5db', borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              ＋ 新增步驟
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !editLabel.trim()}
              style={{ padding: '8px 20px', background: editLabel.trim() ? '#111827' : '#d1d5db', color: 'white', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: editLabel.trim() ? 'pointer' : 'not-allowed' }}>
              {saving ? '儲存中...' : '儲存'}
            </button>
            <button
              type="button"
              onClick={cancel}
              style={{ padding: '8px 16px', background: 'white', color: 'var(--text-body)', border: '1px solid var(--btn-border)', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>
              取消
            </button>
          </div>
        </div>
      )}

      {editingId === null && (
        <button
          type="button"
          onClick={startNew}
          style={{ padding: '8px 20px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          ＋ 新增稅額選項
        </button>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', border: '1px solid var(--btn-border)', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', marginBottom: 8, background: 'white', color: 'var(--text-body)' }
