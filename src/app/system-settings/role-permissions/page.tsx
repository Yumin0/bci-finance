'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_SIDEBAR_CONFIG } from '@/lib/sidebar-config'
import type { SystemRole, RoleType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type SystemRoleWithRoleTypes = SystemRole & { role_type_ids: number[] }

const ALL_ITEM_IDS: { categoryLabel: string; id: string; label: string }[] = DEFAULT_SIDEBAR_CONFIG.flatMap(cat =>
  cat.entries.flatMap(entry =>
    entry.kind === 'item'
      ? [{ categoryLabel: cat.label, id: entry.id, label: entry.label }]
      : entry.items.map(item => ({ categoryLabel: cat.label, id: item.id, label: `${entry.label} › ${item.label}` }))
  )
)

// ── RoleForm ──────────────────────────────────────────────────────────────────

function RoleForm({
  role,
  roleTypes,
  onSave,
  onCancel,
}: {
  role: SystemRoleWithRoleTypes | null
  roleTypes: RoleType[]
  onSave: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(role?.name ?? '')
  const [isAdmin, setIsAdmin] = useState(role?.is_admin ?? false)
  const [selectedRoleTypeIds, setSelectedRoleTypeIds] = useState<Set<number>>(
    new Set(role?.role_type_ids ?? [])
  )
  const [allowedItemIds, setAllowedItemIds] = useState<Set<string>>(
    new Set(role?.allowed_item_ids ?? [])
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleRoleType(id: number) {
    setSelectedRoleTypeIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleItem(id: string) {
    setAllowedItemIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleCategory(categoryLabel: string) {
    const ids = ALL_ITEM_IDS.filter(i => i.categoryLabel === categoryLabel).map(i => i.id)
    const allChecked = ids.every(id => allowedItemIds.has(id))
    setAllowedItemIds(prev => {
      const next = new Set(prev)
      if (allChecked) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  async function handleSave() {
    if (!name.trim()) { setError('請填寫角色名稱'); return }
    setSaving(true)
    setError(null)

    if (role) {
      const { error: e } = await supabase
        .from('system_roles')
        .update({ name: name.trim(), is_admin: isAdmin, allowed_item_ids: [...allowedItemIds] })
        .eq('id', role.id)
      if (e) { setError(e.message); setSaving(false); return }

      await supabase.from('system_role_role_types').delete().eq('system_role_id', role.id)
      if (selectedRoleTypeIds.size > 0) {
        const rows = [...selectedRoleTypeIds].map(rid => ({ system_role_id: role.id, role_type_id: rid }))
        const { error: e2 } = await supabase.from('system_role_role_types').insert(rows)
        if (e2) { setError(e2.message); setSaving(false); return }
      }
    } else {
      const maxOrder = 999
      const { data: newRole, error: e } = await supabase
        .from('system_roles')
        .insert({ name: name.trim(), is_admin: isAdmin, allowed_item_ids: [...allowedItemIds], sort_order: maxOrder })
        .select('id')
        .single()
      if (e || !newRole) { setError(e?.message ?? '建立失敗'); setSaving(false); return }

      if (selectedRoleTypeIds.size > 0) {
        const rows = [...selectedRoleTypeIds].map(rid => ({ system_role_id: newRole.id, role_type_id: rid }))
        const { error: e2 } = await supabase.from('system_role_role_types').insert(rows)
        if (e2) { setError(e2.message); setSaving(false); return }
      }
    }

    setSaving(false)
    onSave()
  }

  const categories = [...new Set(ALL_ITEM_IDS.map(i => i.categoryLabel))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label style={labelStyle}>角色名稱</label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="如：課長、財務人員"
          autoFocus
        />
      </div>

      <div>
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
          <span>系統管理員（勾選後可看到所有功能，不受限制）</span>
        </label>
      </div>

      <div>
        <p style={labelStyle}>對應組織職稱</p>
        <p style={{ fontSize: 12, color: 'var(--text-subtle)', marginBottom: 8 }}>
          擔任以下職稱的人員，會自動套用此角色的功能權限
        </p>
        {roleTypes.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-subtle)' }}>尚無職稱，請先至「組織架構與職位設定」新增</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {roleTypes.map(rt => (
              <label key={rt.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', padding: '4px 10px', border: `1px solid ${selectedRoleTypeIds.has(rt.id) ? '#3b82f6' : '#d1d5db'}`, borderRadius: 20, background: selectedRoleTypeIds.has(rt.id) ? '#eff6ff' : '#fff', color: selectedRoleTypeIds.has(rt.id) ? '#1d4ed8' : '#374151' }}>
                <input
                  type="checkbox"
                  checked={selectedRoleTypeIds.has(rt.id)}
                  onChange={() => toggleRoleType(rt.id)}
                  style={{ display: 'none' }}
                />
                {rt.level} · {rt.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {!isAdmin && (
        <div>
          <p style={labelStyle}>可操作功能</p>
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
            {categories.map((cat, ci) => {
              const items = ALL_ITEM_IDS.filter(i => i.categoryLabel === cat)
              const checkedCount = items.filter(i => allowedItemIds.has(i.id)).length
              const allChecked = checkedCount === items.length
              return (
                <div key={cat} style={{ borderTop: ci === 0 ? 'none' : '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--bg-sidebar)', cursor: 'pointer' }} onClick={() => toggleCategory(cat)}>
                    <input type="checkbox" checked={allChecked} onChange={() => toggleCategory(cat)} onClick={e => e.stopPropagation()} readOnly />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)' }}>{cat}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{checkedCount}/{items.length}</span>
                  </div>
                  <div style={{ padding: '4px 14px 10px 32px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {items.map(item => (
                      <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-body)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={allowedItemIds.has(item.id)}
                          onChange={() => toggleItem(item.id)}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? '儲存中...' : '儲存'}
        </Button>
        <Button variant="outline" onClick={onCancel}>取消</Button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RolePermissionsPage() {
  const [roles, setRoles] = useState<SystemRoleWithRoleTypes[]>([])
  const [roleTypes, setRoleTypes] = useState<RoleType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SystemRoleWithRoleTypes | null | 'new'>(null)

  async function loadAll() {
    setError(null)
    const [rolesRes, srrtRes, rtRes] = await Promise.all([
      supabase.from('system_roles').select('*').order('sort_order').order('id'),
      supabase.from('system_role_role_types').select('system_role_id, role_type_id'),
      supabase.from('role_types').select('*').order('level').order('sort_order'),
    ])
    if (rolesRes.error) { setError(rolesRes.error.message); return }
    if (rtRes.error) { setError(rtRes.error.message); return }

    const srrtData = srrtRes.data ?? []
    const enriched: SystemRoleWithRoleTypes[] = (rolesRes.data as SystemRole[]).map(r => ({
      ...r,
      role_type_ids: srrtData
        .filter((x: { system_role_id: number }) => x.system_role_id === r.id)
        .map((x: { role_type_id: number }) => x.role_type_id),
    }))

    setRoles(enriched)
    setRoleTypes((rtRes.data as RoleType[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  async function handleDelete(role: SystemRoleWithRoleTypes) {
    if (!confirm(`確定刪除角色「${role.name}」？已指派此角色的帳號將改為依組織職位決定權限。`)) return
    const { error: e } = await supabase.from('system_roles').delete().eq('id', role.id)
    if (e) { setError(e.message); return }
    if (selected && selected !== 'new' && selected.id === role.id) setSelected(null)
    loadAll()
  }

  if (loading) return <p>載入中...</p>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>角色功能權限設定</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>新增系統角色，設定各角色可操作的側邊欄功能，並綁定組織架構中的職稱。</p>
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* 左側：角色列表 */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
            {roles.length === 0 && (
              <p style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-subtle)' }}>尚無角色</p>
            )}
            {roles.map((role, i) => (
              <div
                key={role.id}
                onClick={() => setSelected(role)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border-color)',
                  background: selected !== 'new' && selected?.id === role.id ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-title)' }}>{role.name}</div>
                  {role.is_admin && <div style={{ fontSize: 11, color: '#2563eb' }}>系統管理員</div>}
                  {!role.is_admin && (
                    <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                      {role.allowed_item_ids.length} 項功能
                    </div>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(role) }}
                  style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  刪除
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setSelected('new')}
            style={{ marginTop: 10, width: '100%', padding: '8px 0', fontSize: 13, cursor: 'pointer', background: 'none', border: '1px dashed #9ca3af', borderRadius: 6, color: 'var(--text-muted)' }}
          >
            ＋ 新增角色
          </button>
        </div>

        {/* 右側：設定面板 */}
        <div style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: 8, padding: 24, minHeight: 200 }}>
          {selected === null && (
            <p style={{ fontSize: 14, color: 'var(--text-subtle)' }}>← 點選左側角色進行設定，或新增角色</p>
          )}
          {selected === 'new' && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>新增角色</h2>
              <RoleForm
                role={null}
                roleTypes={roleTypes}
                onSave={() => { setSelected(null); loadAll() }}
                onCancel={() => setSelected(null)}
              />
            </>
          )}
          {selected !== null && selected !== 'new' && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>編輯角色：{selected.name}</h2>
              <RoleForm
                key={selected.id}
                role={selected}
                roleTypes={roleTypes}
                onSave={() => { setSelected(null); loadAll() }}
                onCancel={() => setSelected(null)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
