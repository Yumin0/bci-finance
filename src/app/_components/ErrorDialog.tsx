'use client'

import { useEffect, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

// 全站共用「操作被擋下」錯誤彈窗：
// 長表單的送出按鈕多在頁面底部，錯誤若只顯示在頁頂紅字，使用者按了送出
// 會以為沒反應（要捲回頂部才看得到）。改為畫面中央彈窗，不管捲到哪都看得到，
// 按「我知道了」才關閉；支援多行訊息（whiteSpace pre-line，例如核准金額
// 低於已佔用時逐張點名憑單的長訊息）。
// 訊息另支援兩種輕量標記：**粗體**（首尾重點句）與 [文字](路徑)（超額點名
// 清單的採購單號連到憑單詳細頁，開新分頁避免跳離填到一半的表單）；
// 純文字訊息不含標記時原樣顯示，不受影響。
// 用法：<ErrorDialog message={error} onClose={() => setError(null)} />
// message 為 null 時不渲染。

const INLINE_MARK = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g

function renderRichMessage(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let key = 0
  for (const m of text.matchAll(INLINE_MARK)) {
    const idx = m.index ?? 0
    if (idx > last) nodes.push(text.slice(last, idx))
    if (m[1] != null) {
      nodes.push(<strong key={key++} style={{ fontWeight: 700 }}>{m[1]}</strong>)
    } else {
      nodes.push(
        <a
          key={key++}
          href={m[3]}
          target="_blank"
          rel="noreferrer"
          style={{ color: '#2563eb', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          {m[2]}
        </a>
      )
    }
    last = idx + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}
export default function ErrorDialog({
  message,
  title = '無法完成操作',
  onClose,
}: {
  message: string | null
  title?: string
  onClose: () => void
}) {
  useEffect(() => {
    if (!message) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [message, onClose])

  if (!message) return null

  return (
    <div
      onClick={onClose}
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
          maxWidth: 560, width: '100%',
          maxHeight: '80vh', overflowY: 'auto',
          padding: '24px 28px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 700, color: '#dc2626', marginBottom: 12 }}>
          ⚠️ {title}
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-body)', whiteSpace: 'pre-line', lineHeight: 1.8 }}>
          {renderRichMessage(message)}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <Button type="button" onClick={onClose}>我知道了</Button>
        </div>
      </div>
    </div>
  )
}
