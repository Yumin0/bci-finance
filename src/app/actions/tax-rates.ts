'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { TaxRateOption, TaxFormulaStep } from '@/lib/types'

export async function getTaxRateOptions(): Promise<TaxRateOption[]> {
  const { data, error } = await supabase
    .from('tax_rate_options')
    .select('*')
    .order('sort_order')
  if (error) return []
  return (data ?? []) as TaxRateOption[]
}

export async function upsertTaxRateOption(option: {
  id?: number
  label: string
  formula_steps: TaxFormulaStep[]
  sort_order: number
}): Promise<{ error: string | null }> {
  const payload = {
    label: option.label,
    formula_steps: option.formula_steps,
    sort_order: option.sort_order,
  }
  const { error } = option.id
    ? await supabase.from('tax_rate_options').update(payload).eq('id', option.id)
    : await supabase.from('tax_rate_options').insert(payload)
  return { error: error?.message ?? null }
}

export async function deleteTaxRateOption(id: number): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tax_rate_options').delete().eq('id', id)
  return { error: error?.message ?? null }
}
