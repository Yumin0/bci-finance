'use server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { OrgLevel, RoleLevel } from '@/lib/types'

// ── user_positions ────────────────────────────────────────────────────────────

export async function addUserPosition(userId: number, orgUnitRoleId: number): Promise<string | null> {
  const { error } = await supabase.from('user_positions').insert({
    user_id: userId,
    org_unit_role_id: orgUnitRoleId,
    is_primary: true,
  })
  return error?.message ?? null
}

export async function removeUserPosition(positionId: number): Promise<string | null> {
  const { error } = await supabase.from('user_positions').delete().eq('id', positionId)
  return error?.message ?? null
}

// ── org_units ─────────────────────────────────────────────────────────────────

export async function insertOrgUnit(params: {
  code: string | null
  name: string
  level: OrgLevel
  parentId: number | null
  sortOrder: number
}): Promise<string | null> {
  const { error } = await supabase.from('org_units').insert({
    code: params.code,
    name: params.name,
    level: params.level,
    parent_id: params.parentId,
    sort_order: params.sortOrder,
  })
  return error?.message ?? null
}

export async function updateOrgUnit(id: number, code: string | null, name: string): Promise<string | null> {
  const { error } = await supabase.from('org_units').update({ code, name }).eq('id', id)
  return error?.message ?? null
}

export async function deleteOrgUnit(id: number): Promise<string | null> {
  const { error } = await supabase.from('org_units').delete().eq('id', id)
  return error?.message ?? null
}

export async function reorderOrgUnits(updates: { id: number; sortOrder: number }[]): Promise<string | null> {
  const results = await Promise.all(
    updates.map(({ id, sortOrder }) =>
      supabase.from('org_units').update({ sort_order: sortOrder }).eq('id', id)
    )
  )
  const err = results.find(r => r.error)
  return err?.error?.message ?? null
}

// ── org_unit_roles ────────────────────────────────────────────────────────────

export async function addOrgUnitRole(orgUnitId: number, roleTypeId: number, sortOrder: number): Promise<string | null> {
  const { error } = await supabase.from('org_unit_roles').insert({
    org_unit_id: orgUnitId,
    role_type_id: roleTypeId,
    display_name: null,
    sort_order: sortOrder,
  })
  return error?.message ?? null
}

export async function deleteOrgUnitRole(roleId: number): Promise<string | null> {
  const { error: posErr } = await supabase.from('user_positions').delete().eq('org_unit_role_id', roleId)
  if (posErr) return posErr.message
  const { error } = await supabase.from('org_unit_roles').delete().eq('id', roleId)
  return error?.message ?? null
}

// ── role_types ────────────────────────────────────────────────────────────────

export async function addRoleType(name: string, level: RoleLevel, sortOrder: number): Promise<string | null> {
  const { error } = await supabase.from('role_types').insert({ name, level, sort_order: sortOrder })
  return error?.message ?? null
}

export async function updateRoleType(id: number, level: RoleLevel, name: string): Promise<string | null> {
  const { error } = await supabase.from('role_types').update({ level, name }).eq('id', id)
  return error?.message ?? null
}

export async function deleteRoleType(id: number): Promise<string | null> {
  const { data: relatedRoles, error: fetchErr } = await supabase
    .from('org_unit_roles').select('id').eq('role_type_id', id)
  if (fetchErr) return fetchErr.message

  if (relatedRoles && relatedRoles.length > 0) {
    const roleIds = relatedRoles.map((x: { id: number }) => x.id)
    const { error: posErr } = await supabase.from('user_positions').delete().in('org_unit_role_id', roleIds)
    if (posErr) return posErr.message
    const { error: roleErr } = await supabase.from('org_unit_roles').delete().eq('role_type_id', id)
    if (roleErr) return roleErr.message
  }

  const { error } = await supabase.from('role_types').delete().eq('id', id)
  return error?.message ?? null
}
