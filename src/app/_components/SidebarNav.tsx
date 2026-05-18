'use client'

import Link from 'next/link'
import { useState } from 'react'
import { type SidebarCategory, type SidebarGroup } from '@/lib/sidebar-config'

export default function SidebarNav({ config }: { config: SidebarCategory[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggleGroup(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      {config.map((category, ci) => (
        <div key={category.id}>
          <p style={{ padding: ci === 0 ? '0 24px 8px' : '16px 24px 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            {category.label}
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {category.entries.map(entry => {
              if (entry.kind === 'item') {
                return (
                  <li key={entry.id}>
                    <Link href={entry.href} style={{ display: 'block', padding: '10px 24px', textDecoration: 'none', color: 'var(--text-body)', fontSize: 14 }}>
                      {entry.label}
                    </Link>
                  </li>
                )
              }

              const group = entry as SidebarGroup
              const isCollapsed = collapsed.has(group.id)
              return (
                <li key={group.id}>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-body)', textAlign: 'left' }}
                  >
                    <span>{group.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-subtle)' }}>{isCollapsed ? '▸' : '▾'}</span>
                  </button>
                  {!isCollapsed && (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {group.items.map(item => (
                        <li key={item.id}>
                          <Link href={item.href} style={{ display: 'block', padding: '8px 24px 8px 36px', textDecoration: 'none', color: 'var(--text-muted)', fontSize: 13 }}>
                            · {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </>
  )
}
