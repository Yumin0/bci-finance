'use client'

import { useState } from 'react'
import SidebarNav from './SidebarNav'
import { type SidebarCategory } from '@/lib/sidebar-config'

const SIDEBAR_WIDTH = 280
const SIDEBAR_COLLAPSED_WIDTH = 0

export default function SidebarLayout({
  config,
  children,
}: {
  config: SidebarCategory[]
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH

  return (
    <div style={{ display: 'flex', marginTop: 75, minHeight: 'calc(100vh - 75px)' }}>
      {/* Sidebar */}
      <nav
        style={{
          position: 'fixed',
          top: 75,
          left: 0,
          bottom: 0,
          width: collapsed ? 0 : SIDEBAR_WIDTH,
          background: 'var(--bg-sidebar)',
          overflowY: collapsed ? 'hidden' : 'auto',
          overflowX: 'hidden',
          transition: 'width 0.22s ease',
          zIndex: 50,
        }}
      >
        {/* Collapse button — sits at the top right of the sidebar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 10px 0' }}>
          <button
            onClick={() => setCollapsed(true)}
            title="收合側欄"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              background: 'none',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <SidebarNav config={config} />
      </nav>

      {/* Expand button — visible only when sidebar is collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          title="展開側欄"
          style={{
            position: 'fixed',
            top: 85,
            left: 8,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            background: 'var(--bg-sidebar)',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--text-muted)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Main content */}
      <main
        style={{
          marginLeft: width,
          flex: 1,
          padding: '44px 68px 96px',
          transition: 'margin-left 0.22s ease',
          minWidth: 0,
        }}
      >
        {children}
      </main>
    </div>
  )
}
