export type PaymentForRemaining = {
  status: string
  amount: number
  approved_amount: number | null
}

// 單張付款憑單目前佔用資金分配單額度的金額，依憑單狀態決定用哪個金額
export function getPaymentOccupiedAmount(p: PaymentForRemaining): number {
  if (p.status === 'rejected') return 0
  if (p.status === 'approved' || p.status === 'paid') return p.approved_amount ?? p.amount
  return p.amount // draft, pending
}

// 資金分配單剩餘金額 = 核准金額 − 所有相關付款憑單目前佔用的金額加總
export function calcRemainingAmount(
  approvedAmount: number | null,
  payments: PaymentForRemaining[]
): number {
  const occupied = payments.reduce((sum, p) => sum + getPaymentOccupiedAmount(p), 0)
  return (approvedAmount ?? 0) - occupied
}
