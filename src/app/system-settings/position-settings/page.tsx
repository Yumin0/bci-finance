'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { OrgUnit, OrgLevel, RoleType, OrgUnitRole, AppUser, UserPosition } from '@/lib/types'

const LEVEL_INDENT: Record<OrgLevel, number> = {
  '部門': 0,
  '處': 16,
  '課': 32,
  '科': 48,
}

const LEVEL_FONT_SIZE: Record<OrgLevel, number> = {
  '部門': 15,
  '處': 14,
  '課': 13,
  '科': 13,
}

const LEVEL_WEIGHT: Record<OrgLevel, number> = {
  '部門': 700,
  '處': 600,
  '課': 500,
  '科': 500,
}

function buildDisplayName(unit: OrgUnit, roleType: RoleType): string {
  const prefix = [unit.code, unit.name].filter(Boolean).join(' ')
  return `${prefix} ${roleType.name}`
}

// ─── 單一職位列（角色 + 指派使用者）──────────────────────────────────────────

function RoleRow({
  role,
  unit,
  roleTypes,
  users,
  positions,
  indent,
  onRefresh,
}: {
  role: OrgUnitRole
  unit: OrgUnit
  roleTypes: RoleType[]
  users: AppUser[]
  positions: UserPosition[]
  indent: number
  onRefresh: () => void
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
        paddingTop: 5,
        paddingBottom: 5,
        paddingRight: 12,
        fontSize: 13,
        color: '#374151',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        width: 1,
      }}>
        {displayName}
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
                >
                  ×
                </button>
              </span>
            )
          })}

          {adding ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                autoFocus
                style={{ fontSize: 13, padding: '3px 6px', borderRadius: 4, border: '1px solid #d1d5db' }}
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
                  fontSize: 12, padding: '3px 10px', cursor: selectedUserId ? 'pointer' : 'not-allowed',
                  background: selectedUserId ? '#111827' : '#9ca3af',
                  color: '#fff', border: 'none', borderRadius: 4,
                }}
              >
                確認
              </button>
              <button
                onClick={() => { setAdding(false); setSelectedUserId('') }}
                style={{
                  fontSize: 12, padding: '3px 10px', cursor: 'pointer',
                  background: 'none', border: '1px solid #d1d5db', borderRadius: 4, color: '#374151',
                }}
              >
                取消
              </button>
            </span>
          ) : availableUsers.length > 0 ? (
            <button
              onClick={() => setAdding(true)}
              style={{
                fontSize: 12, padding: '3px 10px', cursor: 'pointer',
                background: 'none', border: '1px dashed #9ca3af',
                borderRadius: 4, color: '#6b7280',
              }}
            >
              ＋ 新增
            </button>
          ) : assignedPositions.length === 0 ? (
            <span style={{ fontSize: 12, color: '#d1d5db' }}>（未指派）</span>
          ) : null}

          {error && <span style={{ color: '#dc2626', fontSize: 12 }}>{error}</span>}
        </div>
      </td>
    </tr>
  )
}

// ─── 組織節點（遞迴）────────────────────────────────────────────────────────

function OrgNodeRows({
  unit,
  allUnits,
  roleTypes,
  orgUnitRoles,
  users,
  positions,
  onRefresh,
}: {
  unit: OrgUnit
  allUnits: OrgUnit[]
  roleTypes: RoleType[]
  orgUnitRoles: OrgUnitRole[]
  users: AppUser[]
  positions: UserPosition[]
  onRefresh: () => void
}) {
  const indent = LEVEL_INDENT[unit.level]
  const unitRoles = orgUnitRoles
    .filter(r => r.org_unit_id === unit.id)
    .sort((a, b) => a.sort_order - b.sort_order)

  const childLevelMap: Partial<Record<OrgLevel, OrgLevel>> = {
    '部門': '處', '處': '課', '課': '科',
  }
  const childLevel = childLevelMap[unit.level]
  const children = childLevel
    ? allUnits
        .filter(u => u.level === childLevel && u.parent_id === unit.id)
        .sort((a, b) => a.sort_order - b.sort_order)
    : []

  return (
    <>
      <tr>
        <td
          colSpan={2}
          style={{
            paddingLeft: indent + 12,
            paddingTop: unit.level === '部門' ? 16 : 10,
            paddingBottom: unitRoles.length === 0 ? 6 : 4,
            fontWeight: LEVEL_WEIGHT[unit.level],
            fontSize: LEVEL_FONT_SIZE[unit.level],
            color: '#111827',
            borderTop: unit.level === '部門' ? '2px solid #e5e7eb' : '1px solid #f3f4f6',
            background: unit.level === '部門' ? '#f9fafb' : 'transparent',
          }}
        >
          <span style={{ fontSize: 11, color: '#9ca3af', marginRight: 6, fontWeight: 400 }}>
            {unit.level}
          </span>
          {[unit.code, unit.name].filter(Boolean).join(' ')}
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
        />
      ))}

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
    </>
  )
}

// ─── 主頁面 ───────────────────────────────────────────────────────────────────

export default function PositionSettingsPage() {
  const [units, setUnits] = useState<OrgUnit[]>([])
  const [roleTypes, setRoleTypes] = useState<RoleType[]>([])
  const [orgUnitRoles, setOrgUnitRoles] = useState<OrgUnitRole[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [positions, setPositions] = useState<UserPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  if (loading) return <p>載入中...</p>

  const rootUnits = units
    .filter(u => u.level === '部門' && u.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order)

  // 若無部門，改以處為根
  const topUnits = rootUnits.length > 0
    ? rootUnits
    : units.filter(u => u.level === '處' && u.parent_id === null).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>職位設定</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
        依組織架構，為各職位指派對應的使用者。
      </p>

      {error && <p style={{ color: '#dc2626', marginBottom: 16 }}>錯誤：{error}</p>}

      {topUnits.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: 14 }}>
          尚無組織架構資料，請先至「組織架構設定」建立節點與職位。
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#374151', width: 280, whiteSpace: 'nowrap' }}>
                職位
              </th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#374151' }}>
                指派使用者
              </th>
            </tr>
          </thead>
          <tbody>
            {topUnits.map(unit => (
              <OrgNodeRows
                key={unit.id}
                unit={unit}
                allUnits={units}
                roleTypes={roleTypes}
                orgUnitRoles={orgUnitRoles}
                users={users}
                positions={positions}
                onRefresh={loadAll}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
