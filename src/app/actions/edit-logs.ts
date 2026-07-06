'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

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
  return (data ?? []) as EditLogEntry[]
}
