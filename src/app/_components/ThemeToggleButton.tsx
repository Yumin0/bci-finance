'use client'

import { useTheme, type Theme } from './ThemeProvider'

const NEXT: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

const LABEL: Record<Theme, string> = {
  light: '淺色模式（點擊切換深色）',
  dark: '深色模式（點擊切換自動）',
  system: '自動跟隨系統（點擊切換淺色）',
}

export default function ThemeToggleButton() {
  const { theme, resolvedDark, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(NEXT[theme])}
      title={LABEL[theme]}
      style={{
        position: 'relative',
        width: 36,
        height: 36,
        borderRadius: 8,
        border: '1px solid var(--border-color)',
        background: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}
    >
      {resolvedDark ? (
        // Moon icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      ) : (
        // Sun icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}

      {theme === 'system' && (
        <span
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 14,
            height: 14,
            borderRadius: 7,
            background: '#ADCFFF',
            color: '#111214',
            fontSize: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--bg-header)',
          }}
        >
          A
        </span>
      )}
    </button>
  )
}
