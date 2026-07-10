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
    <div className="pb-4 pt-2">
      {config.map((category, ci) => {
        const isClosed = closedCategories.has(category.id)
        return (
          <div key={category.id}>
            {ci > 0 && <div className="mx-4 my-1.5 h-px bg-border" />}

            {/* Category header */}
            <button
              onClick={() => toggleCategory(category.id)}
              className={`flex w-full cursor-pointer items-center justify-between gap-1 border-none bg-transparent pl-7 pr-4 text-left ${ci === 0 ? 'pb-1.5 pt-2' : 'pb-1.5 pt-3.5'}`}
            >
              <span className="text-[15px] font-bold leading-snug tracking-[0.03em] text-[var(--text-title)]">
                {category.label}
              </span>
              <svg
                width="12" height="12" viewBox="0 0 12 12" fill="none"
                className={`shrink-0 text-[var(--text-title)] opacity-60 transition-transform duration-200 ${isClosed ? '-rotate-90' : 'rotate-0'}`}
              >
                <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Items */}
            {!isClosed && (
              <ul className="m-0 list-none p-0 pb-1">
                {category.entries.map(entry => {
                  if (entry.kind === 'item') {
                    if (entry.navHidden) return null
                    const active = isActive(entry.href)
                    return (
                      <li key={entry.id}>
                        <Link
                          href={entry.href}
                          className={`mx-4 flex items-center gap-2.5 rounded-lg py-[11px] pl-7 pr-3 text-sm leading-normal no-underline transition-colors duration-100 ${
                            active
                              ? 'bg-[var(--sidebar-item-active-bg)] font-bold text-[var(--sidebar-item-active-text)]'
                              : 'font-medium text-muted-foreground hover:bg-[var(--sidebar-hover-bg)] hover:text-foreground'
                          }`}
                        >
                          {active && (
                            <svg width="5" height="5" viewBox="0 0 6 6" fill="currentColor" className="shrink-0">
                              <circle cx="3" cy="3" r="3" />
                            </svg>
                          )}
                          {entry.label}
                        </Link>
                      </li>
                    )
                  }

                  // Group
                  const group = entry as SidebarGroup
                  const isGroupOpen = openGroups.has(group.id)
                  const groupHasActive = group.items.some(i => isActive(i.href))
                  return (
                    <li key={group.id}>
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className={`mx-4 flex w-[calc(100%-32px)] cursor-pointer items-center justify-between rounded-lg border-none py-[11px] pl-7 pr-3 text-left text-sm leading-normal transition-colors duration-100 ${
                          groupHasActive && !isGroupOpen
                            ? 'bg-[var(--sidebar-item-active-bg)] font-bold text-[var(--sidebar-item-active-text)]'
                            : 'bg-transparent font-medium text-muted-foreground hover:bg-[var(--sidebar-hover-bg)] hover:text-foreground'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          {groupHasActive && !isGroupOpen && (
                            <svg width="5" height="5" viewBox="0 0 6 6" fill="currentColor" className="shrink-0">
                              <circle cx="3" cy="3" r="3" />
                            </svg>
                          )}
                          {group.label}
                        </span>
                        <svg
                          width="10" height="10" viewBox="0 0 10 10" fill="none"
                          className={`shrink-0 text-muted-foreground transition-transform duration-[180ms] ${isGroupOpen ? 'rotate-0' : '-rotate-90'}`}
                        >
                          <path d="M1.5 3.5L5 7L8.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      {isGroupOpen && (
                        <ul className="m-0 list-none py-0.5">
                          {group.items.map(item => {
                            const active = isActive(item.href)
                            return (
                              <li key={item.id}>
                                <Link
                                  href={item.href}
                                  className={`mx-4 flex items-center gap-2.5 rounded-lg py-2 pl-10 pr-3 text-[13.5px] no-underline transition-colors duration-100 ${
                                    active
                                      ? 'bg-[var(--sidebar-item-active-bg)] font-bold text-[var(--sidebar-item-active-text)]'
                                      : 'font-medium text-muted-foreground hover:bg-[var(--sidebar-hover-bg)] hover:text-foreground'
                                  }`}
                                >
                                  {active && (
                                    <svg width="5" height="5" viewBox="0 0 6 6" fill="currentColor" className="shrink-0">
                                      <circle cx="3" cy="3" r="3" />
                                    </svg>
                                  )}
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
