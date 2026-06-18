'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: '組織架構', href: '/system-settings/org-structure' },
  { label: '審核流程管理', href: '/system-settings/approval-flows' },
]

export default function OrgApprovalTabNav() {
  const pathname = usePathname()
  return (
    <div className="flex border-b border-border">
      {TABS.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`-mb-px whitespace-nowrap border-b-2 px-5 py-2 text-sm font-medium transition-colors ${
            pathname === tab.href
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
