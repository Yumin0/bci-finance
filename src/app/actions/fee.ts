'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import type { FeeCategory, FeeSubcategory, FeeCategoryField, PayeeFieldType, FeeRecord } from '@/lib/types'

export async function getFeeCategories(): Promise<FeeCategory[]> {
  const { data, error } = await supabase
    .from('fee_categories')
    .select('*')
    .order('sort_order')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getAllFeeCategoryFields(): Promise<FeeCategoryField[]> {
  const { data, error } = await supabase
    .from('fee_category_fields')
    .select('*')
    .order('sort_order')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getAllFeeSubcategories(): Promise<FeeSubcategory[]> {
  const { data, error } = await supabase
    .from('fee_subcategories')
    .select('*')
    .order('sort_order')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function addFeeCategory(name: string): Promise<{ error?: string }> {
  const { data: existing } = await supabase
    .from('fee_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
  const maxOrder = existing?.[0]?.sort_order ?? -1
  const { error } = await supabase
    .from('fee_categories')
    .insert({ name, sort_order: maxOrder + 1 })
  return error ? { error: error.message } : {}
}

export async function updateFeeCategory(id: number, name: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('fee_categories')
    .update({ name })
    .eq('id', id)
  return error ? { error: error.message } : {}
}

export async function deleteFeeCategory(id: number): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('fee_categories')
    .delete()
    .eq('id', id)
  return error ? { error: error.message } : {}
}

// ---- Subcategories ----

export async function addFeeSubcategory(categoryId: number, name: string): Promise<{ error?: string }> {
  const { data: existing } = await supabase
    .from('fee_subcategories')
    .select('sort_order')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const maxOrder = existing?.[0]?.sort_order ?? -1
  const { error } = await supabase
    .from('fee_subcategories')
    .insert({ category_id: categoryId, name, sort_order: maxOrder + 1 })
  return error ? { error: error.message } : {}
}

export async function updateFeeSubcategory(id: number, name: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('fee_subcategories')
    .update({ name })
    .eq('id', id)
  return error ? { error: error.message } : {}
}

export async function deleteFeeSubcategory(id: number): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('fee_subcategories')
    .delete()
    .eq('id', id)
  return error ? { error: error.message } : {}
}

// ---- Fields ----

export async function addFeeCategoryField(
  categoryId: number,
  label: string,
  fieldType: PayeeFieldType,
  options: string[] | null,
): Promise<{ error?: string }> {
  const { data: existing } = await supabase
    .from('fee_category_fields')
    .select('sort_order')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const maxOrder = existing?.[0]?.sort_order ?? -1
  const { error } = await supabase
    .from('fee_category_fields')
    .insert({ category_id: categoryId, label, field_type: fieldType, options, sort_order: maxOrder + 1 })
  return error ? { error: error.message } : {}
}

export async function updateFeeCategoryField(
  id: number,
  label: string,
  fieldType: PayeeFieldType,
  options: string[] | null,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('fee_category_fields')
    .update({ label, field_type: fieldType, options })
    .eq('id', id)
  return error ? { error: error.message } : {}
}

export async function deleteFeeCategoryField(id: number): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('fee_category_fields')
    .delete()
    .eq('id', id)
  return error ? { error: error.message } : {}
}

// ---- Records ----

export async function getFeeRecords(categoryId: number): Promise<FeeRecord[]> {
  const { data, error } = await supabase
    .from('fee_records')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function addFeeRecord(
  categoryId: number,
  fieldValues: Record<string, string>,
  subcategoryId: number | null,
): Promise<{ error?: string }> {
  const { data: existing } = await supabase
    .from('fee_records')
    .select('sort_order')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const maxOrder = existing?.[0]?.sort_order ?? -1
  const { error } = await supabase
    .from('fee_records')
    .insert({ category_id: categoryId, field_values: fieldValues, subcategory_id: subcategoryId, sort_order: maxOrder + 1 })
  return error ? { error: error.message } : {}
}

export async function updateFeeRecord(
  id: number,
  fieldValues: Record<string, string>,
  subcategoryId: number | null,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('fee_records')
    .update({ field_values: fieldValues, subcategory_id: subcategoryId })
    .eq('id', id)
  return error ? { error: error.message } : {}
}

export async function deleteFeeRecord(id: number): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('fee_records')
    .delete()
    .eq('id', id)
  return error ? { error: error.message } : {}
}
