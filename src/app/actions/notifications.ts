'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

type StepDef = {
  step_number: number
  reviewer_type: string
  role_type_id: number | null
  org_unit_type: string | null
  system_role_id: number | null
  approval_group_id: number | null
}

async function resolveReviewerUserIds(
  step: StepDef,
  applyDivisionId: number | null,
  applySectionId: number | null
): Promise<number[]> {
  if (step.reviewer_type === 'system_role' && step.system_role_id) {
    const { data } = await supabase
      .from('app_users')
      .select('id')
      .eq('system_role_id', step.system_role_id)
    return (data ?? []).map((r: { id: number }) => r.id)
  }
  if (step.reviewer_type === 'org_role') {
    let targetUnitId: number | null = null
    if (step.org_unit_type === 'division') targetUnitId = applyDivisionId
    else if (step.org_unit_type === 'section') targetUnitId = applySectionId
    if (targetUnitId) {
      const { data } = await supabase
        .from('org_unit_members')
        .select('user_id')
        .eq('org_unit_id', targetUnitId)
        .not('user_id', 'is', null)
      return (data ?? []).map((r: { user_id: number }) => r.user_id)
    }
    if (step.role_type_id) {
      const { data } = await supabase
        .from('org_unit_members')
        .select('user_id')
        .eq('role_type_id', step.role_type_id)
        .not('user_id', 'is', null)
      return [...new Set((data ?? []).map((r: { user_id: number }) => r.user_id))]
    }
  }
  if (step.reviewer_type === 'approval_group' && step.approval_group_id) {
    const { data } = await supabase
      .from('approval_group_members')
      .select('user_id')
      .eq('group_id', step.approval_group_id)
    return (data ?? []).map((r: { user_id: number }) => r.user_id)
  }
  return []
}

// ── 內部輔助：寫入通知給審核人 ────────────────────────

function withItemName(title: string, itemName?: string | null): string {
  return itemName ? `${title} - ${itemName}` : title
}

export async function notifyReviewersForStep(params: {
  templateId: number | null
  stepNumber: number
  applyDivisionId: number | null
  applySectionId: number | null
  title: string
  itemName?: string | null
  body: string | null
  link: string
  fundsAllocationId?: number
  fundsPaymentId?: number
  tempVoucherId?: number
}) {
  if (!params.templateId) return
  const { data: step } = await supabase
    .from('approval_flow_steps')
    .select('step_number, reviewer_type, role_type_id, org_unit_type, system_role_id, approval_group_id')
    .eq('template_id', params.templateId)
    .eq('step_number', params.stepNumber)
    .single()
  if (!step) return

  const userIds = await resolveReviewerUserIds(
    step as StepDef,
    params.applyDivisionId,
    params.applySectionId
  )
  if (!userIds.length) return

  const title = withItemName(params.title, params.itemName)

  await supabase.from('notifications').insert(
    userIds.map(uid => ({
      user_id: uid,
      type: 'approval_needed',
      title,
      body: params.body,
      link: params.link,
      funds_allocation_id: params.fundsAllocationId ?? null,
      funds_payment_id: params.fundsPaymentId ?? null,
      temp_voucher_id: params.tempVoucherId ?? null,
    }))
  )
}

// ── 內部輔助：寫入通知給申請人 ────────────────────────

export async function notifyApplicant(params: {
  userId: number
  type: 'approved' | 'rejected' | 'payment_ready'
  title: string
  itemName?: string | null
  body: string | null
  link: string
  fundsAllocationId?: number
  fundsPaymentId?: number
  tempVoucherId?: number
}) {
  if (!params.userId || isNaN(params.userId)) return
  await supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: withItemName(params.title, params.itemName),
    body: params.body,
    link: params.link,
    funds_allocation_id: params.fundsAllocationId ?? null,
    funds_payment_id: params.fundsPaymentId ?? null,
    temp_voucher_id: params.tempVoucherId ?? null,
  })
}

// ── 公開 API（UI 使用）────────────────────────────────

export async function getUnreadCount(userId: number): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  return count ?? 0
}

export type NotificationItem = {
  id: number
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export async function getNotifications(userId: number): Promise<NotificationItem[]> {
  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)
  return (data ?? []) as NotificationItem[]
}

export async function markAsRead(notificationId: number): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId)
}

export async function markAllAsRead(userId: number): Promise<void> {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
}
