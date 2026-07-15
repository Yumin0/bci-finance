import { DetailSummaryItem } from '@/app/_components/RecordDetailView'
import { calcReturnAmount } from '@/lib/voucherReturnAmount'

/**
 * 沖銷憑單付款明細標頭右側的金額彙總：實際撥款／沖銷金額合計／回存金額。
 * 建單頁、詳細頁、審核頁共用——要改這三個數字的顯示改這裡一次連動。
 *
 * 「回存金額」是同仁要還回公司的錢（實際撥款 − 實際花費），
 * 不可改叫「剩餘金額」（那是資金分配的未用額度，意思完全不同）。
 * 負數＝填超過預支金額，以紅字提示（後端 createTempVoucher 會擋，送不出去）。
 */
export default function VoucherReturnSummary({
  paidAmount, voucherTotal,
}: { paidAmount: number; voucherTotal: number }) {
  const returnAmount = calcReturnAmount(paidAmount, voucherTotal)
  return (
    <>
      <DetailSummaryItem label="實際撥款" value={paidAmount.toLocaleString()} />
      <DetailSummaryItem label="沖銷金額合計" value={voucherTotal.toLocaleString()} />
      <DetailSummaryItem label="回存金額" value={returnAmount.toLocaleString()} danger={returnAmount < 0} />
    </>
  )
}
