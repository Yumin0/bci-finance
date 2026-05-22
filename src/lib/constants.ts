// 暫時使用假 UUID，待串接 Supabase Auth 後替換為 session.user.id
export const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001'

export const FUNDS_STATUS = {
  PENDING:  'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const

export type FundsStatus = typeof FUNDS_STATUS[keyof typeof FUNDS_STATUS]

export const PAYMENT_STATUS = {
  DRAFT:    'draft',
  PENDING:  'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS]
