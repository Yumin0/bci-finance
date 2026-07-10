'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { notifyReviewersForStep } from './notifications'
import { emailToEnglishName } from '@/lib/userNames'

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
  const finalPayload = { ...payload }
  if (finalPayload.status === 'pending' && !finalPayload.serial_number) {
    finalPayload.serial_number = await generateSerialNumber(finalPayload.date)
  }

  const { data, error } = await supabase
    .from('funds_allocation')
    .insert(finalPayload)
    .select('id')
    .single()
  if (error) return { data: null, error: error.message }

  if (payload.status === 'pending' && payload.flow_template_id && data) {
    ;(async () => {
      try {
        const createdById = parseInt(String(payload.created_by), 10)
        const { data: user } = await supabase.from('app_users').select('email').eq('id', createdById).single()
        const body = user?.email ? `申請人：${emailToEnglishName(user.email)}` : payload.name
        await notifyReviewersForStep({
          templateId: payload.flow_template_id!,
          stepNumber: 1,
          applyDivisionId: payload.apply_division_id,
          applySectionId: payload.apply_section_id,
          title: '資金分配申請待審核',
          itemName: payload.name,
          body,
          link: `/funds-allocation/review/check/${data!.id}`,
          fundsAllocationId: data!.id,
        })
      } catch (e) { console.error('Notification error:', e) }
    })()
  }

  return { data, error: null }
}

export async function updateFundsAllocation(
  id: number,
  updates: Partial<FundsAllocationPayload> & { updated_at?: string }
): Promise<{ error: string | null }> {
  const finalUpdates = { ...updates }
  if (finalUpdates.status === 'pending' && !finalUpdates.serial_number) {
    const { data: existing } = await supabase
      .from('funds_allocation')
      .select('serial_number, date')
      .eq('id', id)
      .single()
    if (!existing?.serial_number) {
      finalUpdates.serial_number = await generateSerialNumber(finalUpdates.date ?? existing?.date)
    }
  }

  const { error } = await supabase.from('funds_allocation').update(finalUpdates).eq('id', id)
  if (error) return { error: error.message }

  if (updates.status === 'pending' && updates.flow_template_id) {
    const createdById = updates.created_by ? parseInt(String(updates.created_by), 10) : null
    const doNotify = async (body: string | null, itemName: string | null) => {
      try {
        await notifyReviewersForStep({
          templateId: updates.flow_template_id!,
          stepNumber: 1,
          applyDivisionId: updates.apply_division_id ?? null,
          applySectionId: updates.apply_section_id ?? null,
          title: '資金分配申請待審核',
          itemName,
          body,
          link: `/funds-allocation/review/check/${id}`,
          fundsAllocationId: id,
        })
      } catch (e) { console.error('Notification error:', e) }
    }

    ;(async () => {
      try {
        let itemName: string | null = updates.name ?? null
        if (!itemName) {
          const { data: alloc } = await supabase.from('funds_allocation').select('name').eq('id', id).single()
          itemName = alloc?.name ?? null
        }
        let body: string | null = itemName
        if (createdById) {
          const { data: user } = await supabase.from('app_users').select('email').eq('id', createdById).single()
          if (user?.email) body = `申請人：${emailToEnglishName(user.email)}`
        }
        await doNotify(body, itemName)
      } catch (e) { console.error('Notification error:', e) }
    })()
  }

  return { error: null }
}

export async function deleteFundsAllocation(id: number): Promise<{ error: string | null }> {
  await supabase.from('notifications').delete().eq('funds_allocation_id', id)
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
