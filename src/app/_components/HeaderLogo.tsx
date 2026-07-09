'use client'

import { useTheme } from './ThemeProvider'

export default function HeaderLogo() {
  const { resolvedDark } = useTheme()

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedDark ? '/logo-mark-white.svg' : '/logo-mark-black.svg'}
      alt="logo"
      style={{ height: 20, width: 'auto', flexShrink: 0 }}
    />
  )
}
