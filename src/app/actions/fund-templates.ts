'use server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/session'
import { FundsAllocationTemplate, OrgUnit } from '@/lib/types'
import { isUserCoveredByUnits } from '@/lib/orgPositions'

// 管理頁用：回傳全部共用範本（不做範圍過濾）
export async function getSharedFundTemplates(): Promise<FundsAllocationTemplate[]> {
  const { data } = await supabase
    .from('funds_allocation_templates')
    .select('*')
    .eq('is_shared', true)
    .order('created_at', { ascending: true })
  return (data ?? []) as FundsAllocationTemplate[]
}

// 選取範本 Modal 用：只回傳適用範圍涵蓋目前使用者的共用範本（未設定範圍的一律隱藏）
export async function getVisibleSharedFundTemplates(): Promise<FundsAllocationTemplate[]> {
  const session = await getSession()
  if (!session) return []
  const [tplRes, memberRes, unitRes] = await Promise.all([
    supabase.from('funds_allocation_templates').select('*').eq('is_shared', true).order('created_at', { ascending: true }),
    supabase.from('org_unit_members').select('org_unit_id').eq('user_id', session.userId),
    supabase.from('org_units').select('*'),
  ])
  const templates = (tplRes.data ?? []) as FundsAllocationTemplate[]
  const userUnitIds = ((memberRes.data ?? []) as { org_unit_id: number }[]).map(m => m.org_unit_id)
  const orgUnits = (unitRes.data ?? []) as OrgUnit[]
  return templates.filter(t => isUserCoveredByUnits(userUnitIds, t.org_unit_ids ?? [], orgUnits))
}

export async function getUserFundTemplates(): Promise<FundsAllocationTemplate[]> {
  const session = await getSession()
  if (!session) return []
  const { data } = await supabase
    .from('funds_allocation_templates')
    .select('*')
    .eq('is_shared', false)
    .eq('created_by', session.userId)
    .order('created_at', { ascending: true })
  return (data ?? []) as FundsAllocationTemplate[]
}

export async function getFundTemplateById(id: number): Promise<FundsAllocationTemplate | null> {
  const { data } = await supabase
    .from('funds_allocation_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  const template = data as FundsAllocationTemplate | null
  if (!template) return null
  // 共用範本需檢查適用組織範圍，避免直接帶網址參數繞過選取範本的過濾
  if (template.is_shared) {
    const session = await getSession()
    if (!session) return null
    const [memberRes, unitRes] = await Promise.all([
      supabase.from('org_unit_members').select('org_unit_id').eq('user_id', session.userId),
      supabase.from('org_units').select('*'),
    ])
    const userUnitIds = ((memberRes.data ?? []) as { org_unit_id: number }[]).map(m => m.org_unit_id)
    const orgUnits = (unitRes.data ?? []) as OrgUnit[]
    if (!isUserCoveredByUnits(userUnitIds, template.org_unit_ids ?? [], orgUnits)) return null
  }
  return template
}

export async function createSharedFundTemplate(
  name: string,
  fieldValues: Record<string, string>,
  orgUnitIds: number[]
): Promise<{ error: string | null }> {
  if (!orgUnitIds.length) return { error: '請至少勾選一個適用組織範圍' }
  const { error } = await supabase
    .from('funds_allocation_templates')
    .insert({ name, is_shared: true, field_values: fieldValues, org_unit_ids: orgUnitIds })
  return { error: error?.message ?? null }
}

export async function updateSharedFundTemplate(
  id: number,
  name: string,
  fieldValues: Record<string, string>,
  orgUnitIds: number[]
): Promise<{ error: string | null }> {
  if (!orgUnitIds.length) return { error: '請至少勾選一個適用組織範圍' }
  const { error } = await supabase
    .from('funds_allocation_templates')
    .update({ name, field_values: fieldValues, org_unit_ids: orgUnitIds, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_shared', true)
  return { error: error?.message ?? null }
}

export async function deleteSharedFundTemplate(id: number): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('funds_allocation_templates')
    .delete()
    .eq('id', id)
    .eq('is_shared', true)
  return { error: error?.message ?? null }
}

export async function saveUserFundTemplate(
  name: string,
  fieldValues: Record<string, string>
): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '未登入' }
  const { error } = await supabase
    .from('funds_allocation_templates')
    .insert({ name, is_shared: false, created_by: session.userId, field_values: fieldValues })
  return { error: error?.message ?? null }
}

export async function updateUserFundTemplate(
  id: number,
  fieldValues: Record<string, string>
): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '未登入' }
  const { error } = await supabase
    .from('funds_allocation_templates')
    .update({ field_values: fieldValues, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_shared', false)
    .eq('created_by', session.userId)
  return { error: error?.message ?? null }
}

export async function updateUserFundTemplateName(
  id: number,
  name: string
): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '未登入' }
  const { error } = await supabase
    .from('funds_allocation_templates')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_shared', false)
    .eq('created_by', session.userId)
  return { error: error?.message ?? null }
}

export async function deleteUserFundTemplate(id: number): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '未登入' }
  const { error } = await supabase
    .from('funds_allocation_templates')
    .delete()
    .eq('id', id)
    .eq('is_shared', false)
    .eq('created_by', session.userId)
  return { error: error?.message ?? null }
}
