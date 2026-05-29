'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

type FundsAllocationPayload = {
  date: string
  applicant: string
  apply_division: string | null
  apply_section: string | null
  apply_role: string | null
  institution: string | null
  payment_account: string | null
  expense_item: string | null
  name: string | null
  amount: number
  category: string | null
  note: string | null
  extra_data: Record<string, string>
  status: 'draft' | 'pending'
  flow_template_id: number | null
  current_step: number | null
  created_by: string
  serial_number?: string
}

export async function createFundsAllocation(payload: FundsAllocationPayload) {
  const { data, error } = await supabase
    .from('funds_allocation')
    .insert(payload)
    .select('id')
    .single()
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function generateSerialNumber(): Promise<string> {
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }).replace(/-/g, '')
  const { count } = await supabase
    .from('funds_allocation')
    .select('id', { count: 'exact', head: true })
    .like('serial_number', `${dateStr}%`)
  const seq = ((count ?? 0) + 1).toString().padStart(3, '0')
  return `${dateStr}${seq}`
}
