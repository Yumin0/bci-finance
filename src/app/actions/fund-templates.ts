'use server'
import { supabase } from '@/lib/supabase'
import { FundsAllocationTemplate } from '@/lib/types'

export async function getSharedFundTemplates(): Promise<FundsAllocationTemplate[]> {
  const { data } = await supabase
    .from('funds_allocation_templates')
    .select('*')
    .eq('is_shared', true)
    .order('created_at', { ascending: true })
  return (data ?? []) as FundsAllocationTemplate[]
}

export async function getUserFundTemplates(userId: string): Promise<FundsAllocationTemplate[]> {
  const { data } = await supabase
    .from('funds_allocation_templates')
    .select('*')
    .eq('is_shared', false)
    .eq('created_by', userId)
    .order('created_at', { ascending: true })
  return (data ?? []) as FundsAllocationTemplate[]
}

export async function getFundTemplateById(id: number): Promise<FundsAllocationTemplate | null> {
  const { data } = await supabase
    .from('funds_allocation_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return data as FundsAllocationTemplate | null
}

export async function createSharedFundTemplate(
  name: string,
  fieldValues: Record<string, string>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('funds_allocation_templates')
    .insert({ name, is_shared: true, field_values: fieldValues })
  return { error: error?.message ?? null }
}

export async function updateSharedFundTemplate(
  id: number,
  name: string,
  fieldValues: Record<string, string>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('funds_allocation_templates')
    .update({ name, field_values: fieldValues, updated_at: new Date().toISOString() })
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
  fieldValues: Record<string, string>,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('funds_allocation_templates')
    .insert({ name, is_shared: false, created_by: userId, field_values: fieldValues })
  return { error: error?.message ?? null }
}

export async function updateUserFundTemplateName(
  id: number,
  name: string,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('funds_allocation_templates')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_shared', false)
    .eq('created_by', userId)
  return { error: error?.message ?? null }
}

export async function deleteUserFundTemplate(
  id: number,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('funds_allocation_templates')
    .delete()
    .eq('id', id)
    .eq('is_shared', false)
    .eq('created_by', userId)
  return { error: error?.message ?? null }
}
