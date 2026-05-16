'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ModuleOption = {
  id: number
  label: string
  sort_order: number
}

type ModalMode = { kind: 'add' } | { kind: 'edit'; id: number }

export default function IssueModuleSettingsPage() {
  const [options, setOptions] = useState<ModuleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalMode | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadData() {
    const { data, error: e } = await supabase
      .from('issue_module_options')
      .select('*')
      .order('sort_order')
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
    setSaving(true)
    setError(null)
    if (modal?.kind === 'add') {
      const maxOrder = options.reduce((m, o) => Math.max(m, o.sort_order), -1)
      const { error: e } = await supabase
        .from('issue_module_options')
        .insert({ label, sort_order: maxOrder + 1 })
      if (e) { setError(e.message); setSaving(false); return }
    } else if (modal?.kind === 'edit') {
      const { error: e } = await supabase
        .from('issue_module_options')
        .update({ label })
        .eq('id', modal.id)
      if (e) { setError(e.message); setSaving(false); return }
    }
    setSaving(false)
    closeModal()
    await loadData()
  }

  async function handleDelete(id: number) {
    if (!confirm('確定要刪除此模組選項嗎？')) return
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
    await Promise.all(
      next.map((opt, i) =>
        supabase.from('issue_module_options').update({ sort_order: i }).eq('id', opt.id)
      )
    )
  }

  if (loading) return <p style={{ padding: 24 }}>載入中...</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>影響模組自定義</h1>
        <button onClick={openAdd} style={solidBtn}>＋ 新增</button>
      </div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
        管理「回報問題」表單中「影響模組」下拉選單的選項，可自訂排序與名稱。
      </p>

      {error && <p style={{ color: '#dc2626', marginBottom: 16 }}>錯誤：{error}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['項次', '模組名稱', '排序', '操作'].map((col) => (
                <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {options.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af' }}>
                  尚無模組選項，點擊「新增」加入第一項。
                </td>
              </tr>
            )}
            {options.map((opt, idx) => (
              <tr key={opt.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={td}>{idx + 1}</td>
                <td style={{ ...td, fontWeight: 500 }}>{opt.label}</td>
                <td style={td}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button onClick={() => handleMove(idx, -1)} disabled={idx === 0} style={arrowBtn(idx === 0)}>▲</button>
                    <button onClick={() => handleMove(idx, 1)} disabled={idx === options.length - 1} style={arrowBtn(idx === options.length - 1)}>▼</button>
                  </div>
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => openEdit(opt)} style={actionBtn}>編輯</button>
                    <button onClick={() => handleDelete(opt.id)} style={{ ...actionBtn, color: '#dc2626', borderColor: '#fca5a5' }}>刪除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{ background: '#fff', borderRadius: 12, width: 480, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                {modal.kind === 'add' ? '新增模組選項' : '編輯模組名稱'}
              </span>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6b7280', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '28px 24px' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
                模組名稱
              </label>
              <input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                placeholder="請輸入模組名稱"
                autoFocus
                style={{ width: '100%', padding: '10px 14px', fontSize: 15, border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 24px 20px', borderTop: '1px solid #e5e7eb' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '10px 28px', background: '#4ade80', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 16px', color: '#111827', verticalAlign: 'middle' }
const solidBtn: React.CSSProperties = { padding: '8px 20px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const actionBtn: React.CSSProperties = { padding: '5px 14px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#374151' }
function arrowBtn(disabled: boolean): React.CSSProperties {
  return { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 18, fontSize: 9, lineHeight: 1, padding: 0, background: disabled ? '#f9fafb' : '#fff', border: '1px solid #e5e7eb', borderRadius: 3, cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? '#d1d5db' : '#374151' }
}
