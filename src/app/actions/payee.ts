'use server'

import { supabase } from '@/lib/supabase'
import type { PayeeCategory, PayeeCategoryField, PayeeFieldType, PayeeRecord } from '@/lib/types'

export async function getPayeeCategories(): Promise<PayeeCategory[]> {
  const { data, error } = await supabase
    .from('payee_categories')
    .select('*')
    .order('sort_order')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getPayeeCategoryFields(categoryId: number): Promise<PayeeCategoryField[]> {
  const { data, error } = await supabase
    .from('payee_category_fields')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getAllPayeeCategoryFields(): Promise<PayeeCategoryField[]> {
  const { data, error } = await supabase
    .from('payee_category_fields')
    .select('*')
    .order('sort_order')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function addPayeeCategory(name: string): Promise<{ error?: string }> {
  const { data: existing } = await supabase
    .from('payee_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
  const maxOrder = existing?.[0]?.sort_order ?? -1
  const { error } = await supabase
    .from('payee_categories')
    .insert({ name, sort_order: maxOrder + 1 })
  return error ? { error: error.message } : {}
}

export async function updatePayeeCategory(id: number, name: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('payee_categories')
    .update({ name })
    .eq('id', id)
  return error ? { error: error.message } : {}
}

export async function deletePayeeCategory(id: number): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('payee_categories')
    .delete()
    .eq('id', id)
  return error ? { error: error.message } : {}
}

export async function addPayeeCategoryField(
  categoryId: number,
  label: string,
  fieldType: PayeeFieldType,
  options: string[] | null,
): Promise<{ error?: string }> {
  const { data: existing } = await supabase
    .from('payee_category_fields')
    .select('sort_order')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const maxOrder = existing?.[0]?.sort_order ?? -1
  const { error } = await supabase
    .from('payee_category_fields')
    .insert({ category_id: categoryId, label, field_type: fieldType, options, sort_order: maxOrder + 1 })
  return error ? { error: error.message } : {}
}

export async function updatePayeeCategoryField(
  id: number,
  label: string,
  fieldType: PayeeFieldType,
  options: string[] | null,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('payee_category_fields')
    .update({ label, field_type: fieldType, options })
    .eq('id', id)
  return error ? { error: error.message } : {}
}

export async function deletePayeeCategoryField(id: number): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('payee_category_fields')
    .delete()
    .eq('id', id)
  return error ? { error: error.message } : {}
}

// ---- Payee Records ----

export async function getPayeeRecords(categoryId: number): Promise<PayeeRecord[]> {
  const { data, error } = await supabase
    .from('payee_records')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function addPayeeRecord(
  categoryId: number,
  fieldValues: Record<string, string>,
): Promise<{ error?: string }> {
  const { data: existing } = await supabase
    .from('payee_records')
    .select('sort_order')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const maxOrder = existing?.[0]?.sort_order ?? -1
  const { error } = await supabase
    .from('payee_records')
    .insert({ category_id: categoryId, field_values: fieldValues, sort_order: maxOrder + 1 })
  return error ? { error: error.message } : {}
}

export async function updatePayeeRecord(
  id: number,
  fieldValues: Record<string, string>,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('payee_records')
    .update({ field_values: fieldValues })
    .eq('id', id)
  return error ? { error: error.message } : {}
}

export async function deletePayeeRecord(id: number): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('payee_records')
    .delete()
    .eq('id', id)
  return error ? { error: error.message } : {}
}
