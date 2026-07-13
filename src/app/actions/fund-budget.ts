'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { FUNDS_STATUS } from '@/lib/constants'
import { calcRemainingAmount, type PaymentForRemaining } from '@/lib/fundsAllocationRemaining'

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
    .in('status', ['pending', 'approved', FUNDS_STATUS.PAID])

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

// 付款憑單頁面頂部「已核准資金分配申請單」對照卡片所需的母單摘要 + 核准/剩餘金額。
// 對齊舊系統：單號/處別/課別/日期/申請人/職稱/核准金額/剩餘金額/幣別/機構/出款帳戶/費用項目/項目。
export type AllocationRemainingInfo = {
  approvedAmount: number | null
  remaining: number
  summary: {
    allocationId: number
    serialNumber: string | null
    applyDivision: string | null
    applySection: string | null
    date: string | null
    applicant: string | null
    applyRole: string | null
    institution: string | null
    paymentAccount: string | null
    expenseItem: string | null
    name: string | null
    currency: string | null
  }
}

/**
 * 查詢資金分配單的母單摘要、目前的核准金額與剩餘可用額度，
 * 供「建立付款憑單」「草稿編輯」「審核付款憑單」頁面的對照卡片使用。
 * excludePaymentId：編輯/審核某張既有憑單時，排除它自己目前佔用的金額，
 * 否則這張憑單自己的金額會被算成「已佔用」，顯示的剩餘會比實際能填的還少。
 */
export async function getAllocationRemainingInfo(
  allocationId: number,
  excludePaymentId?: number
): Promise<AllocationRemainingInfo | null> {
  const { data: alloc } = await supabase
    .from('funds_allocation')
    .select('id, serial_number, apply_division, apply_section, date, applicant, apply_role, institution, payment_account, expense_item, name, approved_amount, extra_data')
    .eq('id', allocationId)
    .single()
  if (!alloc) return null

  const { data: payments } = await supabase
    .from('funds_payment')
    .select('id, status, amount, approved_amount')
    .eq('funds_allocation_id', allocationId)

  const relevant = (payments ?? []).filter(p => p.id !== excludePaymentId) as PaymentForRemaining[]
  const remaining = calcRemainingAmount(alloc.approved_amount, relevant)
  const extra = (alloc.extra_data ?? {}) as Record<string, string>
  return {
    approvedAmount: alloc.approved_amount,
    remaining,
    summary: {
      allocationId: alloc.id,
      serialNumber: alloc.serial_number ?? null,
      applyDivision: alloc.apply_division ?? null,
      applySection: alloc.apply_section ?? null,
      date: alloc.date ?? null,
      applicant: alloc.applicant ?? null,
      applyRole: alloc.apply_role ?? null,
      institution: alloc.institution ?? null,
      paymentAccount: alloc.payment_account ?? null,
      expenseItem: alloc.expense_item ?? null,
      name: alloc.name ?? null,
      currency: extra['幣別'] ?? null,
    },
  }
}

/**
 * 付款憑單完成付款後呼叫：若資金分配單剩餘金額已歸零，自動轉為「已付款」狀態（結案）。
 * 只在真正撥款完成（confirmPayment）時檢查，不在憑單審核核准當下觸發——
 * 「已付款」代表錢真的付出去了。
 */
export async function recalcAllocationCloseStatus(allocationId: number): Promise<void> {
  const { data: alloc } = await supabase
    .from('funds_allocation')
    .select('status, approved_amount')
    .eq('id', allocationId)
    .single()
  if (!alloc || alloc.status !== FUNDS_STATUS.APPROVED) return

  const { data: payments } = await supabase
    .from('funds_payment')
    .select('status, amount, approved_amount')
    .eq('funds_allocation_id', allocationId)

  const remaining = calcRemainingAmount(alloc.approved_amount, (payments ?? []) as PaymentForRemaining[])
  if (remaining <= 0) {
    await supabase
      .from('funds_allocation')
      .update({ status: FUNDS_STATUS.PAID, updated_at: new Date().toISOString() })
      .eq('id', allocationId)
  }
}
