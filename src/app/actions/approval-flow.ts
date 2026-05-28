'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { ApprovalFlowTemplate, ApprovalFlowStep, ApprovalFlowStepWithRole } from '@/lib/types'

// ── 查詢 ──────────────────────────────────────────────

export async function getTemplates(formType: 'funds_allocation' | 'payment_voucher') {
  const { data, error } = await supabase
    .from('approval_flow_templates')
    .select('*')
    .eq('form_type', formType)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data as ApprovalFlowTemplate[]
}

export async function getTemplateWithSteps(templateId: number) {
  const [templateRes, stepsRes] = await Promise.all([
    supabase.from('approval_flow_templates').select('*').eq('id', templateId).single(),
    supabase
      .from('approval_flow_steps')
      .select('*, role_types(name), system_roles(name)')
      .eq('template_id', templateId)
      .order('step_number', { ascending: true }),
  ])
  if (templateRes.error) throw new Error(templateRes.error.message)
  if (stepsRes.error) throw new Error(stepsRes.error.message)

  const steps: ApprovalFlowStepWithRole[] = (stepsRes.data ?? []).map((s: {
    id: number; template_id: number; step_number: number; step_name: string;
    reviewer_type: 'org_role' | 'system_role'; role_type_id: number | null;
    system_role_id: number | null;
    role_types: { name: string } | null;
    system_roles: { name: string } | null;
  }) => ({
    id: s.id,
    template_id: s.template_id,
    step_number: s.step_number,
    step_name: s.step_name,
    reviewer_type: s.reviewer_type,
    role_type_id: s.role_type_id,
    system_role_id: s.system_role_id,
    role_type_name: s.role_types?.name ?? null,
    system_role_name: s.system_roles?.name ?? null,
  }))

  return { template: templateRes.data as ApprovalFlowTemplate, steps }
}

export async function getActiveTemplatesWithPaymentAccounts(
  formType: 'funds_allocation' | 'payment_voucher'
) {
  const { data, error } = await supabase
    .from('approval_flow_templates')
    .select('*, template_payment_accounts(payment_account_option_id)')
    .eq('form_type', formType)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data
}

export async function getTemplateByPaymentAccount(
  paymentAccountOptionId: number,
  formType: 'funds_allocation' | 'payment_voucher'
) {
  const { data, error } = await supabase
    .from('template_payment_accounts')
    .select('template_id, approval_flow_templates!inner(id, name, form_type, is_active)')
    .eq('payment_account_option_id', paymentAccountOptionId)
    .eq('approval_flow_templates.form_type', formType)
    .eq('approval_flow_templates.is_active', true)
    .single()
  if (error) return null
  return data
}

// ── 新增範本 ──────────────────────────────────────────

export async function createTemplate(
  name: string,
  formType: 'funds_allocation' | 'payment_voucher' | 'temp_voucher'
): Promise<ApprovalFlowTemplate> {
  const { data, error } = await supabase
    .from('approval_flow_templates')
    .insert({ name, form_type: formType, is_active: true })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ApprovalFlowTemplate
}

// ── 更新範本名稱 ──────────────────────────────────────

export async function updateTemplateName(id: number, name: string) {
  const { error } = await supabase
    .from('approval_flow_templates')
    .update({ name })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── 切換啟用狀態 ──────────────────────────────────────

export async function toggleTemplateActive(id: number, isActive: boolean) {
  const { error } = await supabase
    .from('approval_flow_templates')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── 刪除範本 ──────────────────────────────────────────

export async function deleteTemplate(id: number) {
  const { error } = await supabase
    .from('approval_flow_templates')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── 儲存步驟（整批替換） ──────────────────────────────

export async function saveTemplateSteps(
  templateId: number,
  steps: Array<{
    step_number: number
    step_name: string
    reviewer_type: 'org_role' | 'system_role'
    role_type_id: number | null
    system_role_id: number | null
  }>
) {
  const { error: deleteError } = await supabase
    .from('approval_flow_steps')
    .delete()
    .eq('template_id', templateId)
  if (deleteError) throw new Error(deleteError.message)

  if (steps.length === 0) return

  const { error: insertError } = await supabase
    .from('approval_flow_steps')
    .insert(steps.map((s) => ({ ...s, template_id: templateId })))
  if (insertError) throw new Error(insertError.message)
}

// ── 儲存出款帳號對應（整批替換） ─────────────────────

export async function saveTemplatePaymentAccounts(
  templateId: number,
  paymentAccountOptionIds: number[]
) {
  const { error: deleteError } = await supabase
    .from('template_payment_accounts')
    .delete()
    .eq('template_id', templateId)
  if (deleteError) throw new Error(deleteError.message)

  if (paymentAccountOptionIds.length === 0) return

  const { error: insertError } = await supabase
    .from('template_payment_accounts')
    .insert(paymentAccountOptionIds.map((id) => ({
      template_id: templateId,
      payment_account_option_id: id,
    })))
  if (insertError) throw new Error(insertError.message)
}

// ── 提交審核決定 ──────────────────────────────────────

export async function submitApprovalDecision(params: {
  fundsAllocationId?: number
  fundsPaymentId?: number
  tempVoucherId?: number
  stepNumber: number
  stepName: string
  decision: 'approved' | 'rejected'
  comment: string
  reviewerId: string
  totalSteps: number
}) {
  const { fundsAllocationId, fundsPaymentId, tempVoucherId, stepNumber, stepName, decision, comment, reviewerId, totalSteps } = params

  const isLastStep = stepNumber >= totalSteps
  const newStatus = decision === 'rejected' ? 'rejected' : isLastStep ? 'approved' : 'pending'
  const newCurrentStep = decision === 'rejected' || isLastStep ? null : stepNumber + 1

  const { error: recordError } = await supabase
    .from('approval_records')
    .insert({
      funds_allocation_id: fundsAllocationId ?? null,
      funds_payment_id: fundsPaymentId ?? null,
      temp_voucher_id: tempVoucherId ?? null,
      step_number: stepNumber,
      step_name: stepName,
      decision,
      comment: comment || null,
      reviewer_id: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
  if (recordError) throw new Error(recordError.message)

  if (fundsAllocationId) {
    const { error } = await supabase.from('funds_allocation')
      .update({ status: newStatus, current_step: newCurrentStep, updated_at: new Date().toISOString() })
      .eq('id', fundsAllocationId)
    if (error) throw new Error(error.message)
  }

  if (fundsPaymentId) {
    const { error } = await supabase.from('funds_payment')
      .update({ status: newStatus, current_step: newCurrentStep, updated_at: new Date().toISOString() })
      .eq('id', fundsPaymentId)
    if (error) throw new Error(error.message)
  }

  if (tempVoucherId) {
    const { error } = await supabase.from('temp_vouchers')
      .update({ status: newStatus, current_step: newCurrentStep, updated_at: new Date().toISOString() })
      .eq('id', tempVoucherId)
    if (error) throw new Error(error.message)
  }
}

// ── 查詢已被其他範本使用的出款帳號 ───────────────────

export async function getUsedPaymentAccountIds(
  formType: 'funds_allocation' | 'payment_voucher' | 'temp_voucher',
  excludeTemplateId?: number
) {
  let query = supabase
    .from('template_payment_accounts')
    .select('payment_account_option_id, approval_flow_templates!inner(form_type, is_active)')
    .eq('approval_flow_templates.form_type', formType)
    .eq('approval_flow_templates.is_active', true)

  if (excludeTemplateId) {
    query = query.neq('template_id', excludeTemplateId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: { payment_account_option_id: number }) => r.payment_account_option_id)
}
