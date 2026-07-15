import type { AllocationRemainingInfo } from '@/app/actions/fund-budget'
import { formatDate } from '@/lib/dateUtils'
import SummaryCard, { SummaryAmount } from './SummaryCard'

// 付款憑單頁面頂部「已核准資金分配申請單」對照卡片。
// 對齊舊系統：完整母單摘要列（單號/處別/課別/日期/申請人/職稱/核准金額/剩餘金額/
// 幣別/機構/出款帳戶/費用項目/項目），讓職員建立/審核憑單時對照母單核准多少、還剩多少。
// 卡片外框與金額列樣式共用 SummaryCard（暫付款沖銷的「預支的付款憑單」卡片亦同）。
//
// remainingLabel：建立頁用「目前剩餘」、編輯/審核既有憑單用「剩餘（不含本張）」。
// submitPreview：建立/草稿頁傳入本張目前填寫金額，額外顯示「本次填寫金額」與「送出後剩餘」即時試算；
//                詳細/審核頁不傳，卡片只顯示母單摘要 + 核准/剩餘。
export default function AllocationSummaryCard({
  info,
  remainingLabel,
  submitPreview,
  extraAmounts,
}: {
  info: AllocationRemainingInfo
  remainingLabel: string
  submitPreview?: number
  // 頁面專屬的額外金額欄（例如審核頁的「本張憑單金額」），接在核准/剩餘之後
  extraAmounts?: Array<[string, string]>
}) {
  const s = info.summary
  const fields: Array<[string, string]> = [
    ['資金分配單號', s.serialNumber ?? '-'],
    ['申請處別', s.applyDivision ?? '-'],
    ['申請課別', s.applySection ?? '-'],
    ['申請日期', s.date ? formatDate(s.date) : '-'],
    ['申請人', s.applicant ?? '-'],
    ['職稱', s.applyRole ?? '-'],
    ['幣別', s.currency ?? '-'],
    ['機構', s.institution ?? '-'],
    ['出款帳戶', s.paymentAccount ?? '-'],
    ['費用項目', s.expenseItem ?? '-'],
    ['項目', s.name ?? '-'],
  ]

  return (
    <SummaryCard
      title="已核准資金分配申請單"
      fields={fields}
      amounts={
        <>
          <SummaryAmount label="核准金額" value={info.approvedAmount?.toLocaleString() ?? '-'} />
          <SummaryAmount label={remainingLabel} value={info.remaining.toLocaleString()} />
          {extraAmounts?.map(([label, value]) => (
            <SummaryAmount key={label} label={label} value={value} />
          ))}
          {submitPreview !== undefined && (
            <>
              <SummaryAmount label="本次填寫金額" value={submitPreview.toLocaleString()} />
              <SummaryAmount
                label="送出後剩餘"
                value={(info.remaining - submitPreview).toLocaleString()}
                danger={info.remaining - submitPreview < 0}
              />
            </>
          )}
        </>
      }
    />
  )
}
