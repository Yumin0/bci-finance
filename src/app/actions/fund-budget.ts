'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export async function saveFundWeeklyBudget(weekStart: string, paymentAccount: string, budget: number) {
  const { error } = await supabase
    .from('fund_weekly_budgets')
    .upsert(
      { week_start: weekStart, payment_account: paymentAccount, budget, updated_at: new Date().toISOString() },
      { onConflict: 'week_start,payment_account' }
    )
  return { error: error?.message ?? null }
}

export async function getWeeklyBudgetSummary(weekStart: string): Promise<{
  budgets: Record<string, number>
}> {
  const { data } = await supabase
    .from('fund_weekly_budgets')
    .select('payment_account, budget')
    .eq('week_start', weekStart)

  const budgets: Record<string, number> = {}
  for (const b of data ?? []) budgets[b.payment_account] = b.budget
  return { budgets }
}

/**
 * 計算指定審核群組的「已核准總額」：
 * 只計算申請單的當前步驟已到達該群組步驟（或更後面）的金額加總。
 */
export async function getGroupReachedTotals(
  _weekStart: string,
  groupId: number
): Promise<Record<string, number>> {
  // 不限週別：審核管理顯示的是所有待審核申請，已核准總額也應涵蓋全部已到達該階段的申請
  const { data: allocations } = await supabase
    .from('funds_allocation')
    .select(`
      amount, approved_amount, payment_account, status, current_step,
      approval_flow_templates(
        approval_flow_steps(step_number, approval_group_id)
      )
    `)
    .in('status', ['pending', 'approved'])

  const totals: Record<string, number> = {}
  for (const a of (allocations ?? []) as unknown as Array<{
    amount: number
    approved_amount: number | null
    payment_account: string | null
    status: string
    current_step: number | null
    approval_flow_templates: { approval_flow_steps: Array<{ step_number: number; approval_group_id: number | null }> } | null
  }>) {
    const steps = a.approval_flow_templates?.approval_flow_steps ?? []
    const groupStep = steps.find(s => s.approval_group_id === groupId)
    if (!groupStep) continue

    const reached =
      a.status === 'approved' ||
      (a.current_step !== null && a.current_step >= groupStep.step_number)

    if (reached) {
      const key = a.payment_account ?? '（未指定帳戶）'
      totals[key] = (totals[key] ?? 0) + (a.approved_amount ?? a.amount ?? 0)
    }
  }
  return totals
}
