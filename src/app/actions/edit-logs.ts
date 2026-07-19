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

// 三種單據共用 allocation_edit_logs 一張表（比照 approval_records 的三個 FK 欄位設計）：
// funds_allocation_id / funds_payment_id / temp_voucher_id 擇一有值
export type EditLogTarget = {
  fundsAllocationId?: number
  fundsPaymentId?: number
  tempVoucherId?: number
}

function targetColumns(target: EditLogTarget): Record<string, number> | null {
  if (target.fundsAllocationId) return { funds_allocation_id: target.fundsAllocationId }
  if (target.fundsPaymentId) return { funds_payment_id: target.fundsPaymentId }
  if (target.tempVoucherId) return { temp_voucher_id: target.tempVoucherId }
  return null
}

export async function logFieldChanges(params: EditLogTarget & {
  changedBy: number
  changedByName: string
  stepNumber: number | null
  changes: { fieldLabel: string; oldValue: string; newValue: string }[]
}) {
  if (!params.changes.length) return
  const cols = targetColumns(params)
  if (!cols) return
  const now = new Date().toISOString()
  const { error } = await supabaseAdmin.from('allocation_edit_logs').insert(
    params.changes.map(c => ({
      ...cols,
      changed_by: params.changedBy,
      changed_by_name: params.changedByName,
      changed_at: now,
      step_number: params.stepNumber,
      field_label: c.fieldLabel,
      old_value: c.oldValue,
      new_value: c.newValue,
    }))
  )
  // 資料庫尚未加 funds_payment_id/temp_voucher_id 欄位時 insert 會失敗：
  // 不擋儲存主流程，只記 console（比照 approved_items 未加欄的降級策略）
  if (error) console.error('logFieldChanges insert error:', error.message)
}

export async function getEditLogs(target: EditLogTarget): Promise<EditLogEntry[]> {
  const cols = targetColumns(target)
  if (!cols) return []
  let query = supabaseAdmin.from('allocation_edit_logs').select('*')
  for (const [col, val] of Object.entries(cols)) query = query.eq(col, val)
  const { data } = await query.order('changed_at', { ascending: true })
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
