// 暫付款沖銷「回存金額」計算（純函式，client/server 共用）
//
// ⚠️ 全站有兩個長很像、意思完全不同的金額，命名務必分清楚：
//   - 剩餘金額：資金分配單還沒被憑單用掉的額度（核准 − 佔用），見 lib/fundsAllocationRemaining.ts
//   - 回存金額：預支的錢沒花完、同仁要還回公司的部分（實際撥款 − 實際花費）← 本檔
// 筑今系統把回存金額也叫「剩餘金額加總」，我們刻意不跟——
// 2026-07-15 Yumin 拍板：這個數字畫面上一律叫「回存金額」，不可叫「剩餘金額」。
// 規格見 docs/core-logic/暫付款沖銷與回存金額_待確認事項.md

import { FundsPayment } from './types'

/**
 * 母付款憑單實際撥款給同仁的金額 ＝ 審核核准金額。
 * 舊資料沒有核准金額時退回憑單當初填寫的金額。
 */
export function paidAmountOf(payment: Pick<FundsPayment, 'amount' | 'approved_amount'>): number {
  return Number(payment.approved_amount ?? payment.amount) || 0
}

/**
 * 回存金額 ＝ 實際撥款 − 這張沖銷憑單各組「總額」加總。
 * 例：撥款 14,000、實際花費 9,380 → 回存 4,620。
 *
 * 正常情況 ≥ 0（沖銷金額上限＝實撥，超過會被 createTempVoucher 擋下）。
 * 但建單頁即時試算時使用者可能先填了超額的數字，此時回傳負數，
 * 由 UI 以紅字提示「超過預支金額」，讓他當下就知道送不出去。
 */
export function calcReturnAmount(paidAmount: number, voucherTotal: number): number {
  return paidAmount - voucherTotal
}

/**
 * 這張沖銷單的沖銷金額（＝實際花費）。
 * 優先用存檔值——createTempVoucher 已用各組「總額」加總算好存進 amount。
 * 2026-07-14 以前建立的舊沖銷單 amount 一律為 null（當時表單金額欄 fieldId 對不到 amount），
 * 這種情況退回即時從 extra_data 的群組資料加總（群組 instance 以欄位 label 為 key）。
 */
export function voucherAmountOf(record: {
  amount: number | null
  extra_data: Record<string, string> | null
}): number {
  if (record.amount != null) return Number(record.amount) || 0
  let sum = 0
  for (const [key, raw] of Object.entries(record.extra_data ?? {})) {
    if (!key.startsWith('__group_')) continue
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) for (const inst of parsed) sum += Number(inst?.['總額']) || 0
    } catch { /* 忽略解析錯誤 */ }
  }
  return sum
}
