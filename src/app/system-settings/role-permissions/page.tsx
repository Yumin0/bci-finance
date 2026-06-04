'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_SIDEBAR_CONFIG } from '@/lib/sidebar-config'
import type { SystemRole, RoleType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/app/_components/PageHeader'

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
      const { data: newRole, error: e } = await supabase
        .from('system_roles')
        .insert({ name: name.trim(), is_admin: isAdmin, allowed_item_ids: [...allowedItemIds], sort_order: 999 })
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
    <div className="flex flex-col gap-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">角色名稱</label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="如：課長、財務人員"
          autoFocus
        />
      </div>

      <div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
          <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
          系統管理員（勾選後可看到所有功能，不受限制）
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground">對應組織職稱</p>
        <p className="mb-2 text-xs text-muted-foreground">擔任以下職稱的人員，會自動套用此角色的功能權限</p>
        {roleTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">尚無職稱，請先至「組織架構與職位設定」新增</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {roleTypes.map(rt => (
              <label
                key={rt.id}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors ${
                  selectedRoleTypeIds.has(rt.id)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:bg-muted'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedRoleTypeIds.has(rt.id)}
                  onChange={() => toggleRoleType(rt.id)}
                  className="hidden"
                />
                {rt.level} · {rt.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {!isAdmin && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground">可操作功能</p>
          <div className="overflow-hidden rounded-lg border border-border">
            {categories.map((cat, ci) => {
              const items = ALL_ITEM_IDS.filter(i => i.categoryLabel === cat)
              const checkedCount = items.filter(i => allowedItemIds.has(i.id)).length
              const allChecked = checkedCount === items.length
              return (
                <div key={cat} className={ci === 0 ? '' : 'border-t border-border'}>
                  <div
                    className="flex cursor-pointer items-center gap-2 bg-muted/50 px-3.5 py-2"
                    onClick={() => toggleCategory(cat)}
                  >
                    <input type="checkbox" checked={allChecked} onChange={() => toggleCategory(cat)} onClick={e => e.stopPropagation()} readOnly />
                    <span className="text-sm font-semibold text-foreground">{cat}</span>
                    <span className="text-xs text-muted-foreground">{checkedCount}/{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-1 px-8 py-2.5">
                    {items.map(item => (
                      <label key={item.id} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
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

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
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

  if (loading) return <p className="text-muted-foreground">載入中...</p>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader title="角色功能權限設定" />
        <p className="mt-1 text-sm text-muted-foreground">
          新增系統角色，設定各角色可操作的側邊欄功能，並綁定組織架構中的職稱。
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-start gap-6">
        {/* 左側：角色列表 */}
        <div className="w-52 shrink-0">
          <Card className="gap-0 overflow-hidden p-0">
            {roles.length === 0 && (
              <p className="px-4 py-3 text-sm text-muted-foreground">尚無角色</p>
            )}
            {roles.map((role, i) => (
              <div
                key={role.id}
                onClick={() => setSelected(role)}
                className={`flex cursor-pointer items-center justify-between px-3.5 py-2.5 transition-colors ${
                  i > 0 ? 'border-t border-border' : ''
                } ${
                  selected !== 'new' && selected?.id === role.id
                    ? 'bg-primary/10'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-foreground">{role.name}</div>
                  {role.is_admin
                    ? <div className="text-xs text-primary">系統管理員</div>
                    : <div className="text-xs text-muted-foreground">{role.allowed_item_ids.length} 項功能</div>
                  }
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(role) }}
                  className="text-xs text-destructive hover:underline"
                >
                  刪除
                </button>
              </div>
            ))}
          </Card>
          <button
            onClick={() => setSelected('new')}
            className="mt-2.5 w-full rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
          >
            ＋ 新增角色
          </button>
        </div>

        {/* 右側：設定面板 */}
        <Card className="min-h-48 flex-1">
          <CardContent>
            {selected === null && (
              <p className="text-sm text-muted-foreground">← 點選左側角色進行設定，或新增角色</p>
            )}
            {selected === 'new' && (
              <>
                <CardHeader className="px-0 pt-0">
                  <CardTitle>新增角色</CardTitle>
                </CardHeader>
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
                <CardHeader className="px-0 pt-0">
                  <CardTitle>編輯角色：{selected.name}</CardTitle>
                </CardHeader>
                <RoleForm
                  key={selected.id}
                  role={selected}
                  roleTypes={roleTypes}
                  onSave={() => { setSelected(null); loadAll() }}
                  onCancel={() => setSelected(null)}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
