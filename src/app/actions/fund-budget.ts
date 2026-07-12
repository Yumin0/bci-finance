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
 * 只加總「該群組步驟實際按過核准」的審核紀錄裡填的核准金額，
 * 單子到達該步驟但群組尚未核准的不列入；並依所選週次（申請日期）過濾。
 * 被退回的單不列入（資金視為釋回）。
 */
export async function getGroupApprovedTotals(
  weekStart: string,
  weekEnd: string,
  groupId: number
): Promise<Record<string, number>> {
  const { data: allocations } = await supabase
    .from('funds_allocation')
    .select(`
      payment_account, status,
      approval_flow_templates(
        approval_flow_steps(step_number, approval_group_id)
      ),
      approval_records(step_number, decision, approved_amount, reviewed_at)
    `)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .in('status', ['pending', 'approved'])

  const totals: Record<string, number> = {}
  for (const a of (allocations ?? []) as unknown as Array<{
    payment_account: string | null
    status: string
    approval_flow_templates: { approval_flow_steps: Array<{ step_number: number; approval_group_id: number | null }> } | null
    approval_records: Array<{ step_number: number; decision: string; approved_amount: number | null; reviewed_at: string | null }> | null
  }>) {
    const steps = a.approval_flow_templates?.approval_flow_steps ?? []
    // 同範本若多個步驟用同一群組，取最後面且已核准的那步（後面的核准金額承接並取代前面的）
    const groupStepNumbers = steps
      .filter(s => s.approval_group_id === groupId)
      .map(s => s.step_number)
      .sort((x, y) => y - x)
    if (groupStepNumbers.length === 0) continue

    for (const stepNumber of groupStepNumbers) {
      const record = (a.approval_records ?? [])
        .filter(r => r.step_number === stepNumber && r.decision === 'approved')
        .sort((x, y) => (y.reviewed_at ?? '').localeCompare(x.reviewed_at ?? ''))[0]
      if (record) {
        const key = a.payment_account ?? '（未指定帳戶）'
        totals[key] = (totals[key] ?? 0) + (record.approved_amount ?? 0)
        break
      }
    }
  }
  return totals
}
