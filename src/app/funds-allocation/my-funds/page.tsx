import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/session'
import { FundsAllocation } from '@/lib/types'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { resolveApplicantNames } from '@/lib/resolveApplicantNames'
import { calcRemainingAmount, type PaymentForRemaining } from '@/lib/fundsAllocationRemaining'
import MyFundsTableView from './_components/MyFundsTableView'

export default async function MyFundsPage() {
  const session = await getSession()
  const [{ data, error }, labelConfig] = await Promise.all([
    supabase
      .from('funds_allocation')
      .select(`
        *,
        approval_flow_templates(
          name,
          approval_flow_steps(step_name, step_number)
        ),
        approval_records!funds_allocation_id(step_name, decision),
        funds_payment(status, amount, approved_amount)
      `)
      .eq('created_by', String(session?.userId ?? ''))
      .order('created_at', { ascending: false }),
    getStatusLabelConfig(),
  ])

  const rawRecords = (data as (FundsAllocation & {
    approval_flow_templates: {
      name: string
      approval_flow_steps: Array<{ step_name: string; step_number: number }>
    } | null
    approval_records: Array<{ step_name: string; decision: string }>
    funds_payment: PaymentForRemaining[]
  })[]) ?? []
  const records = (await resolveApplicantNames(rawRecords)).map(r => ({
    ...r,
    remainingAmount: calcRemainingAmount(r.approved_amount, r.funds_payment ?? []),
  }))

  return (
    <>
      {error && <p style={{ color: '#dc2626' }}>載入失敗：{error.message}</p>}
      <MyFundsTableView records={records} labelConfig={labelConfig} />
    </>
  )
}
