import type { FundsPayment } from '@/lib/types'
import { formatDate } from '@/lib/dateUtils'
import SummaryCard, { SummaryAmount } from '@/app/_components/SummaryCard'
import { paidAmountOf, calcReturnAmount } from '@/lib/voucherReturnAmount'

// 卡片只需要母憑單這幾個欄位；用精簡型別讓詳細頁/審核頁可以直接傳 Supabase embed 回來的
// 部分欄位物件（不必為了型別去 select 整張 funds_payment）。完整的 FundsPayment 也相容。
export type VoucherParentPayment = Pick<FundsPayment,
  | 'purchase_order_number' | 'apply_division' | 'apply_section' | 'date' | 'applicant'
  | 'apply_role' | 'institution' | 'payment_account' | 'expense_item' | 'name'
  | 'amount' | 'approved_amount'
>

/** 詳細頁／審核頁的 Supabase embed 要 select 的母憑單欄位（與 VoucherParentPayment 對齊） */
export const VOUCHER_PARENT_PAYMENT_COLUMNS =
  'purchase_order_number, apply_division, apply_section, date, applicant, apply_role, institution, payment_account, expense_item, name, amount, approved_amount'

// 暫付款沖銷憑單頁面頂部「預支的付款憑單」對照卡片（建單／詳細／審核三頁共用）。
// 沒有這塊的話，審核人只看得到「這次花了多少」，看不到「當初預支了多少」，
// 無從判斷沖銷金額合不合理、要回存多少。
//
// 標題刻意叫「預支的付款憑單」而不是筑今的「已核准資金分配申請單」——
// 這塊顯示的是母付款憑單的資料（第一欄就是付款憑單的採購單號），
// 筑今的標題是從付款憑單頁複製過來沒改乾淨，不跟著錯。
//
// voucherTotal：有值時額外顯示「沖銷金額合計」與「回存金額」（回存＝實際撥款 − 沖銷金額合計）。
export default function PaymentSummaryCard({
  payment, voucherTotal,
}: {
  payment: VoucherParentPayment
  voucherTotal?: number
}) {
  const fields: Array<[string, string]> = [
    ['付款憑單號', payment.purchase_order_number ?? '-'],
    ['申請處別', payment.apply_division ?? '-'],
    ['申請課別', payment.apply_section ?? '-'],
    ['申請日期', payment.date ? formatDate(payment.date) : '-'],
    ['申請人', payment.applicant ?? '-'],
    ['職稱', payment.apply_role ?? '-'],
    ['機構', payment.institution ?? '-'],
    ['出款帳戶', payment.payment_account ?? '-'],
    ['費用項目', payment.expense_item ?? '-'],
    ['項目', payment.name ?? '-'],
  ]

  const paidAmount = paidAmountOf(payment)
  const returnAmount = voucherTotal !== undefined ? calcReturnAmount(paidAmount, voucherTotal) : null

  return (
    <SummaryCard
      title="預支的付款憑單"
      fields={fields}
      amounts={
        <>
          {/* 實際撥款給同仁的錢＝審核核准金額，不是憑單當初填寫的金額 */}
          <SummaryAmount label="實際撥款" value={paidAmount.toLocaleString()} />
          {voucherTotal !== undefined && (
            <>
              <SummaryAmount label="沖銷金額合計" value={voucherTotal.toLocaleString()} />
              <SummaryAmount
                label="回存金額"
                value={returnAmount!.toLocaleString()}
                danger={returnAmount! < 0}
              />
            </>
          )}
        </>
      }
    />
  )
}
