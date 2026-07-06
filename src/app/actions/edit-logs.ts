'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { emailToEnglishName } from '@/lib/userNames'

export type EditLogEntry = {
  id: number
  changed_by: number | null
  changed_by_name: string
  changed_at: string
  step_number: number | null
  field_label: string
  old_value: string | null
  new_value: string | null
}

export async function logFieldChanges(params: {
  fundsAllocationId: number
  changedBy: number
  changedByName: string
  stepNumber: number | null
  changes: { fieldLabel: string; oldValue: string; newValue: string }[]
}) {
  if (!params.changes.length) return
  const now = new Date().toISOString()
  await supabaseAdmin.from('allocation_edit_logs').insert(
    params.changes.map(c => ({
      funds_allocation_id: params.fundsAllocationId,
      changed_by: params.changedBy,
      changed_by_name: params.changedByName,
      changed_at: now,
      step_number: params.stepNumber,
      field_label: c.fieldLabel,
      old_value: c.oldValue,
      new_value: c.newValue,
    }))
  )
}

export async function getEditLogs(fundsAllocationId: number): Promise<EditLogEntry[]> {
  const { data } = await supabaseAdmin
    .from('allocation_edit_logs')
    .select('*')
    .eq('funds_allocation_id', fundsAllocationId)
    .order('changed_at', { ascending: true })
  const logs = (data ?? []) as EditLogEntry[]

  const userIds = [
    ...new Set(logs.map(l => l.changed_by).filter((id): id is number => id !== null)),
  ]
  if (!userIds.length) return logs

  const { data: users } = await supabaseAdmin
    .from('app_users')
    .select('id, email')
    .in('id', userIds)
  const emailMap = new Map<number, string>(
    (users ?? []).map(u => [u.id as number, u.email as string])
  )

  return logs.map(log => ({
    ...log,
    changed_by_name:
      log.changed_by !== null && emailMap.has(log.changed_by)
        ? emailToEnglishName(emailMap.get(log.changed_by)!)
        : log.changed_by_name,
  }))
}
