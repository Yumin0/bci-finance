'use client'

import { useState, useCallback, useRef, type ReactNode } from 'react'
import ConfirmDialog from './ConfirmDialog'

// 全站共用確認彈窗 hook：取代同步的 window.confirm()。
// window.confirm 會跳出瀏覽器原生彈窗（與網址列同源、抽離系統視覺、不跟隨深淺色主題）；
// 這個 hook 回傳一個 Promise 版 confirm(...)，await 它即可拿到使用者按「確定/取消」的結果，
// 讓原本 `if (!confirm('...')) return` 的流程幾乎 1:1 改成 `if (!(await confirm('...'))) return`。
//
// 用法：
//   const [confirm, confirmDialog] = useConfirm()
//   async function handleDelete() {
//     if (!(await confirm({ message: '確定刪除？', danger: true, confirmText: '刪除' }))) return
//     ...
//   }
//   // JSX 任一處放：{confirmDialog}
// message 可直接傳字串（等同 { message }），採預設「確定/取消」按鈕樣式。

type ConfirmOptions = {
  message: string
  title?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

export function useConfirm(): [
  (opts: ConfirmOptions | string) => Promise<boolean>,
  ReactNode,
] {
  const [state, setState] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions | string) => {
    setState(typeof opts === 'string' ? { message: opts } : opts)
    return new Promise<boolean>(resolve => { resolverRef.current = resolve })
  }, [])

  const settle = useCallback((result: boolean) => {
    setState(null)
    resolverRef.current?.(result)
    resolverRef.current = null
  }, [])

  const confirmDialog = (
    <ConfirmDialog
      open={state !== null}
      message={state?.message ?? ''}
      title={state?.title}
      confirmText={state?.confirmText}
      cancelText={state?.cancelText}
      danger={state?.danger}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  )

  return [confirm, confirmDialog]
}
