'use server'

import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { FundsPayment, FundsAllocation } from '@/lib/types'
import { PAYMENT_STATUS } from '@/lib/constants'

export async function getMyPayment(id: number): Promise<{ data: FundsPayment | null; error: string | null }> {
  const session = await getSession()
  if (!session) return { data: null, error: '請先登入' }

  const { data, error } = await supabase
    .from('funds_payment')
    .select('*')
    .eq('id', id)
    .eq('created_by', String(session.userId))
    .single()

  if (error) return { data: null, error: '找不到此付款憑單' }
  return { data: data as FundsPayment, error: null }
}

export async function createPayment(
  allocationId: number,
  paymentMethod: string
): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  const { data: alloc, error: allocErr } = await supabase
    .from('funds_allocation')
    .select('*')
    .eq('id', allocationId)
    .single()

  if (allocErr || !alloc) return { error: '找不到資金分配申請單' }

  const record = alloc as FundsAllocation

  const { error } = await supabase.from('funds_payment').insert({
    funds_allocation_id: record.id,
    name: record.name,
    amount: record.amount,
    date: record.date,
    institution: record.institution,
    payment_account: record.payment_account,
    expense_item: record.expense_item,
    category: record.category,
    note: record.note,
    apply_division: record.apply_division,
    apply_section: record.apply_section,
    applicant: record.applicant,
    apply_role: record.apply_role,
    payment_method: paymentMethod || null,
    created_by: String(session.userId),
    status: PAYMENT_STATUS.DRAFT,
  })

  if (error) return { error: error.message }
  return { error: null }
}

export async function submitMyPayment(id: number): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  const { error } = await supabase
    .from('funds_payment')
    .update({ status: PAYMENT_STATUS.PENDING_STEP1, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('created_by', String(session.userId))

  if (error) return { error: error.message }
  return { error: null }
}
