'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/session'
import { notifyReviewersForStep } from './notifications'

export async function createTempVoucher(
  fundsPaymentId: number,
  fields: Record<string, string>
): Promise<{ id: number | null; error: string | null }> {
  const session = await getSession()
  if (!session) return { id: null, error: '請先登入' }

  const { data: tpl } = await supabase
    .from('approval_flow_templates')
    .select('id')
    .eq('form_type', 'temp_voucher')
    .eq('is_active', true)
    .maybeSingle()

  const flowTemplateId: number | null = tpl?.id ?? null

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

  const { data: tpl } = await supabase
    .from('approval_flow_templates')
    .select('id')
    .eq('form_type', 'temp_voucher')
    .eq('is_active', true)
    .maybeSingle()

  const flowTemplateId: number | null = tpl?.id ?? null

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
    notifyReviewersForStep({
      templateId: flowTemplateId,
      stepNumber: 1,
      applyDivisionId: null,
      applySectionId: null,
      title: '暫付款沖銷憑單待審核',
      body: null,
      link: `/funds-voucher/review/check/${id}`,
      tempVoucherId: id,
    }).catch(e => console.error('Notification error:', e))
  }

  return { error: null }
}
