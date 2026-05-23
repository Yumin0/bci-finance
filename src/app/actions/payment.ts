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

  // 根據出款帳號查找對應的付款憑單審核流程範本
  let flowTemplateId: number | null = null
  if (record.payment_account) {
    const { data: paOpt } = await supabase
      .from('dropdown_options')
      .select('id')
      .eq('field', 'payment_account')
      .eq('label', record.payment_account)
      .maybeSingle()
    if (paOpt?.id) {
      const { data: tpa } = await supabase
        .from('template_payment_accounts')
        .select('template_id, approval_flow_templates!inner(id, form_type, is_active)')
        .eq('payment_account_option_id', paOpt.id)
        .eq('approval_flow_templates.form_type', 'payment_voucher')
        .eq('approval_flow_templates.is_active', true)
        .maybeSingle()
      if (tpa) flowTemplateId = tpa.template_id
    }
  }

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
    flow_template_id: flowTemplateId,
    current_step: null,
  })

  if (error) return { error: error.message }
  return { error: null }
}

export async function confirmPayment(id: number): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('funds_payment')
    .update({ status: PAYMENT_STATUS.PAID, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', PAYMENT_STATUS.APPROVED)

  if (error) return { error: error.message }
  return { error: null }
}

export async function submitMyPayment(id: number): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  // 查出付款憑單的出款帳號，重新確認對應範本
  const { data: payment } = await supabase
    .from('funds_payment')
    .select('payment_account')
    .eq('id', id)
    .single()

  let flowTemplateId: number | null = null
  if (payment?.payment_account) {
    const { data: paOpt } = await supabase
      .from('dropdown_options')
      .select('id')
      .eq('field', 'payment_account')
      .eq('label', payment.payment_account)
      .maybeSingle()
    if (paOpt?.id) {
      const { data: tpa } = await supabase
        .from('template_payment_accounts')
        .select('template_id, approval_flow_templates!inner(id, form_type, is_active)')
        .eq('payment_account_option_id', paOpt.id)
        .eq('approval_flow_templates.form_type', 'payment_voucher')
        .eq('approval_flow_templates.is_active', true)
        .maybeSingle()
      if (tpa) flowTemplateId = tpa.template_id
    }
  }

  const { error } = await supabase
    .from('funds_payment')
    .update({
      status: PAYMENT_STATUS.PENDING,
      current_step: 1,
      flow_template_id: flowTemplateId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('created_by', String(session.userId))

  if (error) return { error: error.message }
  return { error: null }
}
