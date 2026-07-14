'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { OrgUnit, RoleType, UnitType, OrgUnitRole, OrgUnitMember, AppUser, UserPosition } from '@/lib/types'
import { emailToEnglishName, stripSurname } from '@/lib/userNames'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { SearchableSelect } from '@/components/ui/searchable-select'
import PageHeader from '@/app/_components/PageHeader'
import OrgApprovalTabNav from '@/app/_components/OrgApprovalTabNav'
import {
  addUserPosition, removeUserPosition,
  insertOrgUnit, updateOrgUnit, deleteOrgUnit, reorderOrgUnits, moveOrgUnit, updateOrgUnitsExpanded,
  addOrgUnitRole, deleteOrgUnitRole,
  addRoleType, updateRoleType, deleteRoleType,
  addOrgUnitMemberByUser, removeOrgUnitMember, relinkOrgUnitMembers, updateOrgUnitMemberRole,
  previewOrgImport, commitOrgImport, getOrgImportTemplate,
  type OrgImportPreview, type OrgImportRow,
} from '@/app/actions/org-structure'


const btnSave = 'cursor-pointer rounded bg-foreground px-2.5 py-0.5 text-xs text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50'
const btnCancel = 'cursor-pointer rounded border border-border bg-transparent px-2.5 py-0.5 text-xs text-foreground hover:bg-muted'
const btnDashed = 'cursor-pointer rounded border border-dashed border-border bg-transparent px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/50'
const btnDelete = 'cursor-pointer bg-transparent text-xs text-destructive hover:underline'
const selectCls = 'rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus:border-ring dark:bg-input/30'

const INDENT_PX = 20

function depthSizeClass(depth: number): string {
  if (depth === 0) return 'text-base font-bold'
  if (depth === 1) return 'text-sm font-semibold'
  return 'text-[13px] font-medium'
}

// 判斷 nodeId 是否為 ancestorId 的子孫節點（避免拖移造成循環參照）
function isDescendant(allUnits: OrgUnit[], ancestorId: number, nodeId: number): boolean {
  let current = allUnits.find(u => u.id === nodeId)
  while (current && current.parent_id != null) {
    if (current.parent_id === ancestorId) return true
    current = allUnits.find(u => u.id === current!.parent_id)
  }
  return false
}

// 依節點目前在樹狀結構中的實際深度即時換算 L 數字，後面接著「層級」欄位中的類別文字（去掉原本的 L 數字前綴）
function formatLevelLabel(level: string, depth: number): string {
  const category = level.replace(/^L\d+\s*/, '')
  return category ? `L${depth + 1} ${category}` : `L${depth + 1}`
}

// 依各節點儲存的 default_expanded 設定，算出預設收合的節點 id 集合
function computeDefaultCollapsed(allUnits: OrgUnit[]): Set<number> {
  return new Set(allUnits.filter(u => !u.default_expanded).map(u => u.id))
}

function buildDisplayName(unit: OrgUnit, roleType: RoleType): string {
  const prefix = [unit.code, unit.name].filter(Boolean).join(' ')
  return `${prefix} ${roleType.name}`
}

// ── RoleRow ───────────────────────────────────────────────────────────────────

function RoleRow({
  role, unit, roleTypes, users, positions, indent, onRefresh, onDelete,
}: {
  role: OrgUnitRole; unit: OrgUnit; roleTypes: RoleType[]; users: AppUser[]
  positions: UserPosition[]; indent: number; onRefresh: () => void; onDelete: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const roleType = roleTypes.find(r => r.id === role.role_type_id)
  const displayName = role.display_name ?? (roleType ? buildDisplayName(unit, roleType) : `角色 #${role.id}`)
  const assignedPositions = positions.filter(p => p.org_unit_role_id === role.id)
  const assignedUserIds = new Set(assignedPositions.map(p => p.user_id))
  const availableUsers = users.filter(u => !assignedUserIds.has(u.id))

  async function handleAdd() {
    if (!selectedUserId) return
    setError(null)
    const err = await addUserPosition(Number(selectedUserId), role.id)
    if (err) { setError(err); return }
    setAdding(false); setSelectedUserId(''); onRefresh()
  }

  async function handleRemove(positionId: number) {
    if (!confirm('確定移除此職位指派？')) return
    const err = await removeUserPosition(positionId)
    if (err) { setError(err); return }
    onRefresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 py-1 text-sm" style={{ paddingLeft: indent + 28 }}>
      <span className="whitespace-nowrap text-foreground">{displayName}</span>
      <button onClick={onDelete} className={btnDelete}>刪除</button>
      <div className="flex flex-wrap items-center gap-1.5">
        {assignedPositions.map(pos => {
          const user = users.find(u => u.id === pos.user_id)
          return (
            <span key={pos.id} className="inline-flex items-center gap-1 rounded-full bg-blue-100 py-0.5 pl-3 pr-2 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              {user ? emailToEnglishName(user.email) : `用戶 #${pos.user_id}`}
              <button onClick={() => handleRemove(pos.id)} title="移除" className="flex cursor-pointer items-center text-base leading-none text-blue-400 hover:text-blue-600">×</button>
            </span>
          )
        })}

        {adding ? (
          <span className="inline-flex items-center gap-1.5">
            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} autoFocus className={selectCls}>
              <option value="">選擇使用者</option>
              {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name}（{u.email}）</option>)}
            </select>
            <button onClick={handleAdd} disabled={!selectedUserId} className={btnSave}>確認</button>
            <button onClick={() => { setAdding(false); setSelectedUserId('') }} className={btnCancel}>取消</button>
          </span>
        ) : availableUsers.length > 0 ? (
          <button onClick={() => setAdding(true)} className={btnDashed}>＋ 新增</button>
        ) : assignedPositions.length === 0 ? (
          <span className="text-xs text-muted-foreground/40">（未指派）</span>
        ) : null}

        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  )
}

// ── MembersSection（負責人清單）───────────────────────────────────────

function MemberChip({ m, roleTypes, onRemove, onRefresh }: {
  m: OrgUnitMember; roleTypes: RoleType[]; onRemove: () => void; onRefresh: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState(String(m.role_type_id ?? ''))
  const roleType = roleTypes.find(r => r.id === m.role_type_id)

  async function handleSaveRole() {
    const err = await updateOrgUnitMemberRole(m.id, selectedRoleId ? Number(selectedRoleId) : null)
    if (err) return
    setEditing(false); onRefresh()
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <select value={selectedRoleId} onChange={e => setSelectedRoleId(e.target.value)} autoFocus className="h-7 rounded border border-border bg-background px-1.5 text-xs text-foreground">
          <option value="">（無職稱）</option>
          {roleTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
        </select>
        <button onClick={handleSaveRole} className={btnSave}>確認</button>
        <button onClick={() => { setEditing(false); setSelectedRoleId(String(m.role_type_id ?? '')) }} className={btnCancel}>取消</button>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 py-0.5 pl-3 pr-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      {roleType && <span className="font-medium">{roleType.name}・</span>}
      {stripSurname(m.display_name)}
      {m.user_id == null && <span className="text-emerald-400" title="尚未綁定系統帳號">？</span>}
      <button onClick={() => setEditing(true)} title="設定職稱" className="ml-0.5 flex cursor-pointer items-center text-xs leading-none text-emerald-400 hover:text-emerald-600">✎</button>
      <button onClick={onRemove} title="移除" className="flex cursor-pointer items-center text-base leading-none text-emerald-400 hover:text-emerald-600">×</button>
    </span>
  )
}

function MembersSection({
  unit, members, users, roleTypes, indent, onRefresh,
}: {
  unit: OrgUnit; members: OrgUnitMember[]; users: AppUser[]; roleTypes: RoleType[]; indent: number; onRefresh: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRoleTypeId, setSelectedRoleTypeId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const unitMembers = members.filter(m => m.org_unit_id === unit.id).sort((a, b) => a.sort_order - b.sort_order)
  const assignedUserIds = new Set(unitMembers.map(m => m.user_id).filter((id): id is number => id != null))
  const availableUsers = users.filter(u => !assignedUserIds.has(u.id))

  async function handleAdd() {
    if (!selectedUserId) return
    setError(null)
    const err = await addOrgUnitMemberByUser(unit.id, Number(selectedUserId), selectedRoleTypeId ? Number(selectedRoleTypeId) : undefined)
    if (err) { setError(err); return }
    setSelectedUserId(''); setSelectedRoleTypeId(''); setAdding(false); onRefresh()
  }

  async function handleRemove(memberId: number) {
    if (!confirm('確定移除此負責人？')) return
    const err = await removeOrgUnitMember(memberId)
    if (err) { setError(err); return }
    onRefresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1 text-sm" style={{ paddingLeft: indent + 28 }}>
      {unitMembers.map(m => (
        <MemberChip key={m.id} m={m} roleTypes={roleTypes} onRemove={() => handleRemove(m.id)} onRefresh={onRefresh} />
      ))}

      {adding ? (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <SearchableSelect
            value={selectedUserId}
            onChange={setSelectedUserId}
            options={availableUsers.map(u => ({ value: String(u.id), label: `${u.name}（${emailToEnglishName(u.email)}）` }))}
            placeholder="搜尋使用者"
            style={{ height: 28, width: 180, fontSize: 14 }}
          />
          <select value={selectedRoleTypeId} onChange={e => setSelectedRoleTypeId(e.target.value)} className="h-7 rounded border border-border bg-background px-1.5 text-xs text-foreground">
            <option value="">選擇職稱（選填）</option>
            {roleTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
          </select>
          <button onClick={handleAdd} disabled={!selectedUserId} className={btnSave}>確認</button>
          <button onClick={() => { setAdding(false); setSelectedUserId(''); setSelectedRoleTypeId('') }} className={btnCancel}>取消</button>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </span>
      ) : (
        <button onClick={() => setAdding(true)} className={btnDashed}>+ 新增負責人</button>
      )}

      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

// ── OrgTreeNode（通用遞迴樹節點，取代 DeptBlock/OrgNodeRows）─────────────────────────

type DragHandlers = {
  draggedId: number | null
  dragOverId: number | null
  onDragStart: (id: number) => void
  onDragOver: (id: number) => void
  onDrop: (id: number) => void
  onDragEnd: () => void
}

function OrgTreeNode({
  unit, allUnits, roleTypes, orgUnitRoles, users, positions, members,
  depth, collapsedUnits, onToggleCollapse, onRefresh, drag,
}: {
  unit: OrgUnit; allUnits: OrgUnit[]; roleTypes: RoleType[]; orgUnitRoles: OrgUnitRole[]
  users: AppUser[]; positions: UserPosition[]; members: OrgUnitMember[]
  depth: number; collapsedUnits: Set<number>; onToggleCollapse: (id: number) => void; onRefresh: () => void
  drag: DragHandlers
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editLevel, setEditLevel] = useState(unit.level)
  const [editCode, setEditCode] = useState(unit.code ?? '')
  const [editName, setEditName] = useState(unit.name)
  const [editUnitType, setEditUnitType] = useState<UnitType>(unit.unit_type)
  const [isAddingChild, setIsAddingChild] = useState(false)
  const [childName, setChildName] = useState('')
  const [addingChild, setAddingChild] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sizeCls = depthSizeClass(depth)
  const children = allUnits.filter(u => u.parent_id === unit.id).sort((a, b) => a.sort_order - b.sort_order)
  const hasChildren = children.length > 0
  const isCollapsed = collapsedUnits.has(unit.id)
  const unitRoles = orgUnitRoles.filter(r => r.org_unit_id === unit.id).sort((a, b) => a.sort_order - b.sort_order)

  async function handleEditSave() {
    if (!editName.trim()) return
    setError(null)
    const err = await updateOrgUnit(unit.id, editCode.trim() || null, editName.trim(), editLevel.trim(), editUnitType)
    if (err) { setError(err); return }
    setIsEditing(false); onRefresh()
  }

  async function handleDelete() {
    if (!confirm(`確定刪除「${unit.name}」？若有子節點或職位將無法刪除。`)) return
    setError(null)
    const err = await deleteOrgUnit(unit.id)
    if (err) { setError(err); return }
    onRefresh()
  }

  async function handleAddChild() {
    if (!childName.trim() || addingChild) return
    setError(null)
    setAddingChild(true)
    const maxOrder = allUnits.filter(u => u.parent_id === unit.id).reduce((m, u) => Math.max(m, u.sort_order), -1)
    const err = await insertOrgUnit({ code: null, name: childName.trim(), level: '', parentId: unit.id, sortOrder: maxOrder + 1 })
    setAddingChild(false)
    if (err) { setError(err); return }
    setChildName(''); setIsAddingChild(false); onRefresh()
  }

  async function handleDeleteRole(roleId: number) {
    if (!confirm('確定刪除此職位？已指派的人員也會一併移除。')) return
    setError(null)
    const err = await deleteOrgUnitRole(roleId)
    if (err) { setError(err); return }
    onRefresh()
  }

  const body = (
    <>
      <div className="flex items-center justify-between gap-2 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {hasChildren ? (
            <button onClick={() => onToggleCollapse(unit.id)} className="w-4 shrink-0 cursor-pointer text-xs text-muted-foreground">{isCollapsed ? '▸' : '▾'}</button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          {isEditing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input value={editLevel} onChange={e => setEditLevel(e.target.value)} placeholder="層級" className="h-7 w-20 text-sm" />
              <Input value={editCode} onChange={e => setEditCode(e.target.value)} placeholder="編號（選填）" className="h-7 w-24 text-sm" />
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="名稱" className="h-7 w-40 text-sm" onKeyDown={e => { if (e.key === 'Enter') handleEditSave() }} autoFocus />
              <select value={editUnitType ?? ''} onChange={e => setEditUnitType(e.target.value === '' ? null : e.target.value as UnitType)} className={selectCls}>
                <option value="">對應類型：不適用</option>
                <option value="division">對應類型：處別</option>
                <option value="section">對應類型：課別</option>
              </select>
              <button onClick={handleEditSave} className={btnSave}>保存</button>
              <button onClick={() => { setIsEditing(false); setEditLevel(unit.level); setEditCode(unit.code ?? ''); setEditName(unit.name); setEditUnitType(unit.unit_type) }} className={btnCancel}>取消</button>
            </div>
          ) : (
            <span className="flex min-w-0 items-center gap-2">
              <span className={`truncate text-foreground ${sizeCls}`}>
                {[unit.code, unit.name].filter(Boolean).join(' ')}
              </span>
              {unit.unit_type === 'division' && (
                <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-300">處別</span>
              )}
              {unit.unit_type === 'section' && (
                <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">課別</span>
              )}
            </span>
          )}
        </div>
        {!isEditing && (
          <div className="flex shrink-0 items-center gap-1.5">
            {!isAddingChild && (
              <button onClick={() => { if (isCollapsed) onToggleCollapse(unit.id); setIsAddingChild(true) }} className={btnDashed}>+ 新增子節點</button>
            )}
            <button onClick={() => setIsEditing(true)} className={btnCancel}>編輯</button>
            <button onClick={handleDelete} className={btnDelete}>刪除</button>
          </div>
        )}
      </div>
      {error && <div className="pl-7 text-xs text-destructive">{error}</div>}

      {unitRoles.map(role => (
        <RoleRow
          key={role.id}
          role={role} unit={unit} roleTypes={roleTypes} users={users}
          positions={positions} indent={0}
          onRefresh={onRefresh}
          onDelete={() => handleDeleteRole(role.id)}
        />
      ))}



      <MembersSection unit={unit} members={members} users={users} roleTypes={roleTypes} indent={0} onRefresh={onRefresh} />

      {isAddingChild && (
        <div className="border-t border-dashed border-border py-2 pl-8">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={childName} onChange={e => setChildName(e.target.value)} placeholder="名稱" className="h-7 w-40 text-sm" onKeyDown={e => { if (e.key === 'Enter') handleAddChild() }} autoFocus />
            <button onClick={handleAddChild} disabled={addingChild} className={btnSave}>新增</button>
            <button onClick={() => { setIsAddingChild(false); setChildName('') }} className={btnCancel}>取消</button>
          </div>
        </div>
      )}
    </>
  )

  return (
    <>
      <div
        draggable
        onDragStart={() => drag.onDragStart(unit.id)}
        onDragOver={e => { e.preventDefault(); drag.onDragOver(unit.id) }}
        onDrop={e => { e.preventDefault(); drag.onDrop(unit.id) }}
        onDragEnd={drag.onDragEnd}
        className={`cursor-grab rounded-lg border border-border bg-card p-3 transition-all active:cursor-grabbing ${drag.dragOverId === unit.id ? 'ring-2 ring-primary' : ''} ${drag.draggedId === unit.id ? 'opacity-40' : ''}`}
        style={{ marginLeft: depth * INDENT_PX }}
      >
        {body}
      </div>
      {!isCollapsed && children.map(child => (
        <OrgTreeNode
          key={child.id}
          unit={child} allUnits={allUnits} roleTypes={roleTypes} orgUnitRoles={orgUnitRoles}
          users={users} positions={positions} members={members}
          depth={depth + 1} collapsedUnits={collapsedUnits} onToggleCollapse={onToggleCollapse} onRefresh={onRefresh}
          drag={drag}
        />
      ))}
    </>
  )
}

// ── ArrangeNode / ArrangeModal（精簡排列清單，方便長組織圖拖曳）──────────────────────

function ArrangeNode({ unit, allUnits, depth, collapsedIds, onToggleCollapse, drag }: {
  unit: OrgUnit; allUnits: OrgUnit[]; depth: number
  collapsedIds: Set<number>; onToggleCollapse: (id: number) => void
  drag: DragHandlers
}) {
  const children = allUnits.filter(u => u.parent_id === unit.id).sort((a, b) => a.sort_order - b.sort_order)
  const hasChildren = children.length > 0
  const isCollapsed = collapsedIds.has(unit.id)

  return (
    <>
      <div
        draggable
        onDragStart={() => drag.onDragStart(unit.id)}
        onDragOver={e => { e.preventDefault(); drag.onDragOver(unit.id) }}
        onDrop={e => { e.preventDefault(); drag.onDrop(unit.id) }}
        onDragEnd={drag.onDragEnd}
        className={`flex cursor-grab items-center gap-2 rounded border border-border bg-card px-2 py-1.5 text-sm transition-all active:cursor-grabbing ${drag.dragOverId === unit.id ? 'ring-2 ring-primary' : ''} ${drag.draggedId === unit.id ? 'opacity-40' : ''}`}
        style={{ marginLeft: depth * INDENT_PX }}
      >
        {hasChildren ? (
          <button onClick={() => onToggleCollapse(unit.id)} className="w-4 shrink-0 cursor-pointer text-xs text-muted-foreground">{isCollapsed ? '▸' : '▾'}</button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className="shrink-0 text-muted-foreground">⠿</span>
        <span className="shrink-0 text-xs text-muted-foreground">{formatLevelLabel(unit.level, depth)}</span>
        <span className="truncate font-medium text-foreground">{unit.name}</span>
      </div>
      {!isCollapsed && children.map(child => (
        <ArrangeNode key={child.id} unit={child} allUnits={allUnits} depth={depth + 1} collapsedIds={collapsedIds} onToggleCollapse={onToggleCollapse} drag={drag} />
      ))}
    </>
  )
}

function ArrangeModal({ units, drag, onClose, onSavedExpand }: { units: OrgUnit[]; drag: DragHandlers; onClose: () => void; onSavedExpand: () => void }) {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(() => computeDefaultCollapsed(units))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function toggleCollapse(id: number) {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // 比對目前收合狀態與資料庫已儲存的 default_expanded，找出有變動的節點
  const pendingChanges = units.filter(u => collapsedIds.has(u.id) === u.default_expanded)
  const hasChanges = pendingChanges.length > 0

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const err = await updateOrgUnitsExpanded(pendingChanges.map(u => ({ id: u.id, defaultExpanded: !collapsedIds.has(u.id) })))
    setSaving(false)
    if (err) { setSaveError(err); return }
    onSavedExpand()
  }

  const topUnits = units.filter(u => u.parent_id === null).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">排列組織架構</h2>
          <button onClick={onClose} className="cursor-pointer text-lg leading-none text-muted-foreground hover:text-foreground">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-2 text-xs text-muted-foreground">拖曳節點可調整同層順序，或拖到其他節點上使其成為該節點的子節點（子節點會一併移動）。順序變更會立即儲存。點擊節點左側箭頭可調整「主畫面預設展開/收合」狀態，調整後請按下方「儲存收合設定」套用。</p>
          <div className="flex flex-col gap-1.5">
            {topUnits.map(unit => (
              <ArrangeNode key={unit.id} unit={unit} allUnits={units} depth={0} collapsedIds={collapsedIds} onToggleCollapse={toggleCollapse} drag={drag} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground">{saveError ? <span className="text-destructive">錯誤：{saveError}</span> : hasChanges ? '收合設定有未儲存的變更' : '收合設定已是最新'}</span>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>{saving ? '儲存中...' : '儲存收合設定'}</Button>
        </div>
      </div>
    </div>
  )
}

// ── RoleTypesPanel ────────────────────────────────────────────────────────────

function RoleTypeRow({ r, onRefresh, onError }: { r: RoleType; onRefresh: () => void; onError: (msg: string) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(r.name)

  async function handleSave() {
    if (!editName.trim()) return
    const err = await updateRoleType(r.id, editName.trim())
    if (err) { onError(err); return }
    setIsEditing(false); onRefresh()
  }

  async function handleDelete() {
    if (!confirm('確定刪除此職稱？所有使用此職稱的職位與人員指派也會一併移除。')) return
    const err = await deleteRoleType(r.id)
    if (err) { onError(err); return }
    onRefresh()
  }

  if (isEditing) {
    return (
      <TableRow>
        <TableCell>
          <Input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSave() }} className="h-7 w-36 text-sm" autoFocus />
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <button onClick={handleSave} className={`${btnSave} mr-1`}>保存</button>
          <button onClick={() => { setIsEditing(false); setEditName(r.name) }} className={btnCancel}>取消</button>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow>
      <TableCell className="text-sm">{r.name}</TableCell>
      <TableCell className="whitespace-nowrap">
        <button onClick={() => setIsEditing(true)} className="mr-2 text-xs text-foreground hover:underline">編輯</button>
        <button onClick={handleDelete} className={btnDelete}>刪除</button>
      </TableCell>
    </TableRow>
  )
}

function RoleTypesPanel({ roleTypes, onRefresh }: { roleTypes: RoleType[]; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!name.trim()) return
    setError(null)
    const maxOrder = roleTypes.reduce((m, r) => Math.max(m, r.sort_order), -1)
    const err = await addRoleType(name.trim(), maxOrder + 1)
    if (err) { setError(err); return }
    setName(''); onRefresh()
  }

  return (
    <Card className="mt-4">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="text-xs text-muted-foreground">{expanded ? '▾' : '▸'}</span>
          職稱管理
        </CardTitle>
      </CardHeader>
      <p className="-mt-2 px-4 pb-2 text-sm text-muted-foreground">
        管理可用的職稱（如課長、處長），新增後才能在上方樹狀圖的負責人中選用。
      </p>

      {expanded && (
        <CardContent className="flex flex-col gap-4 pt-0">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>職稱名稱</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roleTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-sm text-muted-foreground">尚無職稱</TableCell>
                </TableRow>
              ) : roleTypes.map(r => (
                <RoleTypeRow key={r.id} r={r} onRefresh={onRefresh} onError={setError} />
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
              placeholder="職稱名稱（如課長）"
              className="w-44"
            />
            <Button onClick={handleAdd}>新增</Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ── ImportModal（Excel 組織架構匯入）──────────────────────────────────────────────

function buildPreviewTree(rows: OrgImportRow[]) {
  const childrenMap = new Map<number | null, number[]>()
  for (const row of rows) {
    const list = childrenMap.get(row.parentRowIndex) ?? []
    list.push(row.rowIndex)
    childrenMap.set(row.parentRowIndex, list)
  }
  return { roots: childrenMap.get(null) ?? [], childrenMap }
}

function PreviewNode({ rowIndex, rows, childrenMap, depth }: {
  rowIndex: number; rows: OrgImportRow[]; childrenMap: Map<number | null, number[]>; depth: number
}) {
  const row = rows[rowIndex]
  const children = childrenMap.get(rowIndex) ?? []
  return (
    <div>
      <div className={`py-0.5 ${depthSizeClass(depth)}`} style={{ paddingLeft: depth * INDENT_PX }}>
        {row.name}
        {row.members.length > 0 && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">（{row.members.join('、')}）</span>
        )}
      </div>
      {children.map(idx => <PreviewNode key={idx} rowIndex={idx} rows={rows} childrenMap={childrenMap} depth={depth + 1} />)}
    </div>
  )
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<OrgImportPreview | null>(null)
  const [conflictChoices, setConflictChoices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePreview() {
    if (!file) return
    setLoading(true); setError(null); setPreview(null)
    const formData = new FormData()
    formData.append('file', file)
    const result = await previewOrgImport(formData)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    setPreview(result)
    const choices: Record<string, number> = {}
    for (const c of result.conflicts) choices[c.name] = c.rowIndexes[0]
    setConflictChoices(choices)
  }

  async function handleConfirm() {
    if (!preview) return
    setLoading(true); setError(null)
    const rows = preview.rows.map(row => {
      if (row.parentName && conflictChoices[row.parentName] !== undefined) {
        return { ...row, parentRowIndex: conflictChoices[row.parentName] }
      }
      return row
    })
    const err = await commitOrgImport(rows)
    setLoading(false)
    if (err) { setError(err); return }
    onImported()
  }

  async function handleDownloadTemplate() {
    const base64 = await getOrgImportTemplate()
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '組織架構匯入範例.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const tree = preview ? buildPreviewTree(preview.rows) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">匯入組織架構（Excel）</h2>
          <button onClick={onClose} className="cursor-pointer text-lg leading-none text-muted-foreground hover:text-foreground">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-3 text-sm text-muted-foreground">
            請上傳包含「層級」「職務名稱」「上級職務」「負責人」欄位的 .xlsx 檔案，系統會依「上級職務」自動判讀階層關係。範例：「業務一課」的上級職務填「業務部」，系統就會把它放在業務部底下；「業務一課A科」的上級職務填「業務一課」，就會再放到業務一課底下，依此類推。「層級」只是分類標籤（部門/課/科...），畫面上看到的 L1/L2/L3 編號是系統依階層關係自動產生，不需要自己填；「負責人」有多人時用「、」分隔。
          </p>
          <div className="mb-3 overflow-hidden rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>層級</TableHead>
                  <TableHead>職務名稱</TableHead>
                  <TableHead>上級職務</TableHead>
                  <TableHead>負責人</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm">部門</TableCell>
                  <TableCell className="text-sm">業務部</TableCell>
                  <TableCell className="text-sm text-muted-foreground">（空白）</TableCell>
                  <TableCell className="text-sm text-muted-foreground">（空白）</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm">課</TableCell>
                  <TableCell className="text-sm">業務一課</TableCell>
                  <TableCell className="text-sm">業務部</TableCell>
                  <TableCell className="text-sm">王小明</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm">科</TableCell>
                  <TableCell className="text-sm">業務一課A科</TableCell>
                  <TableCell className="text-sm">業務一課</TableCell>
                  <TableCell className="text-sm">陳小華</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="mb-3">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>下載範例檔案</Button>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setPreview(null); setError(null) }}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>選擇檔案</Button>
            <span className="text-sm text-muted-foreground">{file ? file.name : '未選擇任何檔案'}</span>
            <Button onClick={handlePreview} disabled={!file || loading}>{loading ? '處理中...' : '上傳並預覽'}</Button>
          </div>

          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

          {preview && preview.conflicts.length > 0 && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              <p className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">發現重複的職務名稱，請確認「上級職務」應對應到哪一列：</p>
              {preview.conflicts.map(c => (
                <div key={c.name} className="mb-1.5 flex items-center gap-2 text-sm">
                  <span>「{c.name}」→</span>
                  <select
                    value={conflictChoices[c.name] ?? c.rowIndexes[0]}
                    onChange={e => setConflictChoices(prev => ({ ...prev, [c.name]: Number(e.target.value) }))}
                    className={selectCls}
                  >
                    {c.rowIndexes.map(idx => (
                      <option key={idx} value={idx}>第 {idx + 2} 列：{preview.rows[idx].name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {preview && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">預覽（共 {preview.rows.length} 筆）：</p>
              <div className="max-h-80 overflow-y-auto rounded-md border border-border p-2">
                {tree && tree.roots.length > 0 ? (
                  tree.roots.map(rowIndex => (
                    <PreviewNode key={rowIndex} rowIndex={rowIndex} rows={preview.rows} childrenMap={tree.childrenMap} depth={0} />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">無資料</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button onClick={onClose} className={btnCancel}>取消</button>
          <Button onClick={handleConfirm} disabled={!preview || preview.rows.length === 0 || loading}>{loading ? '匯入中...' : '確認匯入'}</Button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrgStructurePage() {
  const [units, setUnits] = useState<OrgUnit[]>([])
  const [roleTypes, setRoleTypes] = useState<RoleType[]>([])
  const [orgUnitRoles, setOrgUnitRoles] = useState<OrgUnitRole[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [positions, setPositions] = useState<UserPosition[]>([])
  const [members, setMembers] = useState<OrgUnitMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddingRoot, setIsAddingRoot] = useState(false)
  const [rootLevel, setRootLevel] = useState('')
  const [rootName, setRootName] = useState('')
  const [addRootError, setAddRootError] = useState<string | null>(null)
  const [collapsedUnits, setCollapsedUnits] = useState<Set<number>>(new Set())
  const collapseInitialized = useRef(false)
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showArrange, setShowArrange] = useState(false)
  const [relinking, setRelinking] = useState(false)
  const [relinkMessage, setRelinkMessage] = useState<string | null>(null)

  async function loadAll() {
    setError(null)
    const [uRes, rRes, orRes, usersRes, posRes, memRes] = await Promise.all([
      supabase.from('org_units').select('*').order('sort_order'),
      supabase.from('role_types').select('*').order('level').order('sort_order'),
      supabase.from('org_unit_roles').select('*').order('org_unit_id').order('sort_order'),
      supabase.from('app_users').select('id, name, email, created_at, updated_at').order('id'),
      supabase.from('user_positions').select('*'),
      supabase.from('org_unit_members').select('*').order('org_unit_id').order('sort_order'),
    ])
    if (uRes.error) { setError(uRes.error.message); return }
    if (rRes.error) { setError(rRes.error.message); return }
    if (orRes.error) { setError(orRes.error.message); return }
    if (usersRes.error) { setError(usersRes.error.message); return }
    if (posRes.error) { setError(posRes.error.message); return }
    if (memRes.error) { setError(memRes.error.message); return }
    const unitsData = (uRes.data as OrgUnit[]) ?? []
    setUnits(unitsData)
    if (!collapseInitialized.current) {
      setCollapsedUnits(computeDefaultCollapsed(unitsData))
      collapseInitialized.current = true
    }
    setRoleTypes((rRes.data as RoleType[]) ?? [])
    setOrgUnitRoles((orRes.data as OrgUnitRole[]) ?? [])
    setUsers((usersRes.data as AppUser[]) ?? [])
    setPositions((posRes.data as UserPosition[]) ?? [])
    setMembers((memRes.data as OrgUnitMember[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  function toggleCollapse(id: number) {
    setCollapsedUnits(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleDrop(targetId: number) {
    const draggedUnit = units.find(u => u.id === draggedId)
    const targetUnit = units.find(u => u.id === targetId)
    setDraggedId(null); setDragOverId(null)
    if (!draggedUnit || !targetUnit || draggedUnit.id === targetUnit.id) return
    if (isDescendant(units, draggedUnit.id, targetUnit.id)) return // 避免拖移到自己的子孫節點底下，造成循環

    if (draggedUnit.parent_id === targetUnit.parent_id) {
      // 同一層兄弟節點：互換順序
      const siblings = units.filter(u => u.parent_id === draggedUnit.parent_id).sort((a, b) => a.sort_order - b.sort_order)
      const fromIdx = siblings.findIndex(u => u.id === draggedUnit.id)
      const toIdx = siblings.findIndex(u => u.id === targetUnit.id)
      if (fromIdx === -1 || toIdx === -1) return
      const reordered = [...siblings]
      const [moved] = reordered.splice(fromIdx, 1)
      reordered.splice(toIdx, 0, moved)
      await reorderOrgUnits(reordered.map((u, i) => ({ id: u.id, sortOrder: i })))
    } else {
      // 不同層級：拖到目標節點上，使其成為目標節點的子節點（連同子孫一起移動）
      const newSiblings = units.filter(u => u.parent_id === targetUnit.id)
      const maxOrder = newSiblings.reduce((m, u) => Math.max(m, u.sort_order), -1)
      const err = await moveOrgUnit(draggedUnit.id, targetUnit.id, maxOrder + 1)
      if (err) { setError(err); return }
    }
    loadAll()
  }

  const dragHandlers: DragHandlers = {
    draggedId, dragOverId,
    onDragStart: setDraggedId,
    onDragOver: setDragOverId,
    onDrop: handleDrop,
    onDragEnd: () => { setDraggedId(null); setDragOverId(null) },
  }

  async function handleRelink() {
    setRelinking(true)
    setRelinkMessage(null)
    setError(null)
    const err = await relinkOrgUnitMembers()
    setRelinking(false)
    if (err) { setError(err); return }
    setRelinkMessage('已完成帳號比對')
    loadAll()
  }

  async function handleAddRoot() {
    if (!rootName.trim() || !rootLevel.trim()) return
    setAddRootError(null)
    const maxOrder = units.filter(u => u.parent_id === null).reduce((m, u) => Math.max(m, u.sort_order), -1)
    const err = await insertOrgUnit({ code: null, name: rootName.trim(), level: rootLevel.trim(), parentId: null, sortOrder: maxOrder + 1 })
    if (err) { setAddRootError(err); return }
    setRootName(''); setRootLevel(''); setIsAddingRoot(false); loadAll()
  }

  if (loading) return <p className="text-muted-foreground">載入中...</p>

  const topUnits = units.filter(u => u.parent_id === null).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader
          title="組織架構與審核管理"
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleRelink} disabled={relinking}>{relinking ? '比對中...' : '重新比對帳號'}</Button>
              <Button variant="outline" onClick={() => setShowArrange(true)}>排列組織架構</Button>
              <Button variant="outline" onClick={() => setShowImport(true)}>匯入組織架構</Button>
              {!isAddingRoot && <Button onClick={() => setIsAddingRoot(true)}>+ 新增頂層節點</Button>}
            </div>
          }
        />
        <p className="mt-1 text-sm text-muted-foreground">管理組織單位的階層結構，設定各職位，並指派對應的使用者。每個節點可獨立收合展開。</p>
      </div>

      <OrgApprovalTabNav />

      {isAddingRoot && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-muted/50 px-4 py-3">
          <span className="text-sm text-muted-foreground">新增頂層節點：</span>
          <Input value={rootLevel} onChange={e => setRootLevel(e.target.value)} placeholder="層級（如：部門）" className="w-32" />
          <Input value={rootName} onChange={e => setRootName(e.target.value)} placeholder="名稱（如：第三部門）" className="w-48" onKeyDown={e => { if (e.key === 'Enter') handleAddRoot() }} autoFocus />
          <button onClick={handleAddRoot} className={btnSave}>新增</button>
          <button onClick={() => { setIsAddingRoot(false); setRootLevel(''); setRootName('') }} className={btnCancel}>取消</button>
          {addRootError && <span className="text-xs text-destructive">{addRootError}</span>}
        </div>
      )}

      {error && <p className="text-sm text-destructive">錯誤：{error}</p>}
      {relinkMessage && <p className="text-sm text-emerald-600">{relinkMessage}</p>}

      {topUnits.length === 0 ? (
        <p className="text-sm text-muted-foreground">尚無組織架構資料，請點右上角「+ 新增頂層節點」開始建立，或使用「匯入組織架構」匯入 Excel。</p>
      ) : (
        <div className="flex flex-col gap-3">
          {topUnits.map(unit => (
            <OrgTreeNode
              key={unit.id}
              unit={unit} allUnits={units} roleTypes={roleTypes} orgUnitRoles={orgUnitRoles}
              users={users} positions={positions} members={members}
              depth={0} collapsedUnits={collapsedUnits} onToggleCollapse={toggleCollapse} onRefresh={loadAll}
              drag={dragHandlers}
            />
          ))}
        </div>
      )}

      <RoleTypesPanel roleTypes={roleTypes} onRefresh={loadAll} />

      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); loadAll() }} />
      )}

      {showArrange && (
        <ArrangeModal units={units} drag={dragHandlers} onClose={() => setShowArrange(false)} onSavedExpand={() => { collapseInitialized.current = false; loadAll() }} />
      )}
    </div>
  )
}
