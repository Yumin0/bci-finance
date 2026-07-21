// 完成度彩色標籤（2026-07-21 列35）：資金分配「尚有剩餘」、付款憑單（預支類）「沖銷狀態」
// 讓職員從列表就能一眼看出還有沒有轉單/沖銷完成，不用逐筆點進去看
import type { VoucherCompletionStatus } from '@/lib/paymentVoucherStatus'

export type { VoucherCompletionStatus }

// 狀態欄裡「主狀態 + 完成度標籤」的堆疊容器：明確用 flex column + gap 直向排列，
// 不能只把兩個 inline-block 標籤直接相鄰塞在儲存格裡（欄寬不夠時會擠在一起甚至視覺重疊）
export function BadgeStack({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      {children}
    </div>
  )
}

export function RemainingBadge({ remaining }: { remaining: number }) {
  if (remaining <= 0) return null
  return (
    <span style={{
      display: 'inline-block', marginLeft: 6, fontSize: 11, padding: '2px 8px', borderRadius: 4,
      background: 'rgba(255, 159, 10, 0.15)', color: '#c2740a', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      尚有剩餘
    </span>
  )
}

const VOUCHER_STATUS_MAP: Record<VoucherCompletionStatus, { label: string; bg: string; color: string }> = {
  none: { label: '未建立沖銷', bg: 'rgba(241, 65, 108, 0.12)', color: '#f1416c' },
  draft: { label: '沖銷草稿中', bg: 'rgba(148, 163, 184, 0.18)', color: '#64748b' },
  pending: { label: '沖銷審核中', bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' },
  approved: { label: '沖銷已完成', bg: 'rgba(80, 201, 137, 0.15)', color: '#50c989' },
}

export function VoucherStatusBadge({ status }: { status: VoucherCompletionStatus }) {
  const entry = VOUCHER_STATUS_MAP[status]
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 4,
      background: entry.bg, color: entry.color, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {entry.label}
    </span>
  )
}
