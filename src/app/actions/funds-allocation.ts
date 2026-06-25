'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { notifyReviewersForStep } from './notifications'

type FundsAllocationPayload = {
  date: string
  applicant: string
  apply_division: string | null
  apply_section: string | null
  apply_division_id: number | null
  apply_section_id: number | null
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

  if (payload.status === 'pending' && payload.flow_template_id && data) {
    notifyReviewersForStep({
      templateId: payload.flow_template_id,
      stepNumber: 1,
      applyDivisionId: payload.apply_division_id,
      applySectionId: payload.apply_section_id,
      title: '資金分配申請待審核',
      body: payload.name,
      link: `/funds-allocation/review/check/${data.id}`,
      fundsAllocationId: data.id,
    }).catch(e => console.error('Notification error:', e))
  }

  return { data, error: null }
}

export async function updateFundsAllocation(
  id: number,
  updates: Partial<FundsAllocationPayload> & { updated_at?: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('funds_allocation').update(updates).eq('id', id)
  if (error) return { error: error.message }

  if (updates.status === 'pending' && updates.flow_template_id) {
    notifyReviewersForStep({
      templateId: updates.flow_template_id,
      stepNumber: 1,
      applyDivisionId: updates.apply_division_id ?? null,
      applySectionId: updates.apply_section_id ?? null,
      title: '資金分配申請待審核',
      body: updates.name ?? null,
      link: `/funds-allocation/review/check/${id}`,
      fundsAllocationId: id,
    }).catch(e => console.error('Notification error:', e))
  }

  return { error: null }
}

export async function deleteFundsAllocation(id: number): Promise<{ error: string | null }> {
  const { error } = await supabase.from('funds_allocation').delete().eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}

export async function generateSerialNumber(applyDate?: string): Promise<string> {
  const dateStr = applyDate
    ? applyDate.replace(/-/g, '')
    : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }).replace(/-/g, '')
  const { count } = await supabase
    .from('funds_allocation')
    .select('id', { count: 'exact', head: true })
    .like('serial_number', `${dateStr}%`)
  const seq = ((count ?? 0) + 1).toString().padStart(3, '0')
  return `${dateStr}${seq}`
}
