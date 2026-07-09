'use client'

import { useEffect, useState } from 'react'

export function useColumnVisibility<K extends string>(storageKey: string, allKeys: K[]) {
  const [visibleCols, setVisibleCols] = useState<Set<K>>(new Set(allKeys))

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed: K[] = JSON.parse(stored)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists after mount; deferring here avoids an SSR hydration mismatch
        setVisibleCols(new Set(parsed))
      }
    } catch {}
  }, [storageKey])

  function toggleCol(key: K) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      localStorage.setItem(storageKey, JSON.stringify([...next]))
      return next
    })
  }

  return { visibleCols, toggleCol }
}
