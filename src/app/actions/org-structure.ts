'use server'
import ExcelJS from 'exceljs'
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

export async function updateOrgUnit(id: number, code: string | null, name: string, level?: string): Promise<string | null> {
  const updates: { code: string | null; name: string; level?: string } = { code, name }
  if (level !== undefined) updates.level = level
  const { error } = await supabase.from('org_units').update(updates).eq('id', id)
  return error?.message ?? null
}

export async function deleteOrgUnit(id: number): Promise<string | null> {
  const { error } = await supabase.from('org_units').delete().eq('id', id)
  if (error?.code === '23503') return '此節點底下還有子節點，請先刪除所有子節點後再刪除此節點'
  return error?.message ?? null
}

export async function moveOrgUnit(id: number, newParentId: number | null, newSortOrder: number): Promise<string | null> {
  const { error } = await supabase.from('org_units').update({ parent_id: newParentId, sort_order: newSortOrder }).eq('id', id)
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

// ── org_unit_members（Excel 匯入的暫定人員）──────────────────────────────────────

export async function addOrgUnitMember(orgUnitId: number, displayName: string): Promise<string | null> {
  const name = displayName.trim()
  if (!name) return '姓名不可為空'
  const { data: users } = await supabase.from('app_users').select('id').eq('name', name).limit(1)
  const userId = users?.[0]?.id ?? null
  const { error } = await supabase.from('org_unit_members').insert({
    org_unit_id: orgUnitId,
    display_name: name,
    user_id: userId,
    sort_order: 0,
  })
  return error?.message ?? null
}

export async function removeOrgUnitMember(memberId: number): Promise<string | null> {
  const { error } = await supabase.from('org_unit_members').delete().eq('id', memberId)
  return error?.message ?? null
}

// ── Excel 組織架構匯入 ────────────────────────────────────────────────────────────

export type OrgImportRow = {
  rowIndex: number
  level: string
  name: string
  parentName: string | null
  parentRowIndex: number | null
  members: string[]
}

export type OrgImportConflict = { name: string; rowIndexes: number[] }

export type OrgImportPreview = {
  rows: OrgImportRow[]
  conflicts: OrgImportConflict[]
  error?: string
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map(t => t.text).join('')
    }
    if ('text' in value) return String(value.text ?? '')
    if ('result' in value) return String(value.result ?? '')
    return ''
  }
  return String(value).trim()
}

function splitMembers(raw: string): string[] {
  return raw.split(/[/、,，]/).map(s => s.trim()).filter(Boolean)
}

// 解析上傳的 Excel，回傳每列資料 + 階層解析結果 + 同名衝突清單，不寫入資料庫
export async function previewOrgImport(formData: FormData): Promise<OrgImportPreview> {
  const file = formData.get('file') as File | null
  if (!file) return { rows: [], conflicts: [], error: '請選擇檔案' }

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = new ExcelJS.Workbook()
  try {
    // @ts-expect-error exceljs 內附的 @types/node 與專案版本的 Buffer 型別定義不一致，執行時相容
    await workbook.xlsx.load(buffer)
  } catch {
    return { rows: [], conflicts: [], error: '無法解析檔案，請確認為 .xlsx 格式' }
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) return { rows: [], conflicts: [], error: '檔案中沒有工作表' }

  const headerRow = sheet.getRow(1)
  let levelCol = -1, nameCol = -1, parentCol = -1, membersCol = -1
  headerRow.eachCell((cell, colNumber) => {
    const text = cellToString(cell.value)
    if (text === '層級') levelCol = colNumber
    else if (text === '職務名稱') nameCol = colNumber
    else if (text === '上級職務') parentCol = colNumber
    else if (text === '負責人') membersCol = colNumber
  })
  if (nameCol === -1) return { rows: [], conflicts: [], error: '找不到「職務名稱」欄位，請確認 Excel 標題列' }

  const rows: OrgImportRow[] = []
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const name = cellToString(row.getCell(nameCol).value)
    if (!name) continue
    rows.push({
      rowIndex: rows.length,
      level: levelCol === -1 ? '' : cellToString(row.getCell(levelCol).value),
      name,
      parentName: parentCol === -1 ? null : (cellToString(row.getCell(parentCol).value) || null),
      parentRowIndex: null,
      members: membersCol === -1 ? [] : splitMembers(cellToString(row.getCell(membersCol).value)),
    })
  }

  // 依「職務名稱」建立索引，解析「上級職務」對應到哪一列
  const nameToIndexes = new Map<string, number[]>()
  for (const row of rows) {
    const list = nameToIndexes.get(row.name) ?? []
    list.push(row.rowIndex)
    nameToIndexes.set(row.name, list)
  }

  const conflicts: OrgImportConflict[] = []
  for (const [name, indexes] of nameToIndexes) {
    if (indexes.length > 1) conflicts.push({ name, rowIndexes: indexes })
  }

  for (const row of rows) {
    if (!row.parentName) continue
    const candidates = nameToIndexes.get(row.parentName)
    if (candidates && candidates.length > 0) row.parentRowIndex = candidates[0]
  }

  return { rows, conflicts }
}

// 使用者確認匯入內容（含衝突解法）後，實際寫入 org_units + org_unit_members
export async function commitOrgImport(rows: OrgImportRow[]): Promise<string | null> {
  if (rows.length === 0) return '沒有可匯入的資料'

  const { data: users } = await supabase.from('app_users').select('id, name')
  const userIdByName = new Map((users ?? []).map((u: { id: number; name: string }) => [u.name, u.id]))

  const idMap = new Map<number, number>()
  const remaining = [...rows]
  while (remaining.length > 0) {
    let progressed = false
    for (let i = remaining.length - 1; i >= 0; i--) {
      const row = remaining[i]
      if (row.parentRowIndex != null && !idMap.has(row.parentRowIndex)) continue
      const parentId = row.parentRowIndex != null ? idMap.get(row.parentRowIndex)! : null
      const { data, error } = await supabase
        .from('org_units')
        .insert({ code: null, name: row.name, level: row.level || '未分類', parent_id: parentId, sort_order: row.rowIndex })
        .select('id')
        .single()
      if (error) return `新增「${row.name}」失敗：${error.message}`
      idMap.set(row.rowIndex, data.id)
      remaining.splice(i, 1)
      progressed = true
    }
    if (!progressed) return '組織架構資料有循環參照，請檢查「上級職務」欄位'
  }

  const memberRows = rows.flatMap(row => {
    const orgUnitId = idMap.get(row.rowIndex)!
    return row.members.map((name, i) => ({
      org_unit_id: orgUnitId,
      display_name: name,
      user_id: userIdByName.get(name) ?? null,
      sort_order: i,
    }))
  })

  if (memberRows.length > 0) {
    const { error } = await supabase.from('org_unit_members').insert(memberRows)
    if (error) return `新增負責人失敗：${error.message}`
  }

  return null
}
