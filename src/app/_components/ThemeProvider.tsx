'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const ThemeContext = createContext<{
  theme: Theme
  resolvedDark: boolean
  setTheme: (t: Theme) => void
}>({ theme: 'system', resolvedDark: false, setTheme: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    return (window.localStorage.getItem('bci-theme') as Theme | null) ?? 'system'
  })
  const [resolvedDark, setResolvedDark] = useState(false)

  useEffect(() => {
    const root = document.documentElement

    function apply() {
      const dark = theme === 'dark'
        ? true
        : theme === 'light'
          ? false
          : window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', dark)
      setResolvedDark(dark)
    }

    apply()

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [theme])

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem('bci-theme', t)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedDark, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
