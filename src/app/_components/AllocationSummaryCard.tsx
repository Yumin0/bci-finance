import type { AllocationRemainingInfo } from '@/app/actions/fund-budget'
import { formatDate } from '@/lib/dateUtils'

// 付款憑單頁面頂部「已核准資金分配申請單」對照卡片。
// 對齊舊系統：完整母單摘要列（單號/處別/課別/日期/申請人/職稱/核准金額/剩餘金額/
// 幣別/機構/出款帳戶/費用項目/項目），讓職員建立/審核憑單時對照母單核准多少、還剩多少。
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
    <div style={{
      marginBottom: 20, padding: '14px 20px', border: '1px solid var(--border-color)',
      borderRadius: 10, background: 'var(--bg-card)', fontSize: 13,
    }}>
      <div style={{ fontWeight: 600, color: 'var(--text-title)', marginBottom: 10 }}>已核准資金分配申請單</div>
      <div style={{ display: 'flex', gap: 24, rowGap: 8, flexWrap: 'wrap' }}>
        {fields.map(([label, value]) => (
          <span key={label} style={{ color: 'var(--text-muted)' }}>
            {label} <strong style={{ color: 'var(--text-body)', fontWeight: 500 }}>{value}</strong>
          </span>
        ))}
      </div>
      <div style={{
        display: 'flex', gap: 24, rowGap: 8, flexWrap: 'wrap', marginTop: 10, paddingTop: 10,
        borderTop: '1px dashed var(--border-color)',
      }}>
        <span style={{ color: 'var(--text-muted)' }}>核准金額 <strong style={{ color: 'var(--text-body)' }}>{info.approvedAmount?.toLocaleString() ?? '-'}</strong></span>
        <span style={{ color: 'var(--text-muted)' }}>{remainingLabel} <strong style={{ color: 'var(--text-body)' }}>{info.remaining.toLocaleString()}</strong></span>
        {extraAmounts?.map(([label, value]) => (
          <span key={label} style={{ color: 'var(--text-muted)' }}>{label} <strong style={{ color: 'var(--text-body)' }}>{value}</strong></span>
        ))}
        {submitPreview !== undefined && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>本次填寫金額 <strong style={{ color: 'var(--text-body)' }}>{submitPreview.toLocaleString()}</strong></span>
            <span style={{ color: 'var(--text-muted)' }}>送出後剩餘 <strong style={{ color: info.remaining - submitPreview < 0 ? '#be123c' : 'var(--text-body)' }}>{(info.remaining - submitPreview).toLocaleString()}</strong></span>
          </>
        )}
      </div>
    </div>
  )
}
