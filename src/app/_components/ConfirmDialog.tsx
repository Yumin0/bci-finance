'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'

// 全站共用「操作確認」彈窗：取代瀏覽器原生 confirm()（原生彈窗長相與網址列同源、
// 抽離系統視覺，且無法配合深淺色主題）。改為畫面中央彈窗，跟 ErrorDialog 同一套
// 視覺語言（var(--bg-card) 背景、圓角、遮罩），配「取消／確定」兩顆按鈕。
// 刪除類危險操作傳 danger 讓「確定」鈕變紅色實心。
//
// 用法（以 state 控制開關，取代同步的 if (!confirm('...')) return）：
//   const [askDelete, setAskDelete] = useState(false)
//   ...按刪除時 setAskDelete(true)
//   <ConfirmDialog open={askDelete} danger
//     message="確定要刪除…？" confirmText="刪除"
//     onConfirm={() => { setAskDelete(false); doDelete() }}
//     onCancel={() => setAskDelete(false)} />

export default function ConfirmDialog({
  open,
  message,
  title = '請確認',
  confirmText = '確定',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  message: string
  title?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  // portal 需要 document，SSR/首次渲染時尚未 mount，先不渲染避免 hydration 錯誤
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open || !mounted) return null

  // 以 portal 掛到 document.body：讓 {confirmDialog} 可放在表格列等任何位置而不破壞 HTML 結構
  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          maxWidth: 460, width: '100%',
          padding: '24px 28px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-heading, var(--text-body))', marginBottom: 12 }}>
          {title}
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-body)', whiteSpace: 'pre-line', lineHeight: 1.8 }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <Button type="button" variant="outline" onClick={onCancel}>{cancelText}</Button>
          <Button
            type="button"
            onClick={onConfirm}
            style={danger ? { background: '#dc2626', color: '#fff' } : undefined}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
