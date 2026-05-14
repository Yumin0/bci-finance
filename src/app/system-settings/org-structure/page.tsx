'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { OrgUnit, OrgLevel, RoleType, RoleLevel, OrgUnitRole } from '@/lib/types'

const ORG_LEVELS: OrgLevel[] = ['部門', '處', '課', '科']
const ROLE_LEVELS: RoleLevel[] = ['處', '課', '科']

function buildDisplayName(unit: OrgUnit, roleType: RoleType): string {
  const prefix = [unit.code, unit.name].filter(Boolean).join(' ')
  return `${prefix} ${roleType.name}`
}

// ─── 組織節點區塊 ────────────────────────────────────────────────────────────

function OrgUnitsSection({
  units,
  onRefresh,
}: {
  units: OrgUnit[]
  onRefresh: () => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [level, setLevel] = useState<OrgLevel>('處')
  const [parentId, setParentId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const parentOptions = units.filter(u => {
    const parentLevel: Record<OrgLevel, OrgLevel | null> = {
      部門: null, 處: '部門', 課: '處', 科: '課',
    }
    return u.level === parentLevel[level]
  })

  async function handleAdd() {
    if (!name.trim()) return
    setError(null)
    const maxOrder = units
      .filter(u => u.level === level && u.parent_id === (parentId ? Number(parentId) : null))
      .reduce((m, u) => Math.max(m, u.sort_order), -1)
    const { error: e } = await supabase.from('org_units').insert({
      code: code.trim() || null,
      name: name.trim(),
      level,
      parent_id: parentId ? Number(parentId) : null,
      sort_order: maxOrder + 1,
    })
    if (e) { setError(e.message); return }
    setCode(''); setName(''); setParentId('')
    onRefresh()
  }

  async function handleDelete(id: number) {
    if (!confirm('確定刪除？若有下層節點或關聯角色將無法刪除。')) return
    const { error: e } = await supabase.from('org_units').delete().eq('id', id)
    if (e) { setError(e.message); return }
    onRefresh()
  }

  return (
    <section>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>組織節點（職位名稱）</h2>
      {error && <p style={{ color: 'red', marginBottom: 8 }}>{error}</p>}

      <table border={1} cellPadding={8} style={{ marginBottom: 16, borderCollapse: 'collapse', minWidth: 520 }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ textAlign: 'left' }}>層級</th>
            <th style={{ textAlign: 'left' }}>編號</th>
            <th style={{ textAlign: 'left' }}>名稱</th>
            <th style={{ textAlign: 'left' }}>上層</th>
            <th style={{ width: 80 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {units.length === 0 ? (
            <tr><td colSpan={5} style={{ color: '#9ca3af' }}>尚無資料</td></tr>
          ) : units.map(u => {
            const parent = units.find(p => p.id === u.parent_id)
            return (
              <tr key={u.id}>
                <td>{u.level}</td>
                <td>{u.code ?? '—'}</td>
                <td>{u.name}</td>
                <td>{parent ? `${parent.code ?? ''} ${parent.name}`.trim() : '—'}</td>
                <td>
                  <button onClick={() => handleDelete(u.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>
                    刪除
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={level} onChange={e => { setLevel(e.target.value as OrgLevel); setParentId('') }}>
          {ORG_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        {level !== '部門' && (
          <select value={parentId} onChange={e => setParentId(e.target.value)}>
            <option value="">選擇上層（選填）</option>
            {parentOptions.map(p => (
              <option key={p.id} value={p.id}>
                {[p.code, p.name].filter(Boolean).join(' ')}
              </option>
            ))}
          </select>
        )}
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="編號（如第8課）"
          style={{ width: 140 }}
        />
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          placeholder="名稱（如支出課）"
          style={{ width: 180 }}
        />
        <button onClick={handleAdd}>新增</button>
      </div>
    </section>
  )
}

// ─── 角色類型區塊 ────────────────────────────────────────────────────────────

function RoleTypesSection({
  roleTypes,
  onRefresh,
}: {
  roleTypes: RoleType[]
  onRefresh: () => void
}) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState<RoleLevel>('課')
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!name.trim()) return
    setError(null)
    const maxOrder = roleTypes
      .filter(r => r.level === level)
      .reduce((m, r) => Math.max(m, r.sort_order), -1)
    const { error: e } = await supabase.from('role_types').insert({
      name: name.trim(), level, sort_order: maxOrder + 1,
    })
    if (e) { setError(e.message); return }
    setName('')
    onRefresh()
  }

  async function handleDelete(id: number) {
    if (!confirm('確定刪除？若有關聯實際角色將無法刪除。')) return
    const { error: e } = await supabase.from('role_types').delete().eq('id', id)
    if (e) { setError(e.message); return }
    onRefresh()
  }

  return (
    <section>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>角色類型</h2>
      {error && <p style={{ color: 'red', marginBottom: 8 }}>{error}</p>}

      <table border={1} cellPadding={8} style={{ marginBottom: 16, borderCollapse: 'collapse', minWidth: 320 }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ textAlign: 'left' }}>適用層級</th>
            <th style={{ textAlign: 'left' }}>角色名稱</th>
            <th style={{ width: 80 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {roleTypes.length === 0 ? (
            <tr><td colSpan={3} style={{ color: '#9ca3af' }}>尚無資料</td></tr>
          ) : roleTypes.map(r => (
            <tr key={r.id}>
              <td>{r.level}</td>
              <td>{r.name}</td>
              <td>
                <button onClick={() => handleDelete(r.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>
                  刪除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={level} onChange={e => setLevel(e.target.value as RoleLevel)}>
          {ROLE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          placeholder="角色名稱（如課長(儲備)）"
          style={{ width: 200 }}
        />
        <button onClick={handleAdd}>新增</button>
      </div>
    </section>
  )
}

// ─── 實際角色區塊 ─────────────────────────────────────────────────────────────

function OrgUnitRolesSection({
  orgUnitRoles,
  units,
  roleTypes,
  onRefresh,
}: {
  orgUnitRoles: OrgUnitRole[]
  units: OrgUnit[]
  roleTypes: RoleType[]
  onRefresh: () => void
}) {
  const [unitId, setUnitId] = useState<string>('')
  const [roleTypeId, setRoleTypeId] = useState<string>('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selectedUnit = units.find(u => u.id === Number(unitId))
  const compatibleRoleTypes = selectedUnit
    ? roleTypes.filter(r => r.level === selectedUnit.level)
    : []

  const autoName = selectedUnit && roleTypeId
    ? buildDisplayName(selectedUnit, roleTypes.find(r => r.id === Number(roleTypeId))!)
    : ''

  async function handleAdd() {
    if (!unitId || !roleTypeId) return
    setError(null)
    const maxOrder = orgUnitRoles
      .filter(r => r.org_unit_id === Number(unitId))
      .reduce((m, r) => Math.max(m, r.sort_order), -1)
    const { error: e } = await supabase.from('org_unit_roles').insert({
      org_unit_id: Number(unitId),
      role_type_id: Number(roleTypeId),
      display_name: displayName.trim() || null,
      sort_order: maxOrder + 1,
    })
    if (e) { setError(e.message); return }
    setUnitId(''); setRoleTypeId(''); setDisplayName('')
    onRefresh()
  }

  async function handleDelete(id: number) {
    if (!confirm('確定刪除此角色？')) return
    const { error: e } = await supabase.from('org_unit_roles').delete().eq('id', id)
    if (e) { setError(e.message); return }
    onRefresh()
  }

  return (
    <section>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>實際角色（角色名稱）</h2>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>
        自訂顯示名稱留空時，自動組合為「編號 名稱 角色類型」。
      </p>
      {error && <p style={{ color: 'red', marginBottom: 8 }}>{error}</p>}

      <table border={1} cellPadding={8} style={{ marginBottom: 16, borderCollapse: 'collapse', minWidth: 560 }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ textAlign: 'left' }}>組織節點</th>
            <th style={{ textAlign: 'left' }}>角色類型</th>
            <th style={{ textAlign: 'left' }}>顯示名稱</th>
            <th style={{ width: 80 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {orgUnitRoles.length === 0 ? (
            <tr><td colSpan={4} style={{ color: '#9ca3af' }}>尚無資料</td></tr>
          ) : orgUnitRoles.map(r => {
            const unit = units.find(u => u.id === r.org_unit_id)
            const rt = roleTypes.find(t => t.id === r.role_type_id)
            const shown = r.display_name ?? (unit && rt ? buildDisplayName(unit, rt) : '—')
            return (
              <tr key={r.id}>
                <td>{unit ? [unit.code, unit.name].filter(Boolean).join(' ') : r.org_unit_id}</td>
                <td>{rt?.name ?? r.role_type_id}</td>
                <td>{shown}</td>
                <td>
                  <button onClick={() => handleDelete(r.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>
                    刪除
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={unitId} onChange={e => { setUnitId(e.target.value); setRoleTypeId('') }}>
          <option value="">選擇組織節點</option>
          {units
            .filter(u => u.level !== '部門')
            .map(u => (
              <option key={u.id} value={u.id}>
                {u.level} — {[u.code, u.name].filter(Boolean).join(' ')}
              </option>
            ))}
        </select>
        <select value={roleTypeId} onChange={e => setRoleTypeId(e.target.value)} disabled={!unitId}>
          <option value="">選擇角色類型</option>
          {compatibleRoleTypes.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          placeholder={autoName || '自訂顯示名稱（選填）'}
          style={{ width: 260 }}
        />
        <button onClick={handleAdd} disabled={!unitId || !roleTypeId}>新增</button>
      </div>
    </section>
  )
}

// ─── 主頁面 ───────────────────────────────────────────────────────────────────

export default function OrgStructurePage() {
  const [units, setUnits] = useState<OrgUnit[]>([])
  const [roleTypes, setRoleTypes] = useState<RoleType[]>([])
  const [orgUnitRoles, setOrgUnitRoles] = useState<OrgUnitRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadAll() {
    const [uRes, rRes, orRes] = await Promise.all([
      supabase.from('org_units').select('*').order('level').order('sort_order'),
      supabase.from('role_types').select('*').order('level').order('sort_order'),
      supabase.from('org_unit_roles').select('*').order('org_unit_id').order('sort_order'),
    ])
    if (uRes.error) { setError(uRes.error.message); return }
    if (rRes.error) { setError(rRes.error.message); return }
    if (orRes.error) { setError(orRes.error.message); return }
    setUnits((uRes.data as OrgUnit[]) ?? [])
    setRoleTypes((rRes.data as RoleType[]) ?? [])
    setOrgUnitRoles((orRes.data as OrgUnitRole[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  if (loading) return <p>載入中...</p>

  return (
    <div>
      <h1>組織架構設定</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        管理部門、處、課、科等組織節點，以及各層級的角色類型與實際角色。
      </p>

      {error && <p style={{ color: 'red', marginBottom: 16 }}>錯誤：{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        <OrgUnitsSection units={units} onRefresh={loadAll} />
        <RoleTypesSection roleTypes={roleTypes} onRefresh={loadAll} />
        <OrgUnitRolesSection
          orgUnitRoles={orgUnitRoles}
          units={units}
          roleTypes={roleTypes}
          onRefresh={loadAll}
        />
      </div>
    </div>
  )
}
