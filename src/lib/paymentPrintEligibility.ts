// 匯出付款憑單（列印版）開放條件（2026-07-20 財務拍板）：
// 課長/處長（org_role）關卡全數核准、單子輪到第一個「審核群組」步驟（如第三處支出課）起即可匯出，
// 不必等已付款——讓職員先印出紙本跑後續簽核；還沒審到的關卡（會計/CFO）人名留白給紙本簽。
// 不寫死步驟名稱：課處長＝org_role 步驟、支出課/財務＝approval_group 步驟，看型別判斷，範本改名不用改程式。
// 使用點：憑單詳細頁「匯出付款憑單」按鈕、列印頁防線、財務付款憑單管理頁「匯出」欄（client/server 共用純函式）。

export type PrintEligibilityStep = { step_number: number; reviewer_type?: string | null }

export function canExportPaymentVoucher(
  status: string | null | undefined,
  currentStep: number | null | undefined,
  steps: PrintEligibilityStep[] | null | undefined,
): boolean {
  if (status === 'approved' || status === 'paid') return true
  if (status !== 'pending') return false
  const groupStepNumbers = (steps ?? [])
    .filter(s => s.reviewer_type === 'approval_group')
    .map(s => s.step_number)
  // 範本沒有審核群組步驟（或步驟資料缺失）：退回保守行為，核准/已付款才可匯出
  if (groupStepNumbers.length === 0) return false
  return (currentStep ?? 0) >= Math.min(...groupStepNumbers)
}
