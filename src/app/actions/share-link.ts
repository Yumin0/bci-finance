'use server'

// 分享連結中介轉址（優先序2 列22，Q22c 拍板）：依身份決定分享連結的落點。
// 順序：1. 目前關卡審核人（含群組成員）→ 審核頁可操作
//      2. 申請人本人 → 自己的單子頁
//      3. 有查閱權限者（管理員／有審核管理 Tab 權限／範本任一步驟的審核人）→ 審核頁（非本關自然唯讀）
//      4. 皆非 → 回傳 null，由 share 頁顯示「沒有檢視權限」提示頁（不默默跳首頁、不露單子內容）

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { checkCanReviewStep, getAllocationOrgContext } from './approval-flow'
import { getUserReviewPermissions } from './auth'

const STEP_SELECT = 'step_number, step_name, reviewer_type, role_type_id, org_unit_type, system_role_id, approval_group_id'

type StepDefRow = {
  step_number: number
  reviewer_type: 'org_role' | 'system_role' | 'approval_group'
  role_type_id: number | null
  org_unit_type: string | null
  system_role_id: number | null
  approval_group_id: number | null
}

async function matchesAnyStep(
  userId: number,
  templateId: number | null,
  applyDivisionId: number | null,
  applySectionId: number | null
): Promise<boolean> {
  if (!templateId) return false
  const { data: steps } = await supabase
    .from('approval_flow_steps')
    .select(STEP_SELECT)
    .eq('template_id', templateId)
  for (const step of (steps ?? []) as StepDefRow[]) {
    if (await checkCanReviewStep({ userId, stepDef: step, applyDivisionId, applySectionId })) return true
  }
  return false
}

async function isCurrentStepReviewer(
  userId: number,
  status: string,
  currentStep: number | null,
  templateId: number | null,
  applyDivisionId: number | null,
  applySectionId: number | null
): Promise<boolean> {
  if (status !== 'pending' || currentStep == null || !templateId) return false
  const { data: step } = await supabase
    .from('approval_flow_steps')
    .select(STEP_SELECT)
    .eq('template_id', templateId)
    .eq('step_number', currentStep)
    .limit(1)
  if (!step?.length) return false
  return checkCanReviewStep({ userId, stepDef: step[0] as StepDefRow, applyDivisionId, applySectionId })
}

function hasAnyPermission(perms: { isAdmin: boolean; allowedItemIds: string[] }, ids: string[]): boolean {
  return perms.isAdmin || ids.some(id => perms.allowedItemIds.includes(id))
}

/** 資金分配申請單分享連結落點；null＝無檢視權限 */
export async function resolveAllocationShareTarget(allocationId: number, userId: number): Promise<string | null> {
  const { data: rec } = await supabase
    .from('funds_allocation')
    .select('id, created_by, status, current_step, flow_template_id, apply_division_id, apply_section_id')
    .eq('id', allocationId)
    .single()
  if (!rec || rec.status === 'draft') return null

  const reviewUrl = `/funds-allocation/review/check/${allocationId}`
  if (await isCurrentStepReviewer(userId, rec.status, rec.current_step, rec.flow_template_id, rec.apply_division_id, rec.apply_section_id)) {
    return reviewUrl
  }
  if (parseInt(String(rec.created_by), 10) === userId) {
    return `/funds-allocation/my-funds/edit/${allocationId}`
  }
  const perms = await getUserReviewPermissions(userId)
  if (hasAnyPermission(perms, ['fa-review-div', 'fa-review-advisory', 'fa-review-executive', 'fa-review-cfo'])) {
    return reviewUrl
  }
  if (await matchesAnyStep(userId, rec.flow_template_id, rec.apply_division_id, rec.apply_section_id)) {
    return reviewUrl
  }
  return null
}

/** 付款憑單分享連結落點；null＝無檢視權限 */
export async function resolvePaymentShareTarget(paymentId: number, userId: number): Promise<string | null> {
  const { data: rec } = await supabase
    .from('funds_payment')
    .select('id, created_by, status, current_step, flow_template_id, funds_allocation_id')
    .eq('id', paymentId)
    .single()
  if (!rec || rec.status === 'draft') return null

  // 憑單無自己的處/課別欄位，一律回溯母申請單（與審核人解析同一約定）
  const orgContext = await getAllocationOrgContext(rec.funds_allocation_id)

  const reviewUrl = `/funds-payment/review/check/${paymentId}`
  if (await isCurrentStepReviewer(userId, rec.status, rec.current_step, rec.flow_template_id, orgContext.applyDivisionId, orgContext.applySectionId)) {
    return reviewUrl
  }
  if (parseInt(String(rec.created_by), 10) === userId) {
    return `/funds-payment/my-payment/${paymentId}`
  }
  const perms = await getUserReviewPermissions(userId)
  if (hasAnyPermission(perms, ['fp-review-div', 'fp-review-group'])) {
    return reviewUrl
  }
  if (await matchesAnyStep(userId, rec.flow_template_id, orgContext.applyDivisionId, orgContext.applySectionId)) {
    return reviewUrl
  }
  return null
}

/** 暫付款沖銷憑單分享連結落點；null＝無檢視權限 */
export async function resolveVoucherShareTarget(voucherId: number, userId: number): Promise<string | null> {
  const { data: rec } = await supabase
    .from('temp_vouchers')
    .select('id, created_by, status, current_step, flow_template_id, funds_payment_id')
    .eq('id', voucherId)
    .single()
  if (!rec || rec.status === 'draft') return null

  // 沖銷憑單無自己的處/課別欄位，回溯兩層：temp_voucher → funds_payment → funds_allocation（與審核人解析同一約定）
  let allocationId: number | null = null
  if (rec.funds_payment_id) {
    const { data: parentPayment } = await supabase
      .from('funds_payment')
      .select('funds_allocation_id')
      .eq('id', rec.funds_payment_id)
      .single()
    allocationId = parentPayment?.funds_allocation_id ?? null
  }
  const orgContext = await getAllocationOrgContext(allocationId)

  const reviewUrl = `/funds-voucher/review/check/${voucherId}`
  if (await isCurrentStepReviewer(userId, rec.status, rec.current_step, rec.flow_template_id, orgContext.applyDivisionId, orgContext.applySectionId)) {
    return reviewUrl
  }
  if (parseInt(String(rec.created_by), 10) === userId) {
    return `/funds-voucher/my-voucher/${voucherId}`
  }
  const perms = await getUserReviewPermissions(userId)
  if (hasAnyPermission(perms, ['fv-review-div', 'fv-review-group'])) {
    return reviewUrl
  }
  if (await matchesAnyStep(userId, rec.flow_template_id, orgContext.applyDivisionId, orgContext.applySectionId)) {
    return reviewUrl
  }
  return null
}
