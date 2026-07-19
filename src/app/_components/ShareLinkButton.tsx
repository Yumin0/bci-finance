'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

// 一鍵複製分享連結（優先序2 列22）：複製的是中介轉址路由（/{module}/share/{id}），
// 點的人依身份分流（審核人→審核頁、申請人→自己的單、有查閱權限→唯讀、皆非→提示頁）
export default function ShareLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // 舊瀏覽器/非安全來源退回：用暫時 textarea 複製
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button type="button" variant="outline" onClick={handleCopy}>
      {copied ? '✓ 已複製連結' : '複製分享連結'}
    </Button>
  )
}
