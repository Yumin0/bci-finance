'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import type { ApprovalGroup } from '@/lib/types'

export async function getApprovalGroups(): Promise<ApprovalGroup[]> {
  const { data, error } = await supabase
    .from('approval_groups')
    .select('*')
    .order('sort_order')
    .order('id')
  if (error) throw new Error(error.message)
  return (data ?? []) as ApprovalGroup[]
}

export async function createApprovalGroup(name: string): Promise<ApprovalGroup> {
  const { data, error } = await supabase
    .from('approval_groups')
    .insert({ name: name.trim(), sort_order: 0 })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ApprovalGroup
}

export async function updateApprovalGroup(id: number, name: string) {
  const { error } = await supabase
    .from('approval_groups')
    .update({ name: name.trim() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteApprovalGroup(id: number) {
  const { error } = await supabase
    .from('approval_groups')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getGroupMembers(groupId: number) {
  const { data, error } = await supabase
    .from('approval_group_members')
    .select('id, group_id, user_id, created_at, app_users(id, name, email)')
    .eq('group_id', groupId)
    .order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Array<{
    id: number
    group_id: number
    user_id: number
    created_at: string
    app_users: { id: number; name: string; email: string } | null
  }>
}

export async function addGroupMember(groupId: number, userId: number): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('approval_group_members')
    .insert({ group_id: groupId, user_id: userId })
  return { error: error?.message ?? null }
}

export async function removeGroupMember(memberId: number) {
  const { error } = await supabase
    .from('approval_group_members')
    .delete()
    .eq('id', memberId)
  if (error) throw new Error(error.message)
}
