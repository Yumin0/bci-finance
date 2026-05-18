'use client'

import { useTheme, type Theme } from './ThemeProvider'

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: '淺色', icon: '☀' },
  { value: 'dark',  label: '深色', icon: '☽' },
  { value: 'system', label: '裝置', icon: '□' },
]

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      border: '1px solid var(--border-color)',
      borderRadius: 24,
      padding: 3,
      gap: 2,
    }}>
      {OPTIONS.map(opt => {
        const active = theme === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            title={opt.label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 11px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: active ? 500 : 400,
              background: active ? 'var(--toggle-active-bg)' : 'transparent',
              color: active ? 'var(--toggle-active-text)' : 'var(--text-muted)',
              transition: 'background 0.15s, color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {active
              ? <span style={{ fontSize: 11 }}>✓</span>
              : <span style={{ fontSize: 12 }}>{opt.icon}</span>
            }
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
