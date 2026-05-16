'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  DEFAULT_SIDEBAR_CONFIG,
  type SidebarCategory,
  type SidebarGroup,
  type SidebarItem,
} from '@/lib/sidebar-config'
import { saveSidebarConfig, resetSidebarConfig } from '@/app/actions/sidebar-config'

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export default function SidebarCustomizationClient({ initialConfig }: { initialConfig: SidebarCategory[] }) {
  const router = useRouter()
  const [config, setConfig] = useState<SidebarCategory[]>(() => clone(initialConfig))
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const ids = new Set<string>()
    initialConfig.forEach(cat => cat.entries.forEach(e => { if (e.kind === 'group') ids.add(e.id) }))
    return ids
  })
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  function update(fn: (c: SidebarCategory[]) => void) {
    setConfig(prev => { const next = clone(prev); fn(next); return next })
    setSavedMsg('')
  }

  function toggleGroup(id: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function moveCategory(ci: number, dir: -1 | 1) {
    update(c => { const t = ci + dir; if (t >= 0 && t < c.length) [c[ci], c[t]] = [c[t], c[ci]] })
  }
  function moveEntry(ci: number, ei: number, dir: -1 | 1) {
    update(c => { const t = ei + dir; if (t >= 0 && t < c[ci].entries.length) [c[ci].entries[ei], c[ci].entries[t]] = [c[ci].entries[t], c[ci].entries[ei]] })
  }
  function moveGroupItem(ci: number, ei: number, ii: number, dir: -1 | 1) {
    update(c => { const items = (c[ci].entries[ei] as SidebarGroup).items; const t = ii + dir; if (t >= 0 && t < items.length) [items[ii], items[t]] = [items[t], items[ii]] })
  }
  function moveItemIntoGroup(ci: number, ei: number, groupId: string) {
    update(c => {
      const [item] = c[ci].entries.splice(ei, 1) as SidebarItem[]
      const gi = c[ci].entries.findIndex(e => e.kind === 'group' && e.id === groupId)
      if (gi !== -1) (c[ci].entries[gi] as SidebarGroup).items.push(item)
    })
  }
  function moveItemOutOfGroup(ci: number, ei: number, ii: number) {
    update(c => {
      const group = c[ci].entries[ei] as SidebarGroup
      const [item] = group.items.splice(ii, 1)
      c[ci].entries.splice(ei + 1, 0, item)
    })
  }
  function addGroup(ci: number) {
    const id = `group-${Date.now()}`
    update(c => { c[ci].entries.push({ kind: 'group', id, label: '新群組', items: [] }) })
    setExpandedGroups(prev => new Set([...prev, id]))
  }
  function dissolveGroup(ci: number, ei: number) {
    update(c => { const group = c[ci].entries[ei] as SidebarGroup; c[ci].entries.splice(ei, 1, ...group.items) })
  }

  function handleSave() {
    setErrorMsg('')
    startTransition(async () => {
      const result = await saveSidebarConfig(config)
      if (result.error) { setErrorMsg(result.error); return }
      setSavedMsg('設定已儲存，側邊欄已更新。')
      router.refresh()
    })
  }

  function handleReset() {
    setErrorMsg('')
    startTransition(async () => {
      const result = await resetSidebarConfig()
      if (result.error) { setErrorMsg(result.error); return }
      const defaults = clone(DEFAULT_SIDEBAR_CONFIG)
      setConfig(defaults)
      const ids = new Set<string>()
      defaults.forEach((cat: SidebarCategory) => cat.entries.forEach(e => { if (e.kind === 'group') ids.add(e.id) }))
      setExpandedGroups(ids)
      setSavedMsg('已還原為預設設定。')
      router.refresh()
    })
  }

  return (
    <div style={{ maxWidth: 740 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>側邊欄自定義設定</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleReset} disabled={isPending} style={outlineBtn}>還原預設</button>
          <button onClick={handleSave} disabled={isPending} style={solidBtn}>
            {isPending ? '處理中...' : savedMsg ? '已儲存' : '儲存設定'}
          </button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 28 }}>
        可自訂義類別、群組與項目的顯示名稱，並調整排列順序。群組可展開收合，支援兩層結構。
      </p>

      {config.map((category, ci) => {
        const groups = category.entries.filter(e => e.kind === 'group') as SidebarGroup[]
        return (
          <div key={category.id} style={{ marginBottom: 20, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f1f5f9', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
              <Arrows onUp={() => moveCategory(ci, -1)} onDown={() => moveCategory(ci, 1)} upOff={ci === 0} downOff={ci === config.length - 1} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 4px' }}>類別名稱</p>
                <input value={category.label} onChange={e => update(c => { c[ci].label = e.target.value })} style={inp} />
              </div>
            </div>

            {category.entries.map((entry, ei) => {
              if (entry.kind === 'item') {
                return (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#fff', borderBottom: '1px solid #f3f4f6' }}>
                    <Arrows onUp={() => moveEntry(ci, ei, -1)} onDown={() => moveEntry(ci, ei, 1)} upOff={ei === 0} downOff={ei === category.entries.length - 1} />
                    <div style={{ flex: 1 }}>
                      <input value={entry.label} onChange={e => update(c => { (c[ci].entries[ei] as SidebarItem).label = e.target.value })} style={{ ...inp, fontSize: 13 }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#d1d5db', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{entry.href}</span>
                    {groups.length > 0 && (
                      <select value="" onChange={e => { if (e.target.value) moveItemIntoGroup(ci, ei, e.target.value) }} style={{ fontSize: 12, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4, color: '#374151', cursor: 'pointer', flexShrink: 0 }}>
                        <option value="">加入群組...</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </select>
                    )}
                  </div>
                )
              }

              const group = entry as SidebarGroup
              const open = expandedGroups.has(group.id)
              return (
                <div key={group.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#fafafa' }}>
                    <Arrows onUp={() => moveEntry(ci, ei, -1)} onDown={() => moveEntry(ci, ei, 1)} upOff={ei === 0} downOff={ei === category.entries.length - 1} />
                    <button onClick={() => toggleGroup(group.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#9ca3af', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>
                      {open ? '▾' : '▸'}
                    </button>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 4px' }}>群組名稱</p>
                      <input value={group.label} onChange={e => update(c => { (c[ci].entries[ei] as SidebarGroup).label = e.target.value })} style={{ ...inp, fontSize: 13 }} />
                    </div>
                    <button onClick={() => dissolveGroup(ci, ei)} style={{ fontSize: 12, color: '#dc2626', background: 'none', border: '1px solid #fca5a5', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      解散群組
                    </button>
                  </div>
                  {open && (
                    <>
                      {group.items.map((item, ii) => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px 9px 52px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
                          <Arrows onUp={() => moveGroupItem(ci, ei, ii, -1)} onDown={() => moveGroupItem(ci, ei, ii, 1)} upOff={ii === 0} downOff={ii === group.items.length - 1} />
                          <div style={{ flex: 1 }}>
                            <input value={item.label} onChange={e => update(c => { (c[ci].entries[ei] as SidebarGroup).items[ii].label = e.target.value })} style={{ ...inp, fontSize: 13 }} />
                          </div>
                          <span style={{ fontSize: 12, color: '#d1d5db', fontFamily: 'monospace', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.href}</span>
                          <button onClick={() => moveItemOutOfGroup(ci, ei, ii)} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            移出群組
                          </button>
                        </div>
                      ))}
                      {group.items.length === 0 && (
                        <div style={{ padding: '10px 52px', fontSize: 13, color: '#9ca3af', borderTop: '1px solid #f3f4f6' }}>尚無項目，可從平層項目選擇「加入群組」</div>
                      )}
                    </>
                  )}
                </div>
              )
            })}

            <div style={{ padding: '10px 16px', background: '#fff' }}>
              <button onClick={() => addGroup(ci)} style={{ fontSize: 13, color: '#374151', background: 'none', border: '1px dashed #d1d5db', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>
                ＋ 新增群組
              </button>
            </div>
          </div>
        )
      })}

      {savedMsg && <p style={{ fontSize: 13, color: '#16a34a', marginTop: 4 }}>{savedMsg}</p>}
      {errorMsg && <p style={{ fontSize: 13, color: '#dc2626', marginTop: 4 }}>{errorMsg}</p>}
    </div>
  )
}

function Arrows({ onUp, onDown, upOff, downOff }: { onUp: () => void; onDown: () => void; upOff: boolean; downOff: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
      <button onClick={onUp} disabled={upOff} style={arrowBtn(upOff)}>▲</button>
      <button onClick={onDown} disabled={downOff} style={arrowBtn(downOff)}>▼</button>
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box' }
const solidBtn: React.CSSProperties = { padding: '8px 20px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const outlineBtn: React.CSSProperties = { padding: '8px 16px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, cursor: 'pointer' }
function arrowBtn(disabled: boolean): React.CSSProperties {
  return { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 18, fontSize: 9, lineHeight: 1, padding: 0, background: disabled ? '#f9fafb' : '#fff', border: '1px solid #e5e7eb', borderRadius: 3, cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? '#d1d5db' : '#374151' }
}
