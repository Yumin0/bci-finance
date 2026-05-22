'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { type SidebarCategory, type SidebarGroup } from '@/lib/sidebar-config'

export default function SidebarNav({ config }: { config: SidebarCategory[] }) {
  const pathname = usePathname()
  const [closedCategories, setClosedCategories] = useState<Set<string>>(new Set())
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  function toggleCategory(id: string) {
    setClosedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleGroup(id: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div style={{ padding: '8px 0 16px' }}>
      {config.map((category, ci) => {
        const isClosed = closedCategories.has(category.id)
        return (
          <div key={category.id}>
            {/* Section divider between categories */}
            {ci > 0 && (
              <div style={{ height: 1, background: 'var(--border-color)', margin: '6px 16px 2px' }} />
            )}

            {/* Category header — clickable to collapse */}
            <button
              onClick={() => toggleCategory(category.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: ci === 0 ? '8px 16px 6px' : '14px 16px 6px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                gap: 4,
              }}
            >
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--sidebar-accent)',
                letterSpacing: '0.03em',
                lineHeight: 1.3,
              }}>
                {category.label}
              </span>
              <svg
                width="12" height="12" viewBox="0 0 12 12" fill="none"
                style={{
                  flexShrink: 0,
                  color: 'var(--sidebar-accent)',
                  opacity: 0.6,
                  transform: isClosed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              >
                <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Items */}
            {!isClosed && (
              <ul style={{ listStyle: 'none', margin: 0, padding: '0 0 4px' }}>
                {category.entries.map(entry => {
                  if (entry.kind === 'item') {
                    if (entry.navHidden) return null
                    const active = isActive(entry.href)
                    return (
                      <li key={entry.id}>
                        <Link
                          href={entry.href}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '7px 16px 7px 18px',
                            textDecoration: 'none',
                            fontSize: 13.5,
                            fontWeight: active ? 600 : 400,
                            color: active ? 'var(--sidebar-accent)' : 'var(--text-body)',
                            background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                            borderLeft: active ? '3px solid var(--sidebar-accent)' : '3px solid transparent',
                            borderRadius: '0 8px 8px 0',
                            transition: 'background 0.12s, color 0.12s',
                          }}
                          onMouseEnter={e => {
                            if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover-bg)'
                          }}
                          onMouseLeave={e => {
                            if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                          }}
                        >
                          {active ? (
                            <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor" style={{ flexShrink: 0 }}>
                              <circle cx="3" cy="3" r="3" />
                            </svg>
                          ) : (
                            <svg width="6" height="6" viewBox="0 0 6 6" fill="none" style={{ flexShrink: 0 }}>
                              <circle cx="3" cy="3" r="2.5" stroke="currentColor" strokeOpacity="0.35" />
                            </svg>
                          )}
                          {entry.label}
                        </Link>
                      </li>
                    )
                  }

                  // Group (collapsible sub-section)
                  const group = entry as SidebarGroup
                  const isGroupOpen = openGroups.has(group.id)
                  const groupHasActive = group.items.some(i => isActive(i.href))
                  return (
                    <li key={group.id}>
                      <button
                        onClick={() => toggleGroup(group.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '7px 16px 7px 18px',
                          background: groupHasActive && !isGroupOpen ? 'var(--sidebar-active-bg)' : 'none',
                          border: 'none',
                          borderLeft: groupHasActive && !isGroupOpen ? '3px solid var(--sidebar-accent)' : '3px solid transparent',
                          borderRadius: '0 8px 8px 0',
                          cursor: 'pointer',
                          fontSize: 13.5,
                          fontWeight: groupHasActive ? 600 : 400,
                          color: groupHasActive ? 'var(--sidebar-accent)' : 'var(--text-body)',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <svg width="6" height="6" viewBox="0 0 6 6" fill="none" style={{ flexShrink: 0 }}>
                            <circle cx="3" cy="3" r="2.5" stroke="currentColor" strokeOpacity="0.35" />
                          </svg>
                          {group.label}
                        </span>
                        <svg
                          width="10" height="10" viewBox="0 0 10 10" fill="none"
                          style={{
                            flexShrink: 0,
                            color: 'var(--text-subtle)',
                            transform: isGroupOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.18s ease',
                          }}
                        >
                          <path d="M1.5 3.5L5 7L8.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      {isGroupOpen && (
                        <ul style={{ listStyle: 'none', margin: 0, padding: '2px 0 4px' }}>
                          {group.items.map(item => {
                            const active = isActive(item.href)
                            return (
                              <li key={item.id}>
                                <Link
                                  href={item.href}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '6px 16px 6px 34px',
                                    textDecoration: 'none',
                                    fontSize: 13,
                                    fontWeight: active ? 600 : 400,
                                    color: active ? 'var(--sidebar-accent)' : 'var(--text-muted)',
                                    background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                                    borderLeft: active ? '3px solid var(--sidebar-accent)' : '3px solid transparent',
                                    borderRadius: '0 8px 8px 0',
                                  }}
                                  onMouseEnter={e => {
                                    if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover-bg)'
                                  }}
                                  onMouseLeave={e => {
                                    if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                                  }}
                                >
                                  <svg width="4" height="4" viewBox="0 0 4 4" fill="currentColor" style={{ flexShrink: 0, opacity: 0.4 }}>
                                    <circle cx="2" cy="2" r="2" />
                                  </svg>
                                  {item.label}
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
