export type FundsAllocationColumnKey =
  | 'division'
  | 'section'
  | 'applicant'
  | 'role'
  | 'requestedAmount'
  | 'approvedAmount'
  | 'remainingAmount'
  | 'account'
  | 'expense'
  | 'name'

export const FUNDS_ALLOCATION_COLUMNS: { key: FundsAllocationColumnKey; label: string }[] = [
  { key: 'division', label: '申請處別' },
  { key: 'section', label: '申請課別' },
  { key: 'applicant', label: '申請人' },
  { key: 'role', label: '職務' },
  { key: 'requestedAmount', label: '申請金額' },
  { key: 'approvedAmount', label: '核准金額' },
  { key: 'remainingAmount', label: '剩餘金額' },
  { key: 'account', label: '出款帳戶' },
  { key: 'expense', label: '費用項目' },
  { key: 'name', label: '項目' },
]
