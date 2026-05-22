'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { OrgUnit, OrgLevel, RoleType, RoleLevel, OrgUnitRole, AppUser, UserPosition } from '@/lib/types'
import { Button } from '@/components/ui/button'

const LEVEL_INDENT: Record<OrgLevel, number> = { '部門': 0, '處': 0, '課': 16, '科': 32 }
const LEVEL_FONT_SIZE: Record<OrgLevel, number> = { '部門': 15, '處': 14, '課': 13, '科': 13 }
const LEVEL_WEIGHT: Record<OrgLevel, number> = { '部門': 700, '處': 600, '課': 500, '科': 500 }
const CHILD_LEVEL: Partial<Record<OrgLevel, OrgLevel>> = { '部門': '處', '處': '課', '課': '科' }
const ROLE_LEVELS: RoleLevel[] = ['處', '課', '科']

function buildDisplayName(unit: OrgUnit, roleType: RoleType): string {
  const prefix = [unit.code, unit.name].filter(Boolean).join(' ')
  return `${prefix} ${roleType.name}`
}

// ── RoleRow ───────────────────────────────────────────────────────────────────

function RoleRow({
  role, unit, roleTypes, users, positions, indent, onRefresh, onDelete,
}: {
  role: OrgUnitRole
  unit: OrgUnit
  roleTypes: RoleType[]
  users: AppUser[]
  positions: UserPosition[]
  indent: number
  onRefresh: () => void
  onDelete: () => void
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
    const { error: e } = await supabase.from('user_positions').insert({
      user_id: Number(selectedUserId),
      org_unit_role_id: role.id,
      is_primary: true,
    })
    if (e) { setError(e.message); return }
    setAdding(false)
    setSelectedUserId('')
    onRefresh()
  }

  async function handleRemove(positionId: number) {
    if (!confirm('確定移除此職位指派？')) return
    const { error: e } = await supabase.from('user_positions').delete().eq('id', positionId)
    if (e) { setError(e.message); return }
    onRefresh()
  }

  return (
    <tr>
      <td style={{
        paddingLeft: indent + 28,
        paddingTop: 5, paddingBottom: 5, paddingRight: 12,
        fontSize: 13, color: 'var(--text-body)', whiteSpace: 'nowrap',
        verticalAlign: 'middle', width: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>{displayName}</span>
          <button
            onClick={onDelete}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 11, padding: 0, flexShrink: 0 }}
          >刪除</button>
        </div>
      </td>
      <td style={{ padding: '5px 12px', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {assignedPositions.map(pos => {
            const user = users.find(u => u.id === pos.user_id)
            return (
              <span key={pos.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: '#dbeafe', color: '#1e40af',
                borderRadius: 999, padding: '2px 10px 2px 12px', fontSize: 13,
              }}>
                {user?.name ?? `用戶 #${pos.user_id}`}
                <button
                  onClick={() => handleRemove(pos.id)}
                  title="移除"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#93c5fd', fontSize: 16, padding: '0 0 0 2px',
                    lineHeight: 1, display: 'flex', alignItems: 'center',
                  }}
                >×</button>
              </span>
            )
          })}

          {adding ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                autoFocus
                style={{ fontSize: 13, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--btn-border)' }}
              >
                <option value="">選擇使用者</option>
                {availableUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}（{u.email}）</option>
                ))}
              </select>
              <button
                onClick={handleAdd}
                disabled={!selectedUserId}
                style={{
                  fontSize: 12, padding: '3px 10px',
                  cursor: selectedUserId ? 'pointer' : 'not-allowed',
                  background: selectedUserId ? '#111827' : '#9ca3af',
                  color: '#fff', border: 'none', borderRadius: 4,
                }}
              >確認</button>
              <button
                onClick={() => { setAdding(false); setSelectedUserId('') }}
                style={{
                  fontSize: 12, padding: '3px 10px', cursor: 'pointer',
                  background: 'none', border: '1px solid var(--btn-border)', borderRadius: 4, color: 'var(--text-body)',
                }}
              >取消</button>
            </span>
          ) : availableUsers.length > 0 ? (
            <button
              onClick={() => setAdding(true)}
              style={{
                fontSize: 12, padding: '3px 10px', cursor: 'pointer',
                background: 'none', border: '1px dashed #9ca3af',
                borderRadius: 4, color: 'var(--text-muted)',
              }}
            >＋ 新增</button>
          ) : assignedPositions.length === 0 ? (
            <span style={{ fontSize: 12, color: '#d1d5db' }}>（未指派）</span>
          ) : null}

          {error && <span style={{ color: '#dc2626', fontSize: 12 }}>{error}</span>}
        </div>
      </td>
    </tr>
  )
}

// ── OrgNodeRows（處、課、科 層級）────────────────────────────────────────────

function OrgNodeRows({
  unit, allUnits, roleTypes, orgUnitRoles, users, positions, onRefresh,
}: {
  unit: OrgUnit
  allUnits: OrgUnit[]
  roleTypes: RoleType[]
  orgUnitRoles: OrgUnitRole[]
  users: AppUser[]
  positions: UserPosition[]
  onRefresh: () => void
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
    const { error: e } = await supabase.from('org_units').update({
      code: editCode.trim() || null,
      name: editName.trim(),
    }).eq('id', unit.id)
    if (e) { setError(e.message); return }
    setIsEditing(false)
    onRefresh()
  }

  async function handleDelete() {
    if (!confirm(`確定刪除「${unit.name}」？若有子節點或職位將無法刪除。`)) return
    setError(null)
    const { error: e } = await supabase.from('org_units').delete().eq('id', unit.id)
    if (e) { setError(e.message); return }
    onRefresh()
  }

  async function handleAddChild() {
    if (!childName.trim() || !childLevel) return
    setError(null)
    const maxOrder = allUnits
      .filter(u => u.level === childLevel && u.parent_id === unit.id)
      .reduce((m, u) => Math.max(m, u.sort_order), -1)
    const { error: e } = await supabase.from('org_units').insert({
      code: childCode.trim() || null,
      name: childName.trim(),
      level: childLevel,
      parent_id: unit.id,
      sort_order: maxOrder + 1,
    })
    if (e) { setError(e.message); return }
    setChildCode(''); setChildName(''); setIsAddingChild(false)
    onRefresh()
  }

  async function handleAddRole() {
    if (!selectedRoleTypeId) return
    setError(null)
    const maxOrder = orgUnitRoles
      .filter(r => r.org_unit_id === unit.id)
      .reduce((m, r) => Math.max(m, r.sort_order), -1)
    const { error: e } = await supabase.from('org_unit_roles').insert({
      org_unit_id: unit.id,
      role_type_id: Number(selectedRoleTypeId),
      display_name: null,
      sort_order: maxOrder + 1,
    })
    if (e) { setError(e.message); return }
    setSelectedRoleTypeId(''); setIsAddingRole(false)
    onRefresh()
  }

  async function handleDeleteRole(roleId: number) {
    if (!confirm('確定刪除此職位？已指派的人員也會一併移除。')) return
    setError(null)
    const { error: posErr } = await supabase.from('user_positions').delete().eq('org_unit_role_id', roleId)
    if (posErr) { setError(posErr.message); return }
    const { error: e } = await supabase.from('org_unit_roles').delete().eq('id', roleId)
    if (e) { setError(e.message); return }
    onRefresh()
  }

  return (
    <>
      <tr>
        <td
          colSpan={2}
          style={{
            paddingTop: unit.level === '處' ? 12 : 8,
            paddingBottom: 6,
            paddingLeft: indent + 12,
            paddingRight: 16,
            borderTop: unit.level === '處' ? '1px solid var(--border-color)' : '1px solid var(--border-color)',
            background: unit.level === '處' ? '#fafafa' : 'transparent',
          }}
        >
          {isEditing ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{unit.level}</span>
              <input
                value={editCode}
                onChange={e => setEditCode(e.target.value)}
                placeholder="編號（選填）"
                style={{ width: 100, fontSize: 13, padding: '3px 6px', border: '1px solid var(--btn-border)', borderRadius: 4 }}
              />
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="名稱"
                style={{ width: 160, fontSize: 13, padding: '3px 6px', border: '1px solid var(--btn-border)', borderRadius: 4 }}
                onKeyDown={e => { if (e.key === 'Enter') handleEditSave() }}
                autoFocus
              />
              <button onClick={handleEditSave} style={{ fontSize: 12, padding: '3px 10px', cursor: 'pointer', background: '#111827', color: '#fff', border: 'none', borderRadius: 4 }}>保存</button>
              <button onClick={() => { setIsEditing(false); setEditCode(unit.code ?? ''); setEditName(unit.name) }} style={{ fontSize: 12, padding: '3px 10px', cursor: 'pointer', background: 'none', border: '1px solid var(--btn-border)', borderRadius: 4, color: 'var(--text-body)' }}>取消</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: LEVEL_WEIGHT[unit.level], fontSize: LEVEL_FONT_SIZE[unit.level], color: 'var(--text-title)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-subtle)', marginRight: 6, fontWeight: 400 }}>{unit.level}</span>
                {[unit.code, unit.name].filter(Boolean).join(' ')}
              </span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {childLevel && !isAddingChild && (
                  <button onClick={() => setIsAddingChild(true)} style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', background: 'none', border: '1px dashed #9ca3af', borderRadius: 4, color: 'var(--text-muted)' }}>+ 新增{childLevel}</button>
                )}
                <button onClick={() => setIsEditing(true)} style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', background: 'none', border: '1px solid var(--btn-border)', borderRadius: 4, color: 'var(--text-body)' }}>編輯</button>
                <button onClick={handleDelete} style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', background: 'none', border: 'none', color: '#dc2626' }}>刪除</button>
              </div>
            </div>
          )}
          {error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{error}</div>}
        </td>
      </tr>

      {unitRoles.map(role => (
        <RoleRow
          key={role.id}
          role={role}
          unit={unit}
          roleTypes={roleTypes}
          users={users}
          positions={positions}
          indent={indent}
          onRefresh={onRefresh}
          onDelete={() => handleDeleteRole(role.id)}
        />
      ))}

      {applicableRoleTypes.length > 0 && (
        <tr>
          <td style={{ paddingLeft: indent + 28, paddingTop: 3, paddingBottom: 6, paddingRight: 12 }}>
            {isAddingRole ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={selectedRoleTypeId}
                  onChange={e => setSelectedRoleTypeId(e.target.value)}
                  autoFocus
                  style={{ fontSize: 13, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--btn-border)' }}
                >
                  <option value="">選擇職稱</option>
                  {availableRoleTypes.map(rt => (
                    <option key={rt.id} value={rt.id}>{rt.name}</option>
                  ))}
                </select>
                <button onClick={handleAddRole} disabled={!selectedRoleTypeId} style={{ fontSize: 12, padding: '3px 10px', cursor: selectedRoleTypeId ? 'pointer' : 'not-allowed', background: selectedRoleTypeId ? '#111827' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 4 }}>新增</button>
                <button onClick={() => { setIsAddingRole(false); setSelectedRoleTypeId('') }} style={{ fontSize: 12, padding: '3px 10px', cursor: 'pointer', background: 'none', border: '1px solid var(--btn-border)', borderRadius: 4, color: 'var(--text-body)' }}>取消</button>
              </div>
            ) : availableRoleTypes.length > 0 ? (
              <button onClick={() => setIsAddingRole(true)} style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', background: 'none', border: '1px dashed #9ca3af', borderRadius: 4, color: 'var(--text-muted)' }}>+ 新增職位</button>
            ) : null}
          </td>
          <td />
        </tr>
      )}

      {children.map(child => (
        <OrgNodeRows
          key={child.id}
          unit={child}
          allUnits={allUnits}
          roleTypes={roleTypes}
          orgUnitRoles={orgUnitRoles}
          users={users}
          positions={positions}
          onRefresh={onRefresh}
        />
      ))}

      {isAddingChild && childLevel && (
        <tr>
          <td colSpan={2} style={{ paddingLeft: LEVEL_INDENT[childLevel] + 12, paddingTop: 6, paddingBottom: 8, paddingRight: 16, borderTop: '1px dashed #e5e7eb' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{childLevel}</span>
              <input value={childCode} onChange={e => setChildCode(e.target.value)} placeholder="編號（如第8課）" style={{ width: 120, fontSize: 13, padding: '3px 6px', border: '1px solid var(--btn-border)', borderRadius: 4 }} />
              <input value={childName} onChange={e => setChildName(e.target.value)} placeholder="名稱（如支出課）" style={{ width: 160, fontSize: 13, padding: '3px 6px', border: '1px solid var(--btn-border)', borderRadius: 4 }} onKeyDown={e => { if (e.key === 'Enter') handleAddChild() }} autoFocus />
              <button onClick={handleAddChild} style={{ fontSize: 12, padding: '3px 10px', cursor: 'pointer', background: '#111827', color: '#fff', border: 'none', borderRadius: 4 }}>新增</button>
              <button onClick={() => { setIsAddingChild(false); setChildCode(''); setChildName('') }} style={{ fontSize: 12, padding: '3px 10px', cursor: 'pointer', background: 'none', border: '1px solid var(--btn-border)', borderRadius: 4, color: 'var(--text-body)' }}>取消</button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── DeptBlock（部門層級，含拖曳與展開收合）────────────────────────────────────

function DeptBlock({
  unit, allUnits, roleTypes, orgUnitRoles, users, positions, onRefresh,
  isCollapsed, onToggle,
  isDragging, isDragOver,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  unit: OrgUnit
  allUnits: OrgUnit[]
  roleTypes: RoleType[]
  orgUnitRoles: OrgUnitRole[]
  users: AppUser[]
  positions: UserPosition[]
  onRefresh: () => void
  isCollapsed: boolean
  onToggle: () => void
  isDragging: boolean
  isDragOver: boolean
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(unit.name)
  const [isAddingChild, setIsAddingChild] = useState(false)
  const [childCode, setChildCode] = useState('')
  const [childName, setChildName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const children = allUnits
    .filter(u => u.level === '處' && u.parent_id === unit.id)
    .sort((a, b) => a.sort_order - b.sort_order)

  async function handleEditSave() {
    if (!editName.trim()) return
    setError(null)
    const { error: e } = await supabase.from('org_units').update({ name: editName.trim() }).eq('id', unit.id)
    if (e) { setError(e.message); return }
    setIsEditing(false)
    onRefresh()
  }

  async function handleDelete() {
    if (!confirm(`確定刪除「${unit.name}」？若有子處將無法刪除。`)) return
    setError(null)
    const { error: e } = await supabase.from('org_units').delete().eq('id', unit.id)
    if (e) { setError(e.message); return }
    onRefresh()
  }

  async function handleAddChild() {
    if (!childName.trim()) return
    setError(null)
    const maxOrder = allUnits
      .filter(u => u.level === '處' && u.parent_id === unit.id)
      .reduce((m, u) => Math.max(m, u.sort_order), -1)
    const { error: e } = await supabase.from('org_units').insert({
      code: childCode.trim() || null,
      name: childName.trim(),
      level: '處',
      parent_id: unit.id,
      sort_order: maxOrder + 1,
    })
    if (e) { setError(e.message); return }
    setChildCode(''); setChildName(''); setIsAddingChild(false)
    onRefresh()
  }

  const headerRadius = isCollapsed ? 8 : '8px 8px 0 0'

  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart() }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); onDragOver(e) }}
      onDrop={e => { e.stopPropagation(); onDrop() }}
      onDragEnd={e => { e.stopPropagation(); onDragEnd() }}
      style={{
        marginBottom: 8,
        border: `2px solid ${isDragOver ? '#3b82f6' : '#e5e7eb'}`,
        borderRadius: 8,
        background: 'var(--bg-card)',
        opacity: isDragging ? 0.45 : 1,
        transition: 'border-color 0.12s, opacity 0.12s',
      }}
    >
      {/* 部門 header */}
      <div
        onClick={isEditing ? undefined : onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--bg-sidebar)',
          borderRadius: headerRadius,
          borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
          cursor: isEditing ? 'default' : 'pointer',
          userSelect: 'none',
        }}
      >
        {isEditing ? (
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="部門名稱"
              style={{ width: 180, fontSize: 14, padding: '3px 6px', border: '1px solid var(--btn-border)', borderRadius: 4 }}
              onKeyDown={e => { if (e.key === 'Enter') handleEditSave() }}
              autoFocus
            />
            <button onClick={handleEditSave} style={{ fontSize: 12, padding: '3px 10px', cursor: 'pointer', background: '#111827', color: '#fff', border: 'none', borderRadius: 4 }}>保存</button>
            <button onClick={() => { setIsEditing(false); setEditName(unit.name) }} style={{ fontSize: 12, padding: '3px 10px', cursor: 'pointer', background: 'none', border: '1px solid var(--btn-border)', borderRadius: 4, color: 'var(--text-body)' }}>取消</button>
            {error && <span style={{ color: '#dc2626', fontSize: 12 }}>{error}</span>}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#d1d5db', fontSize: 16, cursor: 'grab', lineHeight: 1 }} title="拖曳排序">⠿</span>
              <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{isCollapsed ? '▸' : '▾'}</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-title)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-subtle)', marginRight: 6, fontWeight: 400 }}>部門</span>
                {unit.name}
              </span>
            </div>
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {!isAddingChild && (
                <button
                  onClick={() => { if (isCollapsed) onToggle(); setIsAddingChild(true) }}
                  style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', background: 'none', border: '1px dashed #9ca3af', borderRadius: 4, color: 'var(--text-muted)' }}
                >+ 新增處</button>
              )}
              <button onClick={() => setIsEditing(true)} style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', background: 'none', border: '1px solid var(--btn-border)', borderRadius: 4, color: 'var(--text-body)' }}>編輯</button>
              <button onClick={handleDelete} style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', background: 'none', border: 'none', color: '#dc2626' }}>刪除</button>
            </div>
          </>
        )}
      </div>

      {/* 展開內容 */}
      {!isCollapsed && (
        <>
          {children.length > 0 || isAddingChild ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {children.map(child => (
                  <OrgNodeRows
                    key={child.id}
                    unit={child}
                    allUnits={allUnits}
                    roleTypes={roleTypes}
                    orgUnitRoles={orgUnitRoles}
                    users={users}
                    positions={positions}
                    onRefresh={onRefresh}
                  />
                ))}
                {isAddingChild && (
                  <tr>
                    <td colSpan={2} style={{ paddingLeft: 12, paddingTop: 8, paddingBottom: 10, paddingRight: 16, borderTop: '1px dashed #e5e7eb' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>處</span>
                        <input value={childCode} onChange={e => setChildCode(e.target.value)} placeholder="編號（選填）" style={{ width: 120, fontSize: 13, padding: '3px 6px', border: '1px solid var(--btn-border)', borderRadius: 4 }} />
                        <input value={childName} onChange={e => setChildName(e.target.value)} placeholder="名稱（如行政處）" style={{ width: 160, fontSize: 13, padding: '3px 6px', border: '1px solid var(--btn-border)', borderRadius: 4 }} onKeyDown={e => { if (e.key === 'Enter') handleAddChild() }} autoFocus />
                        <button onClick={handleAddChild} style={{ fontSize: 12, padding: '3px 10px', cursor: 'pointer', background: '#111827', color: '#fff', border: 'none', borderRadius: 4 }}>新增</button>
                        <button onClick={() => { setIsAddingChild(false); setChildCode(''); setChildName('') }} style={{ fontSize: 12, padding: '3px 10px', cursor: 'pointer', background: 'none', border: '1px solid var(--btn-border)', borderRadius: 4, color: 'var(--text-body)' }}>取消</button>
                        {error && <span style={{ color: '#dc2626', fontSize: 12 }}>{error}</span>}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '10px 16px', color: 'var(--text-subtle)', fontSize: 13 }}>
              尚無子處，點上方「+ 新增處」新增。
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── RoleTypesPanel ────────────────────────────────────────────────────────────

function RoleTypeRow({
  r, onRefresh, onError,
}: {
  r: RoleType
  onRefresh: () => void
  onError: (msg: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editLevel, setEditLevel] = useState<RoleLevel>(r.level)
  const [editName, setEditName] = useState(r.name)

  async function handleSave() {
    if (!editName.trim()) return
    const { error: e } = await supabase.from('role_types').update({
      level: editLevel, name: editName.trim(),
    }).eq('id', r.id)
    if (e) { onError(e.message); return }
    setIsEditing(false)
    onRefresh()
  }

  async function handleDelete() {
    if (!confirm('確定刪除此職稱？所有使用此職稱的職位與人員指派也會一併移除。')) return
    const { data: relatedRoles, error: fetchErr } = await supabase
      .from('org_unit_roles').select('id').eq('role_type_id', r.id)
    if (fetchErr) { onError(fetchErr.message); return }
    if (relatedRoles && relatedRoles.length > 0) {
      const roleIds = relatedRoles.map(x => x.id)
      const { error: posErr } = await supabase.from('user_positions').delete().in('org_unit_role_id', roleIds)
      if (posErr) { onError(posErr.message); return }
      const { error: roleErr } = await supabase.from('org_unit_roles').delete().eq('role_type_id', r.id)
      if (roleErr) { onError(roleErr.message); return }
    }
    const { error: e } = await supabase.from('role_types').delete().eq('id', r.id)
    if (e) { onError(e.message); return }
    onRefresh()
  }

  if (isEditing) {
    return (
      <tr style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
        <td style={{ padding: '6px 8px' }}>
          <select value={editLevel} onChange={e => setEditLevel(e.target.value as RoleLevel)} style={{ fontSize: 13, padding: '3px 6px', border: '1px solid var(--btn-border)', borderRadius: 4 }}>
            {ROLE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </td>
        <td style={{ padding: '6px 8px' }}>
          <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSave() }} style={{ fontSize: 13, padding: '3px 6px', border: '1px solid var(--btn-border)', borderRadius: 4, width: 140 }} autoFocus />
        </td>
        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
          <button onClick={handleSave} style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', background: '#111827', color: '#fff', border: 'none', borderRadius: 4, marginRight: 4 }}>保存</button>
          <button onClick={() => { setIsEditing(false); setEditLevel(r.level); setEditName(r.name) }} style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', background: 'none', border: '1px solid var(--btn-border)', borderRadius: 4, color: 'var(--text-body)' }}>取消</button>
        </td>
      </tr>
    )
  }

  return (
    <tr style={{ borderTop: '1px solid var(--border-color)' }}>
      <td style={{ padding: '6px 12px', fontSize: 13 }}>{r.level}</td>
      <td style={{ padding: '6px 12px', fontSize: 13 }}>{r.name}</td>
      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
        <button onClick={() => setIsEditing(true)} style={{ color: 'var(--text-body)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, marginRight: 8 }}>編輯</button>
        <button onClick={handleDelete} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>刪除</button>
      </td>
    </tr>
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
    const { error: e } = await supabase.from('role_types').insert({ name: name.trim(), level, sort_order: maxOrder + 1 })
    if (e) { setError(e.message); return }
    setName('')
    onRefresh()
  }

  return (
    <div style={{ marginTop: 32, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--text-body)', padding: 0 }}
      >
        <span style={{ fontSize: 11 }}>{expanded ? '▾' : '▸'}</span>
        職稱管理
      </button>
      <p style={{ fontSize: 13, color: 'var(--text-subtle)', margin: '4px 0 0 18px' }}>
        管理各層級可用的職稱（如課長、處長），新增後才能在上方樹狀圖中選用。
      </p>

      {expanded && (
        <div style={{ marginTop: 12, marginLeft: 18 }}>
          {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <table style={{ borderCollapse: 'collapse', minWidth: 320, marginBottom: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)' }}>
                <th style={{ textAlign: 'left', padding: '6px 12px', fontSize: 13, fontWeight: 600 }}>適用層級</th>
                <th style={{ textAlign: 'left', padding: '6px 12px', fontSize: 13, fontWeight: 600 }}>職稱名稱</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {roleTypes.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: '8px 12px', color: 'var(--text-subtle)', fontSize: 13 }}>尚無職稱</td></tr>
              ) : roleTypes.map(r => (
                <RoleTypeRow key={r.id} r={r} onRefresh={onRefresh} onError={setError} />
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={level} onChange={e => setLevel(e.target.value as RoleLevel)} style={{ fontSize: 13, padding: '4px 6px', border: '1px solid var(--btn-border)', borderRadius: 4 }}>
              {ROLE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }} placeholder="職稱名稱（如課長）" style={{ width: 180, fontSize: 13, padding: '4px 6px', border: '1px solid var(--btn-border)', borderRadius: 4 }} />
            <button onClick={handleAdd} style={{ fontSize: 13, padding: '4px 12px', cursor: 'pointer', background: '#111827', color: '#fff', border: 'none', borderRadius: 4 }}>新增</button>
          </div>
        </div>
      )}
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
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null); setDragOverId(null); return
    }
    const fromIdx = topUnits.findIndex(u => u.id === draggedId)
    const toIdx = topUnits.findIndex(u => u.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...topUnits]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    await Promise.all(
      reordered.map((u, i) => supabase.from('org_units').update({ sort_order: i }).eq('id', u.id))
    )
    setDraggedId(null); setDragOverId(null)
    loadAll()
  }

  async function handleAddDept() {
    if (!deptName.trim()) return
    setAddDeptError(null)
    const maxOrder = units.filter(u => u.level === '部門').reduce((m, u) => Math.max(m, u.sort_order), -1)
    const { error: e } = await supabase.from('org_units').insert({
      code: null, name: deptName.trim(), level: '部門', parent_id: null, sort_order: maxOrder + 1,
    })
    if (e) { setAddDeptError(e.message); return }
    setDeptName(''); setIsAddingDept(false)
    loadAll()
  }

  if (loading) return <p>載入中...</p>

  const topUnits = units
    .filter(u => u.level === '部門' && u.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order)

  const hasDepts = topUnits.length > 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>組織架構與職位設定</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>管理部門、處、課等組織節點，設定各職位，並指派對應的使用者。</p>
        </div>
        {!isAddingDept && (
          <Button onClick={() => setIsAddingDept(true)}>+ 新增部門</Button>
        )}
      </div>

      {isAddingDept && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, padding: '10px 14px', background: 'var(--bg-sidebar)', border: '1px dashed #d1d5db', borderRadius: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>新增部門：</span>
          <input value={deptName} onChange={e => setDeptName(e.target.value)} placeholder="如：第三部門" style={{ width: 200, fontSize: 13, padding: '4px 8px', border: '1px solid var(--btn-border)', borderRadius: 4 }} onKeyDown={e => { if (e.key === 'Enter') handleAddDept() }} autoFocus />
          <button onClick={handleAddDept} style={{ fontSize: 13, padding: '4px 12px', cursor: 'pointer', background: '#111827', color: '#fff', border: 'none', borderRadius: 4 }}>新增</button>
          <button onClick={() => { setIsAddingDept(false); setDeptName('') }} style={{ fontSize: 13, padding: '4px 12px', cursor: 'pointer', background: 'none', border: '1px solid var(--btn-border)', borderRadius: 4, color: 'var(--text-body)' }}>取消</button>
          {addDeptError && <span style={{ color: '#dc2626', fontSize: 12 }}>{addDeptError}</span>}
        </div>
      )}

      {error && <p style={{ color: '#dc2626', marginBottom: 16, fontSize: 14 }}>錯誤：{error}</p>}

      {!hasDepts ? (
        <p style={{ color: 'var(--text-subtle)', fontSize: 14 }}>尚無組織架構資料，請點右上角「新增部門」開始建立。</p>
      ) : (
        <div>
          {topUnits.map(unit => (
            <DeptBlock
              key={unit.id}
              unit={unit}
              allUnits={units}
              roleTypes={roleTypes}
              orgUnitRoles={orgUnitRoles}
              users={users}
              positions={positions}
              onRefresh={loadAll}
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
