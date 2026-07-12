import { OrgUnit } from './types'

export type OrgCombo = {
  divisionId: number
  divisionLabel: string
  sectionId: number | null
  sectionLabel: string | null
}

function unitLabel(u: OrgUnit): string {
  return [u.code, u.name].filter(Boolean).join(' ')
}

// 從某個組織單位往上（含自己）找最近標記「課別」、再從該節點起往上找最近標記「處別」的祖先節點
function deriveComboForUnit(unitId: number, unitMap: Map<number, OrgUnit>): OrgCombo | null {
  const chain: OrgUnit[] = []
  let cur = unitMap.get(unitId)
  while (cur) {
    chain.push(cur)
    cur = cur.parent_id != null ? unitMap.get(cur.parent_id) : undefined
  }
  const sectionIdx = chain.findIndex(u => u.unit_type === 'section')
  const section = sectionIdx >= 0 ? chain[sectionIdx] : null
  const division = chain.slice(sectionIdx >= 0 ? sectionIdx : 0).find(u => u.unit_type === 'division') ?? null
  if (!division) return null
  return {
    divisionId: division.id,
    divisionLabel: unitLabel(division),
    sectionId: section?.id ?? null,
    sectionLabel: section ? unitLabel(section) : null,
  }
}

// 依使用者在組織架構上的所有指派節點（負責人標籤 + 正式職位），推算出所有不重複的（處別,課別）組合
export function deriveUserOrgCombos(positionUnitIds: number[], orgUnits: OrgUnit[]): OrgCombo[] {
  const unitMap = new Map(orgUnits.map(u => [u.id, u]))
  const combos: OrgCombo[] = []
  const seen = new Set<string>()
  for (const unitId of positionUnitIds) {
    const combo = deriveComboForUnit(unitId, unitMap)
    if (!combo) continue
    const key = `${combo.divisionId}-${combo.sectionId ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    combos.push(combo)
  }
  return combos
}

export function divisionOptionsFromCombos(combos: OrgCombo[]): { value: string; label: string }[] {
  const seen = new Set<number>()
  const options: { value: string; label: string }[] = []
  for (const c of combos) {
    if (seen.has(c.divisionId)) continue
    seen.add(c.divisionId)
    options.push({ value: String(c.divisionId), label: c.divisionLabel })
  }
  return options
}

export function sectionOptionsFromCombos(combos: OrgCombo[], divisionId: number | null): { value: string; label: string }[] {
  if (divisionId == null) return []
  const seen = new Set<number>()
  const options: { value: string; label: string }[] = []
  for (const c of combos) {
    if (c.divisionId !== divisionId || c.sectionId == null) continue
    if (seen.has(c.sectionId)) continue
    seen.add(c.sectionId)
    options.push({ value: String(c.sectionId), label: c.sectionLabel! })
  }
  return options
}

// 判斷使用者的任一指派節點是否落在範圍節點內（範圍節點本身或其子孫皆算涵蓋）
export function isUserCoveredByUnits(userUnitIds: number[], scopeUnitIds: number[], orgUnits: OrgUnit[]): boolean {
  if (!scopeUnitIds.length || !userUnitIds.length) return false
  const scope = new Set(scopeUnitIds)
  const unitMap = new Map(orgUnits.map(u => [u.id, u]))
  for (const unitId of userUnitIds) {
    let cur = unitMap.get(unitId)
    while (cur) {
      if (scope.has(cur.id)) return true
      cur = cur.parent_id != null ? unitMap.get(cur.parent_id) : undefined
    }
  }
  return false
}

// 依組織樹深度優先展開（同層依 sort_order），使下拉選項順序與組織架構頁一致
export function unitsInTreeOrder(orgUnits: OrgUnit[]): OrgUnit[] {
  const childrenMap = new Map<number | null, OrgUnit[]>()
  const ids = new Set(orgUnits.map(u => u.id))
  for (const u of orgUnits) {
    // 父節點不在清單中（資料異常）時視為樹根，避免整個分支消失
    const key = u.parent_id != null && ids.has(u.parent_id) ? u.parent_id : null
    if (!childrenMap.has(key)) childrenMap.set(key, [])
    childrenMap.get(key)!.push(u)
  }
  const result: OrgUnit[] = []
  const visit = (parentKey: number | null) => {
    const kids = (childrenMap.get(parentKey) ?? []).sort((a, b) => a.sort_order - b.sort_order)
    for (const k of kids) {
      result.push(k)
      visit(k.id)
    }
  }
  visit(null)
  return result
}

// 完整清單：列出所有標記處別/課別的節點（申請單處別/課別下拉開放自由選擇）
export function allDivisionOptions(orgUnits: OrgUnit[]): { value: string; label: string }[] {
  return unitsInTreeOrder(orgUnits).filter(u => u.unit_type === 'division').map(u => ({ value: String(u.id), label: unitLabel(u) }))
}

// 課別歸屬的處 = 從該節點往上最近的處別祖先（與 deriveComboForUnit 一致），支援深層節點（處→中間節點→課）
export function nearestDivisionId(unit: OrgUnit, unitMap: Map<number, OrgUnit>): number | null {
  let cur: OrgUnit | undefined = unit
  while (cur) {
    if (cur.unit_type === 'division') return cur.id
    cur = cur.parent_id != null ? unitMap.get(cur.parent_id) : undefined
  }
  return null
}

export function allSectionOptions(orgUnits: OrgUnit[], divisionId: number | null): { value: string; label: string }[] {
  if (divisionId == null) return []
  const unitMap = new Map(orgUnits.map(u => [u.id, u]))
  return unitsInTreeOrder(orgUnits)
    .filter(u => u.unit_type === 'section' && nearestDivisionId(u, unitMap) === divisionId)
    .map(u => ({ value: String(u.id), label: unitLabel(u) }))
}
