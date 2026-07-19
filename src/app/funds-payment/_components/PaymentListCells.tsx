import Link from 'next/link'
import { TableCell } from '@/components/ui/table'
import { FundsPayment } from '@/lib/types'

// 付款憑單一般列表（我的付款憑單／首頁分頁／全部付款紀錄）對齊筑今的欄位。
// 「狀態」欄各頁自行處理（因 stepName 來源不同），此元件負責狀態之後的 8 欄。
// 發票憑證欄已移除（2026-07-20，外層列表不看附檔、只留內層詳細頁附件欄位）。
export const PAYMENT_LIST_COLUMNS_AFTER_STATUS = [
  '採購單號',
  '費用項目',
  '項目',
  '付款對象',
  '付款方式',
  '申請金額',
  '核准金額',
  '實際付款金額',
] as const

// 本元件實際用到的付款憑單欄位（讓完整 FundsPayment 與歷史紀錄的精簡憑單資料都能傳入）
export type PaymentListRow = Pick<
  FundsPayment,
  'id' | 'status' | 'purchase_order_number' | 'expense_item' | 'name' | 'extra_data' | 'payment_method' | 'approved_amount' | 'amount'
>

export function PaymentListCells({
  r,
  payeeLabel,
  hrefBase = '/funds-payment/my-payment',
}: {
  r: PaymentListRow
  payeeLabel: string | null
  // 採購單號連結目標；一般列表指向明細頁，審核管理頁指向審核頁（/funds-payment/review/check）
  hrefBase?: string
}) {
  const approved = r.approved_amount
  // 實際付款金額：只有「已付款」才顯示（＝核准金額），其餘顯示「-」
  const actualPaid = r.status === 'paid' ? (r.approved_amount ?? r.amount) : null

  return (
    <>
      <TableCell>
        <Link
          href={`${hrefBase}/${r.id}`}
          className="text-sm text-primary underline underline-offset-4"
        >
          {r.status === 'draft' ? '繼續編輯' : (r.purchase_order_number ?? '-')}
        </Link>
      </TableCell>
      <TableCell>{r.expense_item ?? '-'}</TableCell>
      <TableCell>{r.name}</TableCell>
      <TableCell>{payeeLabel ? (r.extra_data?.[payeeLabel] ?? '-') : '-'}</TableCell>
      <TableCell>{r.payment_method ?? '-'}</TableCell>
      <TableCell className="whitespace-nowrap">{r.amount != null ? r.amount.toLocaleString() : '-'}</TableCell>
      <TableCell className="whitespace-nowrap">{approved != null ? approved.toLocaleString() : '-'}</TableCell>
      <TableCell className="whitespace-nowrap">{actualPaid != null ? actualPaid.toLocaleString() : '-'}</TableCell>
    </>
  )
}
