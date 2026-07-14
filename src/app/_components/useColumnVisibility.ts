'use client'

import { useEffect, useState } from 'react'

export function useColumnVisibility<K extends string>(storageKey: string, allKeys: K[], defaultKeys?: K[]) {
  const initial = defaultKeys ?? allKeys
  const [visibleCols, setVisibleCols] = useState<Set<K>>(new Set(initial))

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      // 有存過就套用，沒存過就回到預設值（切換 Tab 時才不會沿用前一個 Tab 的設定）
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists after mount; deferring here avoids an SSR hydration mismatch
      setVisibleCols(new Set(stored ? (JSON.parse(stored) as K[]) : initial))
    } catch {}
    // initial 不放進 deps：呼叫端每次 render 都會產生新陣列，放進去會無限重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
