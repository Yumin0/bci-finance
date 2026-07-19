import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

// 分享連結分流（Q22c）第 4 種落點：無檢視權限的提示頁。
// 刻意不默默跳首頁（使用者會以為連結壞了），也不露出任何單子內容。
export default function ShareNoAccess() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 40 }}>🔒</div>
      <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-heading)' }}>你沒有這張單的檢視權限</p>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>這條分享連結指向的單據不在你的權限範圍內，若有疑問請聯絡分享連結給你的人。</p>
      <Link href="/" className={buttonVariants({ variant: 'outline' })}>回首頁</Link>
    </div>
  )
}
