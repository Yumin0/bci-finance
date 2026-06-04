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
              className={`flex w-full cursor-pointer items-center justify-between gap-1 border-none bg-transparent px-4 text-left ${ci === 0 ? 'pb-1.5 pt-2' : 'pb-1.5 pt-3.5'}`}
            >
              <span className="text-sm font-bold leading-snug tracking-[0.03em] text-[var(--sidebar-accent)]">
                {category.label}
              </span>
              <svg
                width="12" height="12" viewBox="0 0 12 12" fill="none"
                className={`shrink-0 text-[var(--sidebar-accent)] opacity-60 transition-transform duration-200 ${isClosed ? '-rotate-90' : 'rotate-0'}`}
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
                          className={`flex items-center gap-2 rounded-r-lg border-l-[3px] py-1.5 pl-4 pr-4 text-[13.5px] no-underline transition-colors duration-100 ${
                            active
                              ? 'border-[var(--sidebar-accent)] bg-[var(--sidebar-active-bg)] font-semibold text-[var(--sidebar-accent)]'
                              : 'border-transparent font-normal text-foreground hover:bg-[var(--sidebar-hover-bg)]'
                          }`}
                        >
                          {active ? (
                            <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor" className="shrink-0">
                              <circle cx="3" cy="3" r="3" />
                            </svg>
                          ) : (
                            <svg width="6" height="6" viewBox="0 0 6 6" fill="none" className="shrink-0">
                              <circle cx="3" cy="3" r="2.5" stroke="currentColor" strokeOpacity="0.35" />
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
                        className={`flex w-full cursor-pointer items-center justify-between rounded-r-lg border-l-[3px] border-none py-1.5 pl-4 pr-4 text-left text-[13.5px] transition-colors duration-100 ${
                          groupHasActive && !isGroupOpen
                            ? 'border-[var(--sidebar-accent)] bg-[var(--sidebar-active-bg)] font-semibold text-[var(--sidebar-accent)]'
                            : 'border-transparent bg-transparent font-normal text-foreground'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <svg width="6" height="6" viewBox="0 0 6 6" fill="none" className="shrink-0">
                            <circle cx="3" cy="3" r="2.5" stroke="currentColor" strokeOpacity="0.35" />
                          </svg>
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
                                  className={`flex items-center gap-2 rounded-r-lg border-l-[3px] py-1.5 pl-8 pr-4 text-[13px] no-underline transition-colors duration-100 ${
                                    active
                                      ? 'border-[var(--sidebar-accent)] bg-[var(--sidebar-active-bg)] font-semibold text-[var(--sidebar-accent)]'
                                      : 'border-transparent font-normal text-muted-foreground hover:bg-[var(--sidebar-hover-bg)]'
                                  }`}
                                >
                                  <svg width="4" height="4" viewBox="0 0 4 4" fill="currentColor" className="shrink-0 opacity-40">
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
