'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DEFAULT_SIDEBAR_CONFIG } from '@/lib/sidebar-config'
import type { SystemRole } from '@/lib/types'
import { getAccountsForManagement, updateAccountRole } from '@/app/actions/account'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PageHeader from '@/app/_components/PageHeader'
import { formatDate } from '@/lib/dateUtils'

type Tab = 'roles' | 'accounts'

type AppUser = {
  id: number
  email: string
  name: string
  google_id: string | null
  system_role_id: number | null
  sort_order: number | null
  created_at: string
}

const ALL_ITEM_IDS = DEFAULT_SIDEBAR_CONFIG.flatMap(cat =>
  cat.entries.flatMap(entry =>
    entry.kind === 'item'
      ? [{ categoryLabel: cat.label, id: entry.id, label: entry.label, permissionParent: entry.permissionParent ?? null }]
      : entry.items.map(item => ({ categoryLabel: cat.label, id: item.id, label: `${entry.label} › ${item.label}`, permissionParent: item.permissionParent ?? null }))
  )
)

// ── RoleForm ──────────────────────────────────────────────────────────────────

function RoleForm({ role, onSave, onCancel }: {
  role: SystemRole | null
  onSave: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(role?.name ?? '')
  const [isAdmin, setIsAdmin] = useState(role?.is_admin ?? false)
  const [allowedItemIds, setAllowedItemIds] = useState<Set<string>>(new Set(role?.allowed_item_ids ?? []))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleItem(id: string) {
    setAllowedItemIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleCategory(categoryLabel: string) {
    const ids = ALL_ITEM_IDS.filter(i => i.categoryLabel === categoryLabel && !i.permissionParent).map(i => i.id)
    const subIds = ALL_ITEM_IDS.filter(i => i.categoryLabel === categoryLabel && i.permissionParent).map(i => i.id)
    const allChecked = [...ids, ...subIds].every(id => allowedItemIds.has(id))
    setAllowedItemIds(prev => {
      const n = new Set(prev)
      const allIds = [...ids, ...subIds]
      if (allChecked) allIds.forEach(id => n.delete(id))
      else allIds.forEach(id => n.add(id))
      return n
    })
  }

  async function handleSave() {
    if (!name.trim()) { setError('請填寫角色名稱'); return }
    setSaving(true); setError(null)
    if (role) {
      const { error: e } = await supabase.from('system_roles')
        .update({ name: name.trim(), is_admin: isAdmin, allowed_item_ids: [...allowedItemIds] })
        .eq('id', role.id)
      if (e) { setError(e.message); setSaving(false); return }
    } else {
      const { error: e } = await supabase.from('system_roles')
        .insert({ name: name.trim(), is_admin: isAdmin, allowed_item_ids: [...allowedItemIds], sort_order: 999 })
      if (e) { setError(e.message); setSaving(false); return }
    }
    setSaving(false); onSave()
  }

  const categories = [...new Set(ALL_ITEM_IDS.map(i => i.categoryLabel))]

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">角色名稱</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="如：主管、財務人員" autoFocus />
      </div>
      <div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
          <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
          系統管理員（勾選後可看到所有功能，不受限制）
        </label>
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
                  <div className="flex cursor-pointer items-center gap-2 bg-muted/50 px-3.5 py-2" onClick={() => toggleCategory(cat)}>
                    <input type="checkbox" checked={allChecked} onChange={() => toggleCategory(cat)} onClick={e => e.stopPropagation()} readOnly />
                    <span className="text-sm font-semibold text-foreground">{cat}</span>
                    <span className="text-xs text-muted-foreground">{checkedCount}/{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-1 px-8 py-2.5">
                    {items.filter(item => !item.permissionParent).map(item => (
                      <div key={item.id}>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                          <input type="checkbox" checked={allowedItemIds.has(item.id)} onChange={() => toggleItem(item.id)} />
                          {item.label}
                        </label>
                        {items.filter(sub => sub.permissionParent === item.id).map(sub => (
                          <label key={sub.id} className="mt-1 flex cursor-pointer items-center gap-2 pl-5 text-sm text-foreground">
                            <input type="checkbox" checked={allowedItemIds.has(sub.id)} onChange={() => toggleItem(sub.id)} />
                            {sub.label}
                          </label>
                        ))}
                      </div>
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
        <Button onClick={handleSave} disabled={saving}>{saving ? '儲存中...' : '儲存'}</Button>
        <Button variant="outline" onClick={onCancel}>取消</Button>
      </div>
    </div>
  )
}

// ── RolesTab ──────────────────────────────────────────────────────────────────

function RolesTab() {
  const [roles, setRoles] = useState<SystemRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SystemRole | 'new' | null>(null)
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)

  async function loadRoles() {
    const { data, error: e } = await supabase.from('system_roles').select('*').order('sort_order').order('id')
    if (e) { setError(e.message); return }
    setRoles((data as SystemRole[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadRoles() }, [])

  // 拖曳排序：拖到目標即時重排暫存清單，放開時逐筆寫回 sort_order（其他電腦重載同步）
  function handleReorder(targetId: number) {
    if (draggedId === null || draggedId === targetId) return
    setRoles(prev => {
      const fromIdx = prev.findIndex(r => r.id === draggedId)
      const toIdx = prev.findIndex(r => r.id === targetId)
      if (fromIdx < 0 || toIdx < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }

  async function handleDragEnd() {
    const ordered = roles
    setDraggedId(null); setDragOverId(null)
    const updates = ordered.map((r, i) =>
      supabase.from('system_roles').update({ sort_order: i }).eq('id', r.id)
    )
    const results = await Promise.all(updates)
    const failed = results.find(x => x.error)
    if (failed?.error) { setError(`排序儲存失敗：${failed.error.message}`); loadRoles() }
  }

  async function handleDelete(role: SystemRole) {
    if (!confirm(`確定刪除角色「${role.name}」？已指派此角色的帳號需要重新設定。`)) return
    const { error: e } = await supabase.from('system_roles').delete().eq('id', role.id)
    if (e) { setError(`無法刪除：${e.message}`); return }
    if (selected !== 'new' && selected !== null && (selected as SystemRole).id === role.id) setSelected(null)
    loadRoles()
  }

  if (loading) return <p className="text-sm text-muted-foreground">載入中...</p>

  return (
    <>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-start gap-6">
        <div className="w-52 shrink-0">
          <Card className="gap-0 overflow-hidden p-0">
            {roles.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">尚無角色</p>}
            {roles.map((role, i) => {
              const isSelected = selected !== 'new' && selected !== null && (selected as SystemRole).id === role.id
              return (
                <div
                  key={role.id}
                  onDragOver={e => { e.preventDefault(); setDragOverId(role.id); handleReorder(role.id) }}
                  className={`flex items-center gap-2 px-3.5 py-2.5 transition-colors ${i > 0 ? 'border-t border-border' : ''} ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'} ${draggedId === role.id ? 'opacity-40' : ''} ${dragOverId === role.id && draggedId !== role.id ? 'ring-2 ring-inset ring-primary' : ''}`}
                >
                  <span
                    draggable
                    onDragStart={() => setDraggedId(role.id)}
                    onDragEnd={handleDragEnd}
                    className="cursor-grab select-none text-muted-foreground active:cursor-grabbing"
                    title="拖曳排序"
                  >⠿</span>
                  <div className="flex-1 cursor-pointer" onClick={() => setSelected(role)}>
                    <div className="text-sm font-medium text-foreground">{role.name}</div>
                    {role.is_admin
                      ? <div className="text-xs text-primary">系統管理員</div>
                      : <div className="text-xs text-muted-foreground">{role.allowed_item_ids.length} 項功能</div>
                    }
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleDelete(role) }} className="text-xs text-destructive hover:underline">刪除</button>
                </div>
              )
            })}
          </Card>
          <button
            onClick={() => setSelected('new')}
            className="mt-2.5 w-full rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
          >
            ＋ 新增角色
          </button>
        </div>
        <Card className="min-h-48 flex-1">
          <CardContent>
            {selected === null && <p className="text-sm text-muted-foreground">← 點選左側角色進行設定，或新增角色</p>}
            {selected === 'new' && (
              <>
                <CardHeader className="px-0 pt-0"><CardTitle>新增角色</CardTitle></CardHeader>
                <RoleForm role={null} onSave={() => { setSelected(null); loadRoles() }} onCancel={() => setSelected(null)} />
              </>
            )}
            {selected !== null && selected !== 'new' && (
              <>
                <CardHeader className="px-0 pt-0"><CardTitle>編輯角色：{(selected as SystemRole).name}</CardTitle></CardHeader>
                <RoleForm key={(selected as SystemRole).id} role={selected as SystemRole} onSave={() => { setSelected(null); loadRoles() }} onCancel={() => setSelected(null)} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

// ── AccountsTab ───────────────────────────────────────────────────────────────

function AccountsTab() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [roles, setRoles] = useState<SystemRole[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [, startTransition] = useTransition()

  async function loadAll() {
    const [usersData, rolesRes] = await Promise.all([
      getAccountsForManagement(),
      supabase.from('system_roles').select('id, name, is_admin, sort_order').order('sort_order').order('id'),
    ])
    setUsers(usersData as AppUser[])
    setRoles((rolesRes.data as SystemRole[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  async function handleRoleChange(userId: number, value: string) {
    const roleId = value ? Number(value) : null
    await updateAccountRole(userId, roleId)
    startTransition(() => { loadAll() })
  }

  const filtered = query.trim()
    ? users.filter(u => u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()))
    : users

  if (loading) return <p className="text-sm text-muted-foreground">載入中...</p>

  return (
    <Card>
      <CardHeader>
        <CardTitle>帳號列表</CardTitle>
        <CardAction className="flex items-center gap-2">
          <Input
            placeholder="搜尋帳號、姓名…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-64 bg-background"
          />
          <Link href="/system-settings/account-management/new" className={buttonVariants({ variant: 'default' })}>
            ＋ 新增帳號
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>編號</TableHead>
              <TableHead>帳號</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>功能角色</TableHead>
              <TableHead>登入方式</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(user => {
              const index = users.indexOf(user)
              return (
                <TableRow key={user.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>
                    <select
                      value={user.system_role_id ?? ''}
                      onChange={e => handleRoleChange(user.id, e.target.value)}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-ring"
                    >
                      <option value="">未指派</option>
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name}{r.is_admin ? '（系統管理員）' : ''}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    {user.google_id
                      ? <span className="rounded px-2 py-0.5 text-xs font-medium" style={{ background: '#e8f0fe', color: '#1a73e8' }}>Google</span>
                      : <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Email</span>
                    }
                  </TableCell>
                  <TableCell>
                    <Link href={`/system-settings/account-management/${user.id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>編輯</Link>
                  </TableCell>
                </TableRow>
              )
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  {query ? '找不到符合的帳號' : '尚無帳號資料'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AccountManagementPage() {
  const [tab, setTab] = useState<Tab>('roles')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="帳號管理" />
      <div className="flex border-b border-border">
        {(['roles', 'accounts'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px whitespace-nowrap border-b-2 px-5 py-2 text-sm font-medium transition-colors ${tab === t ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'roles' ? '角色管理' : '帳號列表'}
          </button>
        ))}
      </div>
      {tab === 'roles' ? <RolesTab /> : <AccountsTab />}
    </div>
  )
}
