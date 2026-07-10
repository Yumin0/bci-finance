'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { ApprovalFlowTemplate, ApprovalFlowStep, ApprovalFlowStepWithRole } from '@/lib/types'
import { notifyReviewersForStep, notifyApplicant } from './notifications'
import { emailToEnglishName } from '@/lib/userNames'

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
      .select('*, role_types(name), system_roles(name), approval_groups(name)')
      .eq('template_id', templateId)
      .order('step_number', { ascending: true }),
  ])
  if (templateRes.error) throw new Error(templateRes.error.message)
  if (stepsRes.error) throw new Error(stepsRes.error.message)

  const steps: ApprovalFlowStepWithRole[] = (stepsRes.data ?? []).map((s: {
    id: number; template_id: number; step_number: number; step_name: string;
    reviewer_type: 'org_role' | 'system_role' | 'approval_group';
    role_type_id: number | null; org_unit_type: 'division' | 'section' | null;
    system_role_id: number | null; approval_group_id: number | null;
    role_types: { name: string } | null;
    system_roles: { name: string } | null;
    approval_groups: { name: string } | null;
  }) => ({
    id: s.id,
    template_id: s.template_id,
    step_number: s.step_number,
    step_name: s.step_name,
    reviewer_type: s.reviewer_type,
    role_type_id: s.role_type_id,
    org_unit_type: s.org_unit_type,
    system_role_id: s.system_role_id,
    approval_group_id: s.approval_group_id,
    role_type_name: s.role_types?.name ?? null,
    system_role_name: s.system_roles?.name ?? null,
    approval_group_name: s.approval_groups?.name ?? null,
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
    reviewer_type: 'org_role' | 'system_role' | 'approval_group'
    role_type_id: number | null
    org_unit_type: 'division' | 'section' | null
    system_role_id: number | null
    approval_group_id: number | null
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
  approvedAmount?: number | null
}) {
  const { fundsAllocationId, fundsPaymentId, tempVoucherId, stepNumber, stepName, decision, comment, reviewerId, totalSteps, approvedAmount } = params

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
      approved_amount: decision === 'approved' ? (approvedAmount ?? null) : null,
      reviewer_id: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
  if (recordError) throw new Error(recordError.message)

  if (fundsAllocationId) {
    const updatePayload: Record<string, unknown> = { status: newStatus, current_step: newCurrentStep, updated_at: new Date().toISOString() }
    if (decision === 'approved' && approvedAmount != null) updatePayload.approved_amount = approvedAmount
    const { error } = await supabase.from('funds_allocation').update(updatePayload).eq('id', fundsAllocationId)
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

  // ── 通知（失敗不影響主流程）────────────────────────────────
  try {
    if (fundsAllocationId) {
      const { data: alloc } = await supabase
        .from('funds_allocation')
        .select('created_by, apply_division_id, apply_section_id, flow_template_id, name')
        .eq('id', fundsAllocationId)
        .single()
      if (alloc) {
        const applicantId = parseInt(String(alloc.created_by), 10)
        const { data: creator } = await supabase.from('app_users').select('email').eq('id', applicantId).single()
        const allocBody = creator?.email ? `申請人：${emailToEnglishName(creator.email)}` : alloc.name
        if (decision === 'approved' && !isLastStep) {
          await notifyReviewersForStep({
            templateId: alloc.flow_template_id,
            stepNumber: stepNumber + 1,
            applyDivisionId: alloc.apply_division_id,
            applySectionId: alloc.apply_section_id,
            title: '資金分配申請待審核',
            itemName: alloc.name,
            body: allocBody,
            link: `/funds-allocation/review/check/${fundsAllocationId}`,
            fundsAllocationId,
          })
        } else if (decision === 'approved' && isLastStep) {
          await notifyApplicant({
            userId: applicantId,
            type: 'approved',
            title: '資金分配申請已核准',
            itemName: alloc.name,
            body: allocBody,
            link: `/funds-allocation/my-funds/edit/${fundsAllocationId}`,
            fundsAllocationId,
          })
          await notifyApplicant({
            userId: applicantId,
            type: 'payment_ready',
            title: '可建立付款憑單',
            itemName: alloc.name,
            body: allocBody,
            link: `/funds-payment/my-payment/add/${fundsAllocationId}`,
            fundsAllocationId,
          })
        } else if (decision === 'rejected') {
          await notifyApplicant({
            userId: applicantId,
            type: 'rejected',
            title: '資金分配申請已退回',
            itemName: alloc.name,
            body: allocBody,
            link: `/funds-allocation/my-funds/edit/${fundsAllocationId}`,
            fundsAllocationId,
          })
        }
      }
    }

    if (fundsPaymentId) {
      const { data: payment } = await supabase
        .from('funds_payment')
        .select('created_by, flow_template_id, name, funds_allocation_id')
        .eq('id', fundsPaymentId)
        .single()
      if (payment) {
        const applicantId = parseInt(String(payment.created_by), 10)
        const { data: paymentCreator } = await supabase.from('app_users').select('email').eq('id', applicantId).single()
        const paymentBody = paymentCreator?.email ? `申請人：${emailToEnglishName(paymentCreator.email)}` : payment.name
        if (decision === 'approved' && !isLastStep) {
          const orgContext = await getAllocationOrgContext(payment.funds_allocation_id)
          await notifyReviewersForStep({
            templateId: payment.flow_template_id,
            stepNumber: stepNumber + 1,
            applyDivisionId: orgContext.applyDivisionId,
            applySectionId: orgContext.applySectionId,
            title: '付款憑單待審核',
            itemName: payment.name,
            body: paymentBody,
            link: `/funds-payment/review/check/${fundsPaymentId}`,
            fundsPaymentId,
          })
        } else if (decision === 'approved' && isLastStep) {
          await notifyApplicant({
            userId: applicantId,
            type: 'approved',
            title: '付款憑單已核准',
            itemName: payment.name,
            body: paymentBody,
            link: `/funds-payment/my-payment/${fundsPaymentId}`,
            fundsPaymentId,
          })
        } else if (decision === 'rejected') {
          await notifyApplicant({
            userId: applicantId,
            type: 'rejected',
            title: '付款憑單已退回',
            itemName: payment.name,
            body: paymentBody,
            link: `/funds-payment/my-payment/${fundsPaymentId}`,
            fundsPaymentId,
          })
        }
      }
    }

    if (tempVoucherId) {
      const { data: voucher } = await supabase
        .from('temp_vouchers')
        .select('created_by, flow_template_id, funds_payment_id')
        .eq('id', tempVoucherId)
        .single()
      if (voucher) {
        const applicantId = Number(voucher.created_by)
        let voucherItemName: string | null = null
        let voucherAllocationId: number | null = null
        if (voucher.funds_payment_id) {
          const { data: relatedPayment } = await supabase
            .from('funds_payment')
            .select('name, funds_allocation_id')
            .eq('id', voucher.funds_payment_id)
            .single()
          voucherItemName = relatedPayment?.name ?? null
          voucherAllocationId = relatedPayment?.funds_allocation_id ?? null
        }
        if (decision === 'approved' && !isLastStep) {
          const orgContext = await getAllocationOrgContext(voucherAllocationId)
          await notifyReviewersForStep({
            templateId: voucher.flow_template_id,
            stepNumber: stepNumber + 1,
            applyDivisionId: orgContext.applyDivisionId,
            applySectionId: orgContext.applySectionId,
            title: '暫付款沖銷憑單待審核',
            itemName: voucherItemName,
            body: null,
            link: `/funds-voucher/review/check/${tempVoucherId}`,
            tempVoucherId,
          })
        } else if (decision === 'approved' && isLastStep) {
          await notifyApplicant({
            userId: applicantId,
            type: 'approved',
            title: '暫付款沖銷憑單已核准',
            itemName: voucherItemName,
            body: null,
            link: `/funds-voucher/my-voucher/${tempVoucherId}`,
            tempVoucherId,
          })
        } else if (decision === 'rejected') {
          await notifyApplicant({
            userId: applicantId,
            type: 'rejected',
            title: '暫付款沖銷憑單已退回',
            itemName: voucherItemName,
            body: null,
            link: `/funds-voucher/my-voucher/${tempVoucherId}`,
            tempVoucherId,
          })
        }
      }
    }
  } catch (e) {
    console.error('Notification error:', e)
  }
}

// ── 審核人資格驗證與待審清單 ─────────────────────────────────

type StepRef = {
  step_number: number
  step_name: string
  reviewer_type: string
  role_type_id: number | null
  org_unit_type: string | null
  system_role_id: number | null
  approval_group_id: number | null
}

async function getReviewerInfo(userId: number) {
  const [membershipsRes, userRes, groupsRes] = await Promise.all([
    supabase.from('org_unit_members').select('org_unit_id, role_type_id').eq('user_id', userId),
    supabase.from('app_users').select('system_role_id').eq('id', userId).single(),
    supabase.from('approval_group_members').select('group_id').eq('user_id', userId),
  ])
  const memberships = (membershipsRes.data ?? []) as { org_unit_id: number; role_type_id: number | null }[]
  const systemRoleId = (userRes.data as { system_role_id: number | null } | null)?.system_role_id ?? null
  const groupIds = new Set((groupsRes.data ?? []).map((r: { group_id: number }) => r.group_id))
  return {
    roleTypeIds: new Set(memberships.map(m => m.role_type_id).filter((id): id is number => id !== null)),
    memberOrgUnitIds: new Set(memberships.map(m => m.org_unit_id)),
    systemRoleId,
    groupIds,
  }
}

function stepMatchesReviewer(
  stepDef: StepRef,
  reviewerInfo: { roleTypeIds: Set<number>; memberOrgUnitIds: Set<number>; systemRoleId: number | null; groupIds: Set<number> },
  orgContext?: { applyDivisionId?: number | null; applySectionId?: number | null }
): boolean {
  if (stepDef.reviewer_type === 'system_role') {
    return stepDef.system_role_id !== null && stepDef.system_role_id === reviewerInfo.systemRoleId
  }
  if (stepDef.reviewer_type === 'org_role') {
    if (stepDef.org_unit_type === 'division') {
      const targetId = orgContext?.applyDivisionId
      return targetId != null && reviewerInfo.memberOrgUnitIds.has(targetId)
    }
    if (stepDef.org_unit_type === 'section') {
      const targetId = orgContext?.applySectionId
      return targetId != null && reviewerInfo.memberOrgUnitIds.has(targetId)
    }
    return stepDef.role_type_id !== null && reviewerInfo.roleTypeIds.has(stepDef.role_type_id)
  }
  if (stepDef.reviewer_type === 'approval_group') {
    return stepDef.approval_group_id !== null && reviewerInfo.groupIds.has(stepDef.approval_group_id)
  }
  return false
}

export async function checkCanReviewStep(params: {
  userId: number
  stepDef: {
    reviewer_type: 'org_role' | 'system_role' | 'approval_group'
    role_type_id: number | null
    org_unit_type?: string | null
    system_role_id: number | null
    approval_group_id: number | null
    step_number?: number
    step_name?: string
  }
  applyDivisionId?: number | null
  applySectionId?: number | null
}): Promise<boolean> {
  const reviewerInfo = await getReviewerInfo(params.userId)
  return stepMatchesReviewer(params.stepDef as StepRef, reviewerInfo, {
    applyDivisionId: params.applyDivisionId,
    applySectionId: params.applySectionId,
  })
}

const STEP_SELECT = 'step_number, step_name, reviewer_type, role_type_id, org_unit_type, system_role_id, approval_group_id'

export async function getPendingAllocationsForReviewer(userId: number) {
  const reviewerInfo = await getReviewerInfo(userId)
  const { data } = await supabase
    .from('funds_allocation')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT}))`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  const filtered = ((data ?? []) as unknown as Array<{ current_step: number | null; apply_division_id: number | null; apply_section_id: number | null; created_by: string; applicant: string | null; approval_flow_templates: { name: string; approval_flow_steps: StepRef[] } | null } & Record<string, unknown>>)
    .filter(r => {
      const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
      return stepDef ? stepMatchesReviewer(stepDef, reviewerInfo, {
        applyDivisionId: r.apply_division_id,
        applySectionId: r.apply_section_id,
      }) : false
    })

  // Resolve English names from created_by
  const creatorIds = [...new Set(
    filtered.map(r => parseInt(r.created_by, 10)).filter(id => !isNaN(id))
  )]
  const emailMap = new Map<number, string>()
  if (creatorIds.length > 0) {
    const { data: users } = await supabase.from('app_users').select('id, email').in('id', creatorIds)
    for (const u of (users ?? [])) emailMap.set(u.id as number, u.email as string)
  }

  return filtered.map(r => {
    const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by),
      step_name: stepDef?.step_name ?? `第 ${r.current_step ?? 1} 步`,
    }
  })
}

type PendingRaw = { current_step: number | null; apply_division_id: number | null; apply_section_id: number | null; created_by: string; applicant: string | null; approval_flow_templates: { name: string; approval_flow_steps: StepRef[] } | null } & Record<string, unknown>

async function resolvePendingNames(items: PendingRaw[]) {
  const creatorIds = [...new Set(items.map(r => parseInt(r.created_by, 10)).filter(id => !isNaN(id)))]
  const emailMap = new Map<number, string>()
  if (creatorIds.length > 0) {
    const { data: users } = await supabase.from('app_users').select('id, email').in('id', creatorIds)
    for (const u of (users ?? [])) emailMap.set(u.id as number, u.email as string)
  }
  return emailMap
}

export async function getPendingAllocationsForOrgRole(userId: number) {
  const reviewerInfo = await getReviewerInfo(userId)
  const { data } = await supabase
    .from('funds_allocation')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT}))`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const filtered = ((data ?? []) as unknown as PendingRaw[]).filter(r => {
    const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
    if (!stepDef || stepDef.reviewer_type !== 'org_role') return false
    return stepMatchesReviewer(stepDef, reviewerInfo, {
      applyDivisionId: r.apply_division_id,
      applySectionId: r.apply_section_id,
    })
  })

  const emailMap = await resolvePendingNames(filtered)
  return filtered.map(r => {
    const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return { ...r, applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by), step_name: stepDef?.step_name ?? `第 ${r.current_step ?? 1} 步` }
  })
}

export async function getPendingAllocationsByApprovalGroup(groupId: number) {
  const { data } = await supabase
    .from('funds_allocation')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT}))`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const filtered = ((data ?? []) as unknown as PendingRaw[]).filter(r => {
    const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
    return stepDef?.reviewer_type === 'approval_group' && stepDef.approval_group_id === groupId
  })

  const emailMap = await resolvePendingNames(filtered)
  return filtered.map(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const stepDef = steps.find(s => s.step_number === r.current_step)
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by),
      step_name: stepDef?.step_name ?? `第 ${r.current_step ?? 1} 步`,
      total_steps: steps.length,
    }
  })
}

type AllRaw = PendingRaw & { status: string }

export async function getAllocationsForOrgRoleByWeek(userId: number, weekStart: string, weekEnd: string) {
  const reviewerInfo = await getReviewerInfo(userId)
  const { data } = await supabase
    .from('funds_allocation')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT}))`)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date', { ascending: false })

  const filtered = ((data ?? []) as unknown as AllRaw[]).filter(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    return steps.some(s =>
      s.reviewer_type === 'org_role' &&
      stepMatchesReviewer(s, reviewerInfo, {
        applyDivisionId: r.apply_division_id,
        applySectionId: r.apply_section_id,
      })
    )
  })

  const emailMap = await resolvePendingNames(filtered)
  return filtered.map(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const matchingStep = steps.find(s =>
      s.reviewer_type === 'org_role' &&
      stepMatchesReviewer(s, reviewerInfo, {
        applyDivisionId: r.apply_division_id,
        applySectionId: r.apply_section_id,
      })
    )
    const isPendingHere = r.status === 'pending' && r.current_step === matchingStep?.step_number
    const currentStepDef = steps.find(s => s.step_number === r.current_step)
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by),
      step_name: r.status === 'pending'
        ? (currentStepDef?.step_name ?? `第 ${r.current_step ?? 1} 步`)
        : undefined,
      total_steps: steps.length,
      is_pending_here: isPendingHere,
    }
  })
}

export async function getAllocationsForApprovalGroupByWeek(groupId: number, weekStart: string, weekEnd: string) {
  const { data } = await supabase
    .from('funds_allocation')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT}))`)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date', { ascending: false })

  const filtered = ((data ?? []) as unknown as AllRaw[]).filter(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    return steps.some(s => s.reviewer_type === 'approval_group' && s.approval_group_id === groupId)
  })

  const emailMap = await resolvePendingNames(filtered)
  return filtered.map(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const matchingStep = steps.find(s => s.reviewer_type === 'approval_group' && s.approval_group_id === groupId)
    const isPendingHere = r.status === 'pending' && r.current_step === matchingStep?.step_number
    const currentStepDef = steps.find(s => s.step_number === r.current_step)
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by),
      step_name: r.status === 'pending'
        ? (currentStepDef?.step_name ?? `第 ${r.current_step ?? 1} 步`)
        : undefined,
      total_steps: steps.length,
      is_pending_here: isPendingHere,
    }
  })
}

export async function getApprovalHistoryForReviewer(userId: number) {
  const { data } = await supabase
    .from('approval_records')
    .select(`*, funds_allocation:funds_allocation_id(id, name, amount, status, serial_number, apply_division, apply_section, applicant, apply_role, payment_account, expense_item, created_by)`)
    .eq('reviewer_id', String(userId))
    .not('decision', 'is', null)
    .not('funds_allocation_id', 'is', null)
    .order('reviewed_at', { ascending: false })
    .limit(500)

  type RawItem = Record<string, unknown> & {
    funds_allocation_id: number | null
    step_number: number
    reviewed_at: string | null
    funds_allocation: (Record<string, unknown> & { created_by: string; applicant: string | null }) | null
  }
  const records = (data ?? []) as RawItem[]

  // Deduplicate: keep highest step per allocation
  const seen = new Map<number, RawItem>()
  for (const r of records) {
    const allocId = r.funds_allocation_id ?? 0
    const existing = seen.get(allocId)
    if (!existing || r.step_number > existing.step_number) seen.set(allocId, r)
  }
  const deduped = Array.from(seen.values()).sort(
    (a, b) => new Date(b.reviewed_at ?? '').getTime() - new Date(a.reviewed_at ?? '').getTime()
  )

  // Resolve English names from created_by
  const creatorIds = [...new Set(
    deduped
      .map(r => parseInt(r.funds_allocation?.created_by ?? '', 10))
      .filter(id => !isNaN(id))
  )]
  const emailMap = new Map<number, string>()
  if (creatorIds.length > 0) {
    const { data: users } = await supabase.from('app_users').select('id, email').in('id', creatorIds)
    for (const u of (users ?? [])) emailMap.set(u.id as number, u.email as string)
  }

  return deduped.map(r => {
    if (!r.funds_allocation) return r
    const id = parseInt(r.funds_allocation.created_by ?? '', 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      funds_allocation: {
        ...r.funds_allocation,
        applicant: email ? emailToEnglishName(email) : (r.funds_allocation.applicant ?? r.funds_allocation.created_by),
      },
    }
  })
}

// 付款憑單/暫付款沖銷憑單本身沒有 apply_division_id/apply_section_id 欄位，
// org_role（課長/處長）步驟的審核人需回溯關聯的資金分配申請單取得
export async function getAllocationOrgContext(
  allocationId: number | null | undefined
): Promise<{ applyDivisionId: number | null; applySectionId: number | null }> {
  if (!allocationId) return { applyDivisionId: null, applySectionId: null }
  const { data } = await supabase
    .from('funds_allocation')
    .select('apply_division_id, apply_section_id')
    .eq('id', allocationId)
    .single()
  const alloc = data as { apply_division_id: number | null; apply_section_id: number | null } | null
  return { applyDivisionId: alloc?.apply_division_id ?? null, applySectionId: alloc?.apply_section_id ?? null }
}

type AllocOrgRef = { apply_division_id: number | null; apply_section_id: number | null } | null

type PaymentWeekRaw = {
  status: string
  current_step: number | null
  created_by: string
  applicant: string | null
  funds_allocation: AllocOrgRef
  approval_flow_templates: { name: string; approval_flow_steps: StepRef[] } | null
} & Record<string, unknown>

// 啟用中付款憑單範本實際使用到的審核群組（審核管理頁動態 Tab 用）
export async function getPaymentVoucherReviewGroups(): Promise<{ id: number; name: string }[]> {
  const { data } = await supabase
    .from('approval_flow_steps')
    .select('approval_group_id, approval_flow_templates!inner(form_type, is_active)')
    .eq('reviewer_type', 'approval_group')
    .eq('approval_flow_templates.form_type', 'payment_voucher')
    .eq('approval_flow_templates.is_active', true)
    .not('approval_group_id', 'is', null)
  const ids = [...new Set((data ?? []).map((r: { approval_group_id: number }) => r.approval_group_id))]
  if (ids.length === 0) return []
  const { data: groups } = await supabase
    .from('approval_groups')
    .select('id, name')
    .in('id', ids)
    .order('sort_order')
  return (groups ?? []) as { id: number; name: string }[]
}

export async function getPaymentsForOrgRoleByWeek(userId: number, weekStart: string, weekEnd: string) {
  const reviewerInfo = await getReviewerInfo(userId)
  const { data } = await supabase
    .from('funds_payment')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT})), funds_allocation:funds_allocation_id(apply_division_id, apply_section_id)`)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date', { ascending: false })

  const filtered = ((data ?? []) as unknown as PaymentWeekRaw[]).filter(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    return steps.some(s =>
      s.reviewer_type === 'org_role' &&
      stepMatchesReviewer(s, reviewerInfo, {
        applyDivisionId: r.funds_allocation?.apply_division_id,
        applySectionId: r.funds_allocation?.apply_section_id,
      })
    )
  })

  const emailMap = await resolvePendingNames(filtered as unknown as PendingRaw[])
  return filtered.map(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const currentStepDef = steps.find(s => s.step_number === r.current_step)
    // 直接判斷「目前步驟」是否輪到此使用者（同範本可能有多個 org_role 步驟，不能只找第一個符合的）
    const isPendingHere = r.status === 'pending' &&
      currentStepDef?.reviewer_type === 'org_role' &&
      stepMatchesReviewer(currentStepDef, reviewerInfo, {
        applyDivisionId: r.funds_allocation?.apply_division_id,
        applySectionId: r.funds_allocation?.apply_section_id,
      })
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by),
      step_name: r.status === 'pending'
        ? (currentStepDef?.step_name ?? `第 ${r.current_step ?? 1} 步`)
        : undefined,
      total_steps: steps.length,
      is_pending_here: isPendingHere,
    }
  })
}

export async function getPaymentsForApprovalGroupByWeek(groupId: number, weekStart: string, weekEnd: string) {
  const { data } = await supabase
    .from('funds_payment')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT})), funds_allocation:funds_allocation_id(apply_division_id, apply_section_id)`)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date', { ascending: false })

  const filtered = ((data ?? []) as unknown as PaymentWeekRaw[]).filter(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    return steps.some(s => s.reviewer_type === 'approval_group' && s.approval_group_id === groupId)
  })

  const emailMap = await resolvePendingNames(filtered as unknown as PendingRaw[])
  return filtered.map(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const currentStepDef = steps.find(s => s.step_number === r.current_step)
    // 直接判斷「目前步驟」是否屬於此群組（同範本可能有多個步驟用同一群組，不能只找第一個符合的）
    const isPendingHere = r.status === 'pending' &&
      currentStepDef?.reviewer_type === 'approval_group' &&
      currentStepDef.approval_group_id === groupId
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by),
      step_name: r.status === 'pending'
        ? (currentStepDef?.step_name ?? `第 ${r.current_step ?? 1} 步`)
        : undefined,
      total_steps: steps.length,
      is_pending_here: isPendingHere,
    }
  })
}

export async function getPendingPaymentsForReviewer(userId: number) {
  const reviewerInfo = await getReviewerInfo(userId)
  const { data } = await supabase
    .from('funds_payment')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT})), funds_allocation:funds_allocation_id(apply_division_id, apply_section_id)`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return ((data ?? []) as unknown as Array<{ current_step: number | null; funds_allocation: AllocOrgRef; approval_flow_templates: { name: string; approval_flow_steps: StepRef[] } | null } & Record<string, unknown>>)
    .filter(r => {
      const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
      return stepDef ? stepMatchesReviewer(stepDef, reviewerInfo, {
        applyDivisionId: r.funds_allocation?.apply_division_id,
        applySectionId: r.funds_allocation?.apply_section_id,
      }) : false
    })
    .map(r => {
      const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
      return { ...r, step_name: stepDef?.step_name ?? `第 ${r.current_step ?? 1} 步` }
    })
}

export async function getPendingVouchersForReviewer(userId: number) {
  const reviewerInfo = await getReviewerInfo(userId)
  const { data } = await supabase
    .from('temp_vouchers')
    .select(`*, approval_flow_templates(approval_flow_steps(${STEP_SELECT})), funds_payment:funds_payment_id(funds_allocation:funds_allocation_id(apply_division_id, apply_section_id))`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return ((data ?? []) as unknown as Array<{ current_step: number | null; funds_payment: { funds_allocation: AllocOrgRef } | null; approval_flow_templates: { approval_flow_steps: StepRef[] } | null } & Record<string, unknown>>)
    .filter(r => {
      const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
      return stepDef ? stepMatchesReviewer(stepDef, reviewerInfo, {
        applyDivisionId: r.funds_payment?.funds_allocation?.apply_division_id,
        applySectionId: r.funds_payment?.funds_allocation?.apply_section_id,
      }) : false
    })
    .map(r => {
      const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
      return { ...r, step_name: stepDef?.step_name ?? `第 ${r.current_step ?? 1} 步` }
    })
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
