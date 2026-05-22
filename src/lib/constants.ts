// 暫時使用假 UUID，待串接 Supabase Auth 後替換為 session.user.id
export const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001'

export const FUNDS_STATUS = {
  PENDING:  'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const

export type FundsStatus = typeof FUNDS_STATUS[keyof typeof FUNDS_STATUS]

export const PAYMENT_STATUS = {
  DRAFT: '草稿',
  PENDING_STEP1: '新單-課級',
  REJECTED_STEP1: '未核准-課級',
  PENDING_STEP2: '新單-處級',
  REJECTED_STEP2: '未核准-處級',
  PENDING_STEP3: '新單-第三處支出課',
  REJECTED_STEP3: '未核准-第三處支出課',
  PENDING_STEP4: '新單-第三處處長',
  REJECTED_STEP4: '未核准-第三處處長',
  APPROVED: '已核准-第三處處長',
} as const

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS]
