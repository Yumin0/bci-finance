import { supabaseAdmin } from '@/lib/supabaseAdmin'

// 付款憑單（預支類）對應暫付款沖銷的完成度（2026-07-21 列35）
export type VoucherCompletionStatus = 'none' | 'draft' | 'pending' | 'approved'

// 批次查詢一批付款憑單目前沖銷進度到哪，供列表頁一次算好、不用逐筆點進去看。
// 比照憑單詳細頁既有邏輯：一張憑單同時間只會有一張「活的」沖銷（非 rejected），沒有活的沖銷視為「未建立」。
// 回傳純物件（非 Map）：Server Component 傳給 Client Component 的 props 不能是 Map，會序列化失敗。
export async function getVoucherCompletionStatuses(
  payments: Array<{ id: number; category: string | null }>
): Promise<Record<number, VoucherCompletionStatus>> {
  const tempIds = payments.filter(p => p.category === '預支').map(p => p.id)
  const result: Record<number, VoucherCompletionStatus> = {}
  if (tempIds.length === 0) return result

  const { data } = await supabaseAdmin
    .from('temp_vouchers')
    .select('funds_payment_id, status')
    .in('funds_payment_id', tempIds)
    .neq('status', 'rejected')

  for (const row of (data ?? []) as Array<{ funds_payment_id: number; status: string }>) {
    result[row.funds_payment_id] = row.status as VoucherCompletionStatus
  }
  for (const id of tempIds) {
    if (!(id in result)) result[id] = 'none'
  }
  return result
}
