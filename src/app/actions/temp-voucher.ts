'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/session'
import { notifyReviewersForStep } from './notifications'
import { getAllocationOrgContext } from './approval-flow'

// 注意不可用 maybeSingle()：若同時存在多個啟用中的暫付款範本，
// maybeSingle 會回傳錯誤且被靜默忽略，導致 flow_template_id 存成 null、憑單無人可審
async function findTempVoucherTemplateId(): Promise<number | null> {
  const { data: tpls, error } = await supabase
    .from('approval_flow_templates')
    .select('id')
    .eq('form_type', 'temp_voucher')
    .eq('is_active', true)
    .order('id')
    .limit(1)
  if (error) console.error('findTempVoucherTemplateId error:', error.message)
  return tpls?.[0]?.id ?? null
}

export async function createTempVoucher(
  fundsPaymentId: number,
  fields: Record<string, string>
): Promise<{ id: number | null; error: string | null }> {
  const session = await getSession()
  if (!session) return { id: null, error: '請先登入' }

  const flowTemplateId = await findTempVoucherTemplateId()

  const { data, error } = await supabase
    .from('temp_vouchers')
    .insert({
      funds_payment_id: fundsPaymentId,
      date: fields['date'] || null,
      apply_division: fields['apply_division'] || null,
      apply_section: fields['apply_section'] || null,
      applicant: fields['applicant'] || null,
      apply_role: fields['apply_role'] || null,
      amount: fields['amount'] ? Number(fields['amount']) : null,
      note: fields['note'] || null,
      status: 'draft',
      flow_template_id: flowTemplateId,
      current_step: null,
      created_by: session.userId,
    })
    .select('id')
    .single()

  if (error) return { id: null, error: error.message }
  return { id: data.id, error: null }
}

export async function submitTempVoucher(id: number): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  const flowTemplateId = await findTempVoucherTemplateId()

  const { error } = await supabase
    .from('temp_vouchers')
    .update({
      status: 'pending',
      current_step: 1,
      flow_template_id: flowTemplateId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('created_by', session.userId)
    .eq('status', 'draft')

  if (error) return { error: error.message }

  if (flowTemplateId) {
    ;(async () => {
      const { data: voucher } = await supabase
        .from('temp_vouchers')
        .select('funds_payment_id')
        .eq('id', id)
        .single()
      let itemName: string | null = null
      let allocationId: number | null = null
      if (voucher?.funds_payment_id) {
        const { data: relatedPayment } = await supabase
          .from('funds_payment')
          .select('name, funds_allocation_id')
          .eq('id', voucher.funds_payment_id)
          .single()
        itemName = relatedPayment?.name ?? null
        allocationId = relatedPayment?.funds_allocation_id ?? null
      }
      const orgContext = await getAllocationOrgContext(allocationId)
      await notifyReviewersForStep({
        templateId: flowTemplateId,
        stepNumber: 1,
        applyDivisionId: orgContext.applyDivisionId,
        applySectionId: orgContext.applySectionId,
        title: '暫付款沖銷憑單待審核',
        itemName,
        body: null,
        link: `/funds-voucher/review/check/${id}`,
        tempVoucherId: id,
      })
    })().catch(e => console.error('Notification error:', e))
  }

  return { error: null }
}
