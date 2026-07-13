'use client'

import React from 'react'
import { OrgUnit } from '@/lib/types'

// 節點顯示名稱：代號 + 名稱
export function unitLabel(u: OrgUnit): string {
  return [u.code, u.name].filter(Boolean).join(' ')
}

// 適用組織範圍勾選樹：勾選節點即涵蓋其底下所有子孫節點的成員
// 共用於「共用範本適用組織範圍」與「出款帳戶可見範圍」
export function OrgScopeTree({
  orgUnits,
  selected,
  onToggle,
}: {
  orgUnits: OrgUnit[]
  selected: number[]
  onToggle: (id: number) => void
}) {
  const childrenMap = new Map<number | null, OrgUnit[]>()
  for (const u of orgUnits) {
    if (!childrenMap.has(u.parent_id)) childrenMap.set(u.parent_id, [])
    childrenMap.get(u.parent_id)!.push(u)
  }
  const selectedSet = new Set(selected)

  function renderNodes(parentId: number | null, depth: number, coveredByAncestor: boolean): React.ReactNode {
    const nodes = childrenMap.get(parentId) ?? []
    return nodes.map(u => {
      const checked = selectedSet.has(u.id)
      return (
        <div key={u.id}>
          <label className="flex cursor-pointer items-center gap-2 py-1 text-sm" style={{ paddingLeft: depth * 20 }}>
            <input type="checkbox" checked={checked} onChange={() => onToggle(u.id)} />
            <span className={coveredByAncestor && !checked ? 'text-muted-foreground' : 'text-foreground'}>{unitLabel(u)}</span>
            {u.unit_type === 'division' && <span className="text-xs text-muted-foreground">處別</span>}
            {u.unit_type === 'section' && <span className="text-xs text-muted-foreground">課別</span>}
            {coveredByAncestor && !checked && <span className="text-xs text-muted-foreground">（已由上層涵蓋）</span>}
          </label>
          {renderNodes(u.id, depth + 1, coveredByAncestor || checked)}
        </div>
      )
    })
  }

  if (!orgUnits.length) return <p className="text-sm text-muted-foreground">載入組織架構中...</p>
  return <div className="rounded-md border border-border p-3">{renderNodes(null, 0, false)}</div>
}
