'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { OrgUnit, OrgLevel, RoleType, RoleLevel, OrgUnitRole, AppUser, UserPosition } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import PageHeader from '@/app/_components/PageHeader'
import {
  addUserPosition, removeUserPosition,
  insertOrgUnit, updateOrgUnit, deleteOrgUnit, reorderOrgUnits,
  addOrgUnitRole, deleteOrgUnitRole,
  addRoleType, updateRoleType, deleteRoleType,
} from '@/app/actions/org-structure'

const LEVEL_INDENT: Record<OrgLevel, number> = { '部門': 0, '處': 0, '課': 16, '科': 32 }
const LEVEL_FONT_SIZE: Record<OrgLevel, string> = { '部門': 'text-base', '處': 'text-sm', '課': 'text-[13px]', '科': 'text-[13px]' }
const LEVEL_WEIGHT: Record<OrgLevel, string> = { '部門': 'font-bold', '處': 'font-semibold', '課': 'font-medium', '科': 'font-medium' }
const CHILD_LEVEL: Partial<Record<OrgLevel, OrgLevel>> = { '部門': '處', '處': '課', '課': '科' }
const ROLE_LEVELS: RoleLevel[] = ['處', '課', '科']

const btnSave = 'cursor-pointer rounded bg-foreground px-2.5 py-0.5 text-xs text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50'
const btnCancel = 'cursor-pointer rounded border border-border bg-transparent px-2.5 py-0.5 text-xs text-foreground hover:bg-muted'
const btnDashed = 'cursor-pointer rounded border border-dashed border-border bg-transparent px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/50'
const btnDelete = 'cursor-pointer bg-transparent text-xs text-destructive hover:underline'
const selectCls = 'rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus:border-ring dark:bg-input/30'

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
    <tr>
      <td className="w-px whitespace-nowrap py-1.5 pr-3 align-middle text-sm text-foreground" style={{ paddingLeft: indent + 28 }}>
        <div className="flex items-center gap-2.5">
          <span>{displayName}</span>
          <button onClick={onDelete} className={btnDelete}>刪除</button>
        </div>
      </td>
      <td className="px-3 py-1.5 align-middle">
        <div className="flex flex-wrap items-center gap-1.5">
          {assignedPositions.map(pos => {
            const user = users.find(u => u.id === pos.user_id)
            return (
              <span key={pos.id} className="inline-flex items-center gap-1 rounded-full bg-blue-100 py-0.5 pl-3 pr-2 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {user?.name ?? `用戶 #${pos.user_id}`}
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
      </td>
    </tr>
  )
}

// ── OrgNodeRows ───────────────────────────────────────────────────────────────

function OrgNodeRows({
  unit, allUnits, roleTypes, orgUnitRoles, users, positions, onRefresh,
}: {
  unit: OrgUnit; allUnits: OrgUnit[]; roleTypes: RoleType[]; orgUnitRoles: OrgUnitRole[]
  users: AppUser[]; positions: UserPosition[]; onRefresh: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editCode, setEditCode] = useState(unit.code ?? '')
  const [editName, setEditName] = useState(unit.name)
  const [isAddingChild, setIsAddingChild] = useState(false)
  const [childCode, setChildCode] = useState('')
  const [childName, setChildName] = useState('')
  const [isAddingRole, setIsAddingRole] = useState(false)
  const [selectedRoleTypeId, setSelectedRoleTypeId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const indent = LEVEL_INDENT[unit.level]
  const childLevel = CHILD_LEVEL[unit.level]
  const children = childLevel
    ? allUnits.filter(u => u.level === childLevel && u.parent_id === unit.id).sort((a, b) => a.sort_order - b.sort_order)
    : []
  const unitRoles = orgUnitRoles.filter(r => r.org_unit_id === unit.id).sort((a, b) => a.sort_order - b.sort_order)
  const applicableRoleTypes = roleTypes.filter(r => r.level === unit.level)
  const usedRoleTypeIds = new Set(unitRoles.map(r => r.role_type_id))
  const availableRoleTypes = applicableRoleTypes.filter(r => !usedRoleTypeIds.has(r.id))

  async function handleEditSave() {
    if (!editName.trim()) return
    setError(null)
    const err = await updateOrgUnit(unit.id, editCode.trim() || null, editName.trim())
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
    if (!childName.trim() || !childLevel) return
    setError(null)
    const maxOrder = allUnits.filter(u => u.level === childLevel && u.parent_id === unit.id).reduce((m, u) => Math.max(m, u.sort_order), -1)
    const err = await insertOrgUnit({ code: childCode.trim() || null, name: childName.trim(), level: childLevel, parentId: unit.id, sortOrder: maxOrder + 1 })
    if (err) { setError(err); return }
    setChildCode(''); setChildName(''); setIsAddingChild(false); onRefresh()
  }

  async function handleAddRole() {
    if (!selectedRoleTypeId) return
    setError(null)
    const maxOrder = orgUnitRoles.filter(r => r.org_unit_id === unit.id).reduce((m, r) => Math.max(m, r.sort_order), -1)
    const err = await addOrgUnitRole(unit.id, Number(selectedRoleTypeId), maxOrder + 1)
    if (err) { setError(err); return }
    setSelectedRoleTypeId(''); setIsAddingRole(false); onRefresh()
  }

  async function handleDeleteRole(roleId: number) {
    if (!confirm('確定刪除此職位？已指派的人員也會一併移除。')) return
    setError(null)
    const err = await deleteOrgUnitRole(roleId)
    if (err) { setError(err); return }
    onRefresh()
  }

  return (
    <>
      <tr>
        <td
          colSpan={2}
          className={`border-t border-border px-4 py-2 ${unit.level === '處' ? 'bg-muted/30 pt-3' : ''}`}
          style={{ paddingLeft: indent + 12 }}
        >
          {isEditing ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{unit.level}</span>
              <Input value={editCode} onChange={e => setEditCode(e.target.value)} placeholder="編號（選填）" className="h-7 w-24 text-sm" />
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="名稱" className="h-7 w-40 text-sm" onKeyDown={e => { if (e.key === 'Enter') handleEditSave() }} autoFocus />
              <button onClick={handleEditSave} className={btnSave}>保存</button>
              <button onClick={() => { setIsEditing(false); setEditCode(unit.code ?? ''); setEditName(unit.name) }} className={btnCancel}>取消</button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className={`text-foreground ${LEVEL_FONT_SIZE[unit.level]} ${LEVEL_WEIGHT[unit.level]}`}>
                <span className="mr-1.5 text-xs font-normal text-muted-foreground">{unit.level}</span>
                {[unit.code, unit.name].filter(Boolean).join(' ')}
              </span>
              <div className="flex items-center gap-1.5">
                {childLevel && !isAddingChild && (
                  <button onClick={() => setIsAddingChild(true)} className={btnDashed}>+ 新增{childLevel}</button>
                )}
                <button onClick={() => setIsEditing(true)} className={btnCancel}>編輯</button>
                <button onClick={handleDelete} className={btnDelete}>刪除</button>
              </div>
            </div>
          )}
          {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
        </td>
      </tr>

      {unitRoles.map(role => (
        <RoleRow
          key={role.id}
          role={role} unit={unit} roleTypes={roleTypes} users={users}
          positions={positions} indent={indent}
          onRefresh={onRefresh}
          onDelete={() => handleDeleteRole(role.id)}
        />
      ))}

      {applicableRoleTypes.length > 0 && (
        <tr>
          <td style={{ paddingLeft: indent + 28 }} className="py-1.5 pr-3">
            {isAddingRole ? (
              <div className="flex items-center gap-2">
                <select value={selectedRoleTypeId} onChange={e => setSelectedRoleTypeId(e.target.value)} autoFocus className={selectCls}>
                  <option value="">選擇職稱</option>
                  {availableRoleTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                </select>
                <button onClick={handleAddRole} disabled={!selectedRoleTypeId} className={btnSave}>新增</button>
                <button onClick={() => { setIsAddingRole(false); setSelectedRoleTypeId('') }} className={btnCancel}>取消</button>
              </div>
            ) : availableRoleTypes.length > 0 ? (
              <button onClick={() => setIsAddingRole(true)} className={btnDashed}>+ 新增職位</button>
            ) : null}
          </td>
          <td />
        </tr>
      )}

      {children.map(child => (
        <OrgNodeRows key={child.id} unit={child} allUnits={allUnits} roleTypes={roleTypes} orgUnitRoles={orgUnitRoles} users={users} positions={positions} onRefresh={onRefresh} />
      ))}

      {isAddingChild && childLevel && (
        <tr>
          <td colSpan={2} className="border-t border-dashed border-border px-4 py-2" style={{ paddingLeft: LEVEL_INDENT[childLevel] + 12 }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{childLevel}</span>
              <Input value={childCode} onChange={e => setChildCode(e.target.value)} placeholder="編號（如第8課）" className="h-7 w-28 text-sm" />
              <Input value={childName} onChange={e => setChildName(e.target.value)} placeholder="名稱（如支出課）" className="h-7 w-40 text-sm" onKeyDown={e => { if (e.key === 'Enter') handleAddChild() }} autoFocus />
              <button onClick={handleAddChild} className={btnSave}>新增</button>
              <button onClick={() => { setIsAddingChild(false); setChildCode(''); setChildName('') }} className={btnCancel}>取消</button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── DeptBlock ─────────────────────────────────────────────────────────────────

function DeptBlock({
  unit, allUnits, roleTypes, orgUnitRoles, users, positions, onRefresh,
  isCollapsed, onToggle, isDragging, isDragOver,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  unit: OrgUnit; allUnits: OrgUnit[]; roleTypes: RoleType[]; orgUnitRoles: OrgUnitRole[]
  users: AppUser[]; positions: UserPosition[]; onRefresh: () => void
  isCollapsed: boolean; onToggle: () => void
  isDragging: boolean; isDragOver: boolean
  onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: () => void; onDragEnd: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(unit.name)
  const [isAddingChild, setIsAddingChild] = useState(false)
  const [childCode, setChildCode] = useState('')
  const [childName, setChildName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const children = allUnits.filter(u => u.level === '處' && u.parent_id === unit.id).sort((a, b) => a.sort_order - b.sort_order)

  async function handleEditSave() {
    if (!editName.trim()) return
    setError(null)
    const err = await updateOrgUnit(unit.id, null, editName.trim())
    if (err) { setError(err); return }
    setIsEditing(false); onRefresh()
  }

  async function handleDelete() {
    if (!confirm(`確定刪除「${unit.name}」？若有子處將無法刪除。`)) return
    setError(null)
    const err = await deleteOrgUnit(unit.id)
    if (err) { setError(err); return }
    onRefresh()
  }

  async function handleAddChild() {
    if (!childName.trim()) return
    setError(null)
    const maxOrder = allUnits.filter(u => u.level === '處' && u.parent_id === unit.id).reduce((m, u) => Math.max(m, u.sort_order), -1)
    const err = await insertOrgUnit({ code: childCode.trim() || null, name: childName.trim(), level: '處', parentId: unit.id, sortOrder: maxOrder + 1 })
    if (err) { setError(err); return }
    setChildCode(''); setChildName(''); setIsAddingChild(false); onRefresh()
  }

  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart() }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); onDragOver(e) }}
      onDrop={e => { e.stopPropagation(); onDrop() }}
      onDragEnd={e => { e.stopPropagation(); onDragEnd() }}
      className={`mb-2 overflow-hidden rounded-lg border-2 bg-card transition-all ${isDragOver ? 'border-primary' : 'border-border'} ${isDragging ? 'opacity-45' : 'opacity-100'}`}
    >
      {/* 部門 header */}
      <div
        onClick={isEditing ? undefined : onToggle}
        className={`flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3 ${isEditing ? 'cursor-default' : 'cursor-pointer select-none'} ${isCollapsed ? 'rounded-b-lg border-b-0' : ''}`}
      >
        {isEditing ? (
          <div onClick={e => e.stopPropagation()} className="flex flex-1 flex-wrap items-center gap-2">
            <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="部門名稱" className="h-7 w-44 text-sm" onKeyDown={e => { if (e.key === 'Enter') handleEditSave() }} autoFocus />
            <button onClick={handleEditSave} className={btnSave}>保存</button>
            <button onClick={() => { setIsEditing(false); setEditName(unit.name) }} className={btnCancel}>取消</button>
            {error && <span className="text-xs text-destructive">{error}</span>}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <span className="cursor-grab text-base leading-none text-muted-foreground/40" title="拖曳排序">⠿</span>
              <span className="text-xs text-muted-foreground">{isCollapsed ? '▸' : '▾'}</span>
              <span className="text-base font-bold text-foreground">
                <span className="mr-1.5 text-xs font-normal text-muted-foreground">部門</span>
                {unit.name}
              </span>
            </div>
            <div onClick={e => e.stopPropagation()} className="flex items-center gap-1.5">
              {!isAddingChild && (
                <button onClick={() => { if (isCollapsed) onToggle(); setIsAddingChild(true) }} className={btnDashed}>+ 新增處</button>
              )}
              <button onClick={() => setIsEditing(true)} className={btnCancel}>編輯</button>
              <button onClick={handleDelete} className={btnDelete}>刪除</button>
            </div>
          </>
        )}
      </div>

      {!isCollapsed && (
        <>
          {children.length > 0 || isAddingChild ? (
            <table className="w-full border-collapse text-sm">
              <tbody>
                {children.map(child => (
                  <OrgNodeRows key={child.id} unit={child} allUnits={allUnits} roleTypes={roleTypes} orgUnitRoles={orgUnitRoles} users={users} positions={positions} onRefresh={onRefresh} />
                ))}
                {isAddingChild && (
                  <tr>
                    <td colSpan={2} className="border-t border-dashed border-border px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">處</span>
                        <Input value={childCode} onChange={e => setChildCode(e.target.value)} placeholder="編號（選填）" className="h-7 w-28 text-sm" />
                        <Input value={childName} onChange={e => setChildName(e.target.value)} placeholder="名稱（如行政處）" className="h-7 w-40 text-sm" onKeyDown={e => { if (e.key === 'Enter') handleAddChild() }} autoFocus />
                        <button onClick={handleAddChild} className={btnSave}>新增</button>
                        <button onClick={() => { setIsAddingChild(false); setChildCode(''); setChildName('') }} className={btnCancel}>取消</button>
                        {error && <span className="text-xs text-destructive">{error}</span>}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-2.5 text-sm text-muted-foreground">
              尚無子處，點上方「+ 新增處」新增。
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── RoleTypesPanel ────────────────────────────────────────────────────────────

function RoleTypeRow({ r, onRefresh, onError }: { r: RoleType; onRefresh: () => void; onError: (msg: string) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editLevel, setEditLevel] = useState<RoleLevel>(r.level)
  const [editName, setEditName] = useState(r.name)

  async function handleSave() {
    if (!editName.trim()) return
    const err = await updateRoleType(r.id, editLevel, editName.trim())
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
          <select value={editLevel} onChange={e => setEditLevel(e.target.value as RoleLevel)} className={selectCls}>
            {ROLE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </TableCell>
        <TableCell>
          <Input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSave() }} className="h-7 w-36 text-sm" autoFocus />
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <button onClick={handleSave} className={`${btnSave} mr-1`}>保存</button>
          <button onClick={() => { setIsEditing(false); setEditLevel(r.level); setEditName(r.name) }} className={btnCancel}>取消</button>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow>
      <TableCell className="text-sm">{r.level}</TableCell>
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
  const [level, setLevel] = useState<RoleLevel>('課')
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!name.trim()) return
    setError(null)
    const maxOrder = roleTypes.filter(r => r.level === level).reduce((m, r) => Math.max(m, r.sort_order), -1)
    const err = await addRoleType(name.trim(), level, maxOrder + 1)
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
        管理各層級可用的職稱（如課長、處長），新增後才能在上方樹狀圖中選用。
      </p>

      {expanded && (
        <CardContent className="flex flex-col gap-4 pt-0">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>適用層級</TableHead>
                <TableHead>職稱名稱</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roleTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-sm text-muted-foreground">尚無職稱</TableCell>
                </TableRow>
              ) : roleTypes.map(r => (
                <RoleTypeRow key={r.id} r={r} onRefresh={onRefresh} onError={setError} />
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center gap-2">
            <select value={level} onChange={e => setLevel(e.target.value as RoleLevel)} className={selectCls}>
              {ROLE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrgStructurePage() {
  const [units, setUnits] = useState<OrgUnit[]>([])
  const [roleTypes, setRoleTypes] = useState<RoleType[]>([])
  const [orgUnitRoles, setOrgUnitRoles] = useState<OrgUnitRole[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [positions, setPositions] = useState<UserPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddingDept, setIsAddingDept] = useState(false)
  const [deptName, setDeptName] = useState('')
  const [addDeptError, setAddDeptError] = useState<string | null>(null)
  const [collapsedDepts, setCollapsedDepts] = useState<Set<number>>(new Set())
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)

  async function loadAll() {
    setError(null)
    const [uRes, rRes, orRes, usersRes, posRes] = await Promise.all([
      supabase.from('org_units').select('*').order('sort_order'),
      supabase.from('role_types').select('*').order('level').order('sort_order'),
      supabase.from('org_unit_roles').select('*').order('org_unit_id').order('sort_order'),
      supabase.from('app_users').select('id, name, email, created_at, updated_at').order('id'),
      supabase.from('user_positions').select('*'),
    ])
    if (uRes.error) { setError(uRes.error.message); return }
    if (rRes.error) { setError(rRes.error.message); return }
    if (orRes.error) { setError(orRes.error.message); return }
    if (usersRes.error) { setError(usersRes.error.message); return }
    if (posRes.error) { setError(posRes.error.message); return }
    setUnits((uRes.data as OrgUnit[]) ?? [])
    setRoleTypes((rRes.data as RoleType[]) ?? [])
    setOrgUnitRoles((orRes.data as OrgUnitRole[]) ?? [])
    setUsers((usersRes.data as AppUser[]) ?? [])
    setPositions((posRes.data as UserPosition[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  function toggleCollapse(id: number) {
    setCollapsedDepts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleDrop(targetId: number) {
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return }
    const fromIdx = topUnits.findIndex(u => u.id === draggedId)
    const toIdx = topUnits.findIndex(u => u.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const reordered = [...topUnits]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    await reorderOrgUnits(reordered.map((u, i) => ({ id: u.id, sortOrder: i })))
    setDraggedId(null); setDragOverId(null)
    loadAll()
  }

  async function handleAddDept() {
    if (!deptName.trim()) return
    setAddDeptError(null)
    const maxOrder = units.filter(u => u.level === '部門').reduce((m, u) => Math.max(m, u.sort_order), -1)
    const err = await insertOrgUnit({ code: null, name: deptName.trim(), level: '部門', parentId: null, sortOrder: maxOrder + 1 })
    if (err) { setAddDeptError(err); return }
    setDeptName(''); setIsAddingDept(false); loadAll()
  }

  if (loading) return <p className="text-muted-foreground">載入中...</p>

  const topUnits = units.filter(u => u.level === '部門' && u.parent_id === null).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader
          title="組織架構與職位設定"
          action={!isAddingDept ? <Button onClick={() => setIsAddingDept(true)}>+ 新增部門</Button> : undefined}
        />
        <p className="mt-1 text-sm text-muted-foreground">管理部門、處、課等組織節點，設定各職位，並指派對應的使用者。</p>
      </div>

      {isAddingDept && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-muted/50 px-4 py-3">
          <span className="text-sm text-muted-foreground">新增部門：</span>
          <Input value={deptName} onChange={e => setDeptName(e.target.value)} placeholder="如：第三部門" className="w-48" onKeyDown={e => { if (e.key === 'Enter') handleAddDept() }} autoFocus />
          <button onClick={handleAddDept} className={btnSave}>新增</button>
          <button onClick={() => { setIsAddingDept(false); setDeptName('') }} className={btnCancel}>取消</button>
          {addDeptError && <span className="text-xs text-destructive">{addDeptError}</span>}
        </div>
      )}

      {error && <p className="text-sm text-destructive">錯誤：{error}</p>}

      {topUnits.length === 0 ? (
        <p className="text-sm text-muted-foreground">尚無組織架構資料，請點右上角「新增部門」開始建立。</p>
      ) : (
        <div>
          {topUnits.map(unit => (
            <DeptBlock
              key={unit.id}
              unit={unit} allUnits={units} roleTypes={roleTypes} orgUnitRoles={orgUnitRoles}
              users={users} positions={positions} onRefresh={loadAll}
              isCollapsed={collapsedDepts.has(unit.id)}
              onToggle={() => toggleCollapse(unit.id)}
              isDragging={draggedId === unit.id}
              isDragOver={dragOverId === unit.id}
              onDragStart={() => setDraggedId(unit.id)}
              onDragOver={e => { e.preventDefault(); setDragOverId(unit.id) }}
              onDrop={() => handleDrop(unit.id)}
              onDragEnd={() => { setDraggedId(null); setDragOverId(null) }}
            />
          ))}
        </div>
      )}

      <RoleTypesPanel roleTypes={roleTypes} onRefresh={loadAll} />
    </div>
  )
}
