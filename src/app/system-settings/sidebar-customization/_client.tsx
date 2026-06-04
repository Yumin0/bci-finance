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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import PageHeader from '@/app/_components/PageHeader'

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

function Arrows({ onUp, onDown, upOff, downOff }: { onUp: () => void; onDown: () => void; upOff: boolean; downOff: boolean }) {
  const btnCls = (off: boolean) =>
    `flex h-[18px] w-[22px] items-center justify-center rounded border border-border text-[9px] leading-none ${
      off ? 'cursor-not-allowed text-muted-foreground/30 bg-muted/30' : 'cursor-pointer text-foreground bg-background hover:bg-muted'
    }`
  return (
    <div className="flex shrink-0 flex-col gap-0.5">
      <button onClick={onUp} disabled={upOff} className={btnCls(upOff)}>▲</button>
      <button onClick={onDown} disabled={downOff} className={btnCls(downOff)}>▼</button>
    </div>
  )
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
    <div className="flex max-w-[740px] flex-col gap-6">
      <div>
        <PageHeader
          title="側邊欄自定義設定"
          action={
            <div className="flex gap-2.5">
              <Button variant="outline" onClick={handleReset} disabled={isPending}>還原預設</Button>
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? '處理中...' : savedMsg ? '已儲存' : '儲存設定'}
              </Button>
            </div>
          }
        />
        <p className="mt-1 text-sm text-muted-foreground">
          可自訂義類別、群組與項目的顯示名稱，並調整排列順序。群組可展開收合，支援兩層結構。
        </p>
      </div>

      {config.map((category, ci) => {
        const groups = category.entries.filter(e => e.kind === 'group') as SidebarGroup[]
        return (
          <Card key={category.id} className="gap-0 overflow-hidden p-0">
            {/* 類別 header */}
            <div className="flex items-center gap-2.5 border-b border-border bg-muted/50 px-4 py-3">
              <Arrows onUp={() => moveCategory(ci, -1)} onDown={() => moveCategory(ci, 1)} upOff={ci === 0} downOff={ci === config.length - 1} />
              <div className="flex-1">
                <p className="mb-1 text-xs text-muted-foreground">類別名稱</p>
                <Input value={category.label} onChange={e => update(c => { c[ci].label = e.target.value })} />
              </div>
            </div>

            {/* 項目列 */}
            {category.entries.map((entry, ei) => {
              if (entry.kind === 'item') {
                return (
                  <div key={entry.id} className="flex items-center gap-2.5 border-b border-border bg-card px-4 py-2.5">
                    <Arrows onUp={() => moveEntry(ci, ei, -1)} onDown={() => moveEntry(ci, ei, 1)} upOff={ei === 0} downOff={ei === category.entries.length - 1} />
                    <div className="flex-1">
                      <Input value={entry.label} onChange={e => update(c => { (c[ci].entries[ei] as SidebarItem).label = e.target.value })} className="text-sm" />
                    </div>
                    <span className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-muted-foreground/50">{entry.href}</span>
                    {groups.length > 0 && (
                      <select
                        value=""
                        onChange={e => { if (e.target.value) moveItemIntoGroup(ci, ei, e.target.value) }}
                        className="shrink-0 rounded border border-border px-1.5 py-1 text-xs text-foreground"
                      >
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
                <div key={group.id} className="border-b border-border">
                  <div className="flex items-center gap-2.5 bg-card px-4 py-2.5">
                    <Arrows onUp={() => moveEntry(ci, ei, -1)} onDown={() => moveEntry(ci, ei, 1)} upOff={ei === 0} downOff={ei === category.entries.length - 1} />
                    <button onClick={() => toggleGroup(group.id)} className="shrink-0 cursor-pointer px-0.5 text-sm text-muted-foreground">
                      {open ? '▾' : '▸'}
                    </button>
                    <div className="flex-1">
                      <p className="mb-1 text-xs text-muted-foreground">群組名稱</p>
                      <Input value={group.label} onChange={e => update(c => { (c[ci].entries[ei] as SidebarGroup).label = e.target.value })} className="text-sm" />
                    </div>
                    <button
                      onClick={() => dissolveGroup(ci, ei)}
                      className="shrink-0 whitespace-nowrap rounded border border-red-200 px-2.5 py-1 text-xs text-destructive hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                    >
                      解散群組
                    </button>
                  </div>
                  {open && (
                    <>
                      {group.items.map((item, ii) => (
                        <div key={item.id} className="flex items-center gap-2.5 border-t border-border bg-card py-2.5 pl-12 pr-4">
                          <Arrows onUp={() => moveGroupItem(ci, ei, ii, -1)} onDown={() => moveGroupItem(ci, ei, ii, 1)} upOff={ii === 0} downOff={ii === group.items.length - 1} />
                          <div className="flex-1">
                            <Input value={item.label} onChange={e => update(c => { (c[ci].entries[ei] as SidebarGroup).items[ii].label = e.target.value })} className="text-sm" />
                          </div>
                          <span className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-muted-foreground/50">{item.href}</span>
                          <button
                            onClick={() => moveItemOutOfGroup(ci, ei, ii)}
                            className="shrink-0 whitespace-nowrap rounded border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                          >
                            移出群組
                          </button>
                        </div>
                      ))}
                      {group.items.length === 0 && (
                        <div className="border-t border-border px-12 py-2.5 text-sm text-muted-foreground">
                          尚無項目，可從平層項目選擇「加入群組」
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}

            {/* 新增群組 footer */}
            <div className="bg-card px-4 py-2.5">
              <button
                onClick={() => addGroup(ci)}
                className="rounded-md border border-dashed border-border px-3.5 py-1.5 text-sm text-foreground hover:bg-muted/50"
              >
                ＋ 新增群組
              </button>
            </div>
          </Card>
        )
      })}

      {savedMsg && <p className="text-sm text-green-600 dark:text-green-400">{savedMsg}</p>}
      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
    </div>
  )
}
