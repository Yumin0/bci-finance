'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/session'
import { FundsPayment, FundsAllocation } from '@/lib/types'
import { PAYMENT_STATUS } from '@/lib/constants'
import { calcRemainingAmount, type PaymentForRemaining } from '@/lib/fundsAllocationRemaining'
import { notifyReviewersForStep } from './notifications'
import { getAllocationOrgContext } from './approval-flow'
import { recalcAllocationCloseStatus } from './fund-budget'

// 檢查這筆金額（新建或修改一筆憑單）是否會讓同一張資金分配單的佔用總額超過核准金額。
// excludePaymentId：修改既有憑單時，要先排除它自己原本佔用的金額，否則會拿自己當作額外佔用去卡自己。
async function checkAmountWithinRemaining(
  allocationId: number,
  amount: number,
  excludePaymentId?: number
): Promise<string | null> {
  const { data: alloc } = await supabase
    .from('funds_allocation')
    .select('approved_amount')
    .eq('id', allocationId)
    .single()
  if (!alloc) return '找不到資金分配申請單'

  const { data: payments } = await supabase
    .from('funds_payment')
    .select('id, status, amount, approved_amount')
    .eq('funds_allocation_id', allocationId)

  const others = (payments ?? []).filter(p => p.id !== excludePaymentId) as (PaymentForRemaining & { id: number })[]
  const remainingBeforeThis = calcRemainingAmount(alloc.approved_amount, others)
  if (amount > remainingBeforeThis) {
    return `金額超過剩餘可用額度（剩餘 NT$${remainingBeforeThis.toLocaleString()}）`
  }
  return null
}

// 依出款帳戶找對應的付款憑單審核流程範本。
// 注意不可用 maybeSingle()：同一出款帳戶若同時綁定多個啟用中範本，
// maybeSingle 會回傳錯誤且被靜默忽略，導致 flow_template_id 存成 null、憑單無人可審
async function findPaymentVoucherTemplateId(paymentAccount: string | null): Promise<number | null> {
  if (!paymentAccount) return null
  const { data: paOpt } = await supabase
    .from('dropdown_options')
    .select('id')
    .eq('field', 'payment_account')
    .eq('label', paymentAccount)
    .maybeSingle()
  if (!paOpt?.id) return null
  const { data: tpas, error } = await supabase
    .from('template_payment_accounts')
    .select('template_id, approval_flow_templates!inner(id, form_type, is_active)')
    .eq('payment_account_option_id', paOpt.id)
    .eq('approval_flow_templates.form_type', 'payment_voucher')
    .eq('approval_flow_templates.is_active', true)
    .order('template_id')
    .limit(1)
  if (error) console.error('findPaymentVoucherTemplateId error:', error.message)
  return tpas?.[0]?.template_id ?? null
}

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
  paymentMethod: string,
  extraData: Record<string, string> = {},
  category: string | null = null,
  amount?: number
): Promise<{ id: number | null; error: string | null }> {
  const session = await getSession()
  if (!session) return { id: null, error: '請先登入' }

  const { data: alloc, error: allocErr } = await supabase
    .from('funds_allocation')
    .select('*')
    .eq('id', allocationId)
    .single()

  if (allocErr || !alloc) return { id: null, error: '找不到資金分配申請單' }

  const record = alloc as FundsAllocation
  // 未傳入金額時（例如舊呼叫端）退回分配單全額，維持相容
  const paymentAmount = amount ?? record.amount

  const amountError = await checkAmountWithinRemaining(allocationId, paymentAmount)
  if (amountError) return { id: null, error: amountError }

  // 根據出款帳號查找對應的付款憑單審核流程範本
  const flowTemplateId = await findPaymentVoucherTemplateId(record.payment_account)

  const { data: inserted, error } = await supabase.from('funds_payment').insert({
    funds_allocation_id: record.id,
    name: record.name,
    amount: paymentAmount,
    date: record.date,
    institution: record.institution,
    payment_account: record.payment_account,
    expense_item: record.expense_item,
    // 類型（一般/預支）自 2026-07 起改在建立付款憑單時選擇；未傳入時退回申請單的舊值（相容舊資料）
    category: category ?? record.category,
    note: record.note,
    apply_division: record.apply_division,
    apply_section: record.apply_section,
    applicant: record.applicant,
    apply_role: record.apply_role,
    payment_method: paymentMethod || null,
    purchase_order_number: record.serial_number ? `${record.serial_number}001` : null,
    extra_data: { ...(record.extra_data ?? {}), ...extraData },
    created_by: String(session.userId),
    status: PAYMENT_STATUS.DRAFT,
    flow_template_id: flowTemplateId,
    current_step: null,
  }).select('id').single()

  if (error) return { id: null, error: error.message }
  return { id: inserted.id, error: null }
}

export async function updateDraftPayment(
  id: number,
  paymentMethod: string,
  extraData: Record<string, string>,
  category?: string,
  amount?: number
): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  if (amount !== undefined) {
    const { data: payment } = await supabase
      .from('funds_payment')
      .select('funds_allocation_id')
      .eq('id', id)
      .single()
    if (payment) {
      const amountError = await checkAmountWithinRemaining(payment.funds_allocation_id, amount, id)
      if (amountError) return { error: amountError }
    }
  }

  const { error } = await supabase
    .from('funds_payment')
    .update({
      payment_method: paymentMethod || null,
      extra_data: Object.keys(extraData).length > 0 ? extraData : null,
      ...(category !== undefined ? { category: category || null } : {}),
      ...(amount !== undefined ? { amount } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('created_by', String(session.userId))
    .eq('status', PAYMENT_STATUS.DRAFT)

  if (error) return { error: error.message }
  return { error: null }
}

export async function confirmPayment(id: number): Promise<{ error: string | null }> {
  const { data: updated, error } = await supabase
    .from('funds_payment')
    .update({ status: PAYMENT_STATUS.PAID, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', PAYMENT_STATUS.APPROVED)
    .select('funds_allocation_id')
    .single()

  if (error) return { error: error.message }

  if (updated?.funds_allocation_id) {
    await recalcAllocationCloseStatus(updated.funds_allocation_id).catch(e =>
      console.error('recalcAllocationCloseStatus error:', e)
    )
  }

  return { error: null }
}

export async function submitMyPayment(id: number): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  // 查出付款憑單的出款帳號，重新確認對應範本
  const { data: payment } = await supabase
    .from('funds_payment')
    .select('payment_account, name, funds_allocation_id')
    .eq('id', id)
    .single()

  const flowTemplateId = await findPaymentVoucherTemplateId(payment?.payment_account ?? null)

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

  if (flowTemplateId) {
    ;(async () => {
      const orgContext = await getAllocationOrgContext(payment?.funds_allocation_id)
      await notifyReviewersForStep({
        templateId: flowTemplateId,
        stepNumber: 1,
        applyDivisionId: orgContext.applyDivisionId,
        applySectionId: orgContext.applySectionId,
        title: '付款憑單待審核',
        body: payment?.name ?? null,
        link: `/funds-payment/review/check/${id}`,
        fundsPaymentId: id,
      })
    })().catch(e => console.error('Notification error:', e))
  }

  return { error: null }
}
