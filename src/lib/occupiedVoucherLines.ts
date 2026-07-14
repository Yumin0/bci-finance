import 'server-only'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { emailToEnglishName } from '@/lib/userNames'
import { getPaymentOccupiedAmount, type PaymentForRemaining } from '@/lib/fundsAllocationRemaining'

// 「這張資金分配單底下有哪些付款憑單在佔用額度」的點名式清單（server 端共用）。
// 用在超額/下修被擋的錯誤訊息裡，讓使用者具體知道：哪一天、誰、哪張單（採購單號）、
// 什麼狀態、各佔多少——而不是只看到一句「超過剩餘額度」。
// viewerId：目前操作的使用者，建單人是本人時顯示「你自己」。
// excludePaymentId：編輯既有憑單時排除它自己。

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  pending: '審核中',
  approved: '已核准待付款',
  paid: '已付款',
}

function occupiedDateLabel(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: 'long', day: 'numeric' })
}

export type OccupiedVoucherSummary = {
  lines: string[]        // 一張憑單一行，逐張點名
  creators: string[]     // 去重後的建單人名字（本人為「你自己」），供「請 XXX 處理」句使用
  occupiedTotal: number  // 佔用金額加總
}

export async function buildOccupiedVoucherSummary(
  allocationId: number,
  opts: { viewerId?: string | null; excludePaymentId?: number } = {}
): Promise<OccupiedVoucherSummary> {
  const { data: payments } = await supabase
    .from('funds_payment')
    .select('id, name, status, amount, approved_amount, purchase_order_number, created_at, created_by')
    .eq('funds_allocation_id', allocationId)

  const occupying = (payments ?? [])
    .filter(p => p.id !== opts.excludePaymentId)
    .map(p => ({ ...p, occupied: getPaymentOccupiedAmount(p as PaymentForRemaining) }))
    .filter(p => p.occupied > 0)

  if (occupying.length === 0) return { lines: [], creators: [], occupiedTotal: 0 }

  const creatorIds = Array.from(new Set(occupying.map(p => parseInt(String(p.created_by), 10)).filter(n => !isNaN(n))))
  const { data: users } = await supabase.from('app_users').select('id, name, email').in('id', creatorIds)
  const nameOf = (createdBy: string): string => {
    if (opts.viewerId != null && String(createdBy) === String(opts.viewerId)) return '你自己'
    const u = (users ?? []).find(u => String(u.id) === String(createdBy))
    return u ? (u.name || emailToEnglishName(u.email ?? '')) : '（查不到建單人）'
  }

  // 佔用金額放前面、採購單號與狀態收到行尾括號，閱讀重點（誰、佔多少）不被單號打斷；
  // 採購單號用 [文字](連結) 標記連到憑單詳細頁（ErrorDialog 會渲染成超連結、開新分頁）
  const lines = occupying.map(p => {
    const who = nameOf(String(p.created_by))
    const po = p.purchase_order_number ? `採購單號 [${p.purchase_order_number}](/funds-payment/my-payment/${p.id})、` : ''
    const statusLabel = STATUS_LABEL[p.status] ?? p.status
    return `・${occupiedDateLabel(p.created_at)} ${who} 建立的「${p.name ?? '未命名'}」付款憑單，佔用 NT$${p.occupied.toLocaleString()}（${po}${statusLabel}）`
  })
  const creators = Array.from(new Set(occupying.map(p => nameOf(String(p.created_by)))))
  const occupiedTotal = occupying.reduce((sum, p) => sum + p.occupied, 0)
  return { lines, creators, occupiedTotal }
}
