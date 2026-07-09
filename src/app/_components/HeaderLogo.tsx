'use client'

import { useTheme } from './ThemeProvider'

export default function HeaderLogo() {
  const { resolvedDark } = useTheme()

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedDark ? '/logo-mark-white.png' : '/logo-mark-black.png'}
      alt="logo"
      style={{ height: 30, width: 'auto', flexShrink: 0 }}
    />
  )
}
