'use client'

// 審核清單「快速審核」按鈕（比照筑今系統：放大、紅底不核准／綠底核准，上下排列等寬）
// 三個模組的審核管理列表若需要列內快速審核，統一走這個共用元件，改樣式一次連動
export default function QuickReviewButtons({
  onReject,
  onApprove,
  disabled = false,
  approving = false,
}: {
  onReject: () => void
  onApprove: () => void
  disabled?: boolean
  approving?: boolean
}) {
  return (
    <div className="flex flex-col items-stretch gap-2">
      <button
        onClick={onReject}
        disabled={disabled}
        className="whitespace-nowrap rounded-md bg-[#f1416c] px-5 py-2 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        不核准
      </button>
      <button
        onClick={onApprove}
        disabled={disabled}
        className="whitespace-nowrap rounded-md bg-[#50cd89] px-5 py-2 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {approving ? '處理中…' : '核准'}
      </button>
    </div>
  )
}
