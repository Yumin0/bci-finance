import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { FundsAllocation } from '@/lib/types'
import { getSession } from '@/lib/session'
import { getUserAllowedItemIds } from '@/app/actions/sidebar-config'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { resolveApplicantNames } from '@/lib/resolveApplicantNames'
import { calcRemainingAmount, type PaymentForRemaining } from '@/lib/fundsAllocationRemaining'
import AllFundsTableView from './_components/AllFundsTableView'

export default async function AllFundsPage() {
  const [session, labelConfig] = await Promise.all([
    getSession(),
    getStatusLabelConfig(),
  ])
  const canExport = session
    ? await getUserAllowedItemIds(session.userId).then(ids => ids === 'all' || ids.includes('fa-all-export'))
    : false

  const { data, error } = await supabase
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
    .order('created_at', { ascending: false })

  const rawRecords = (data ?? []) as (FundsAllocation & {
    approval_flow_templates: {
      name: string
      approval_flow_steps: Array<{ step_name: string; step_number: number }>
    } | null
    approval_records: Array<{ step_name: string; decision: string }>
    funds_payment: PaymentForRemaining[]
  })[]
  const records = (await resolveApplicantNames(rawRecords)).map(r => ({
    ...r,
    remainingAmount: calcRemainingAmount(r.approved_amount, r.funds_payment ?? []),
  }))

  return (
    <>
      {error && <p style={{ color: '#dc2626' }}>載入失敗：{error.message}</p>}
      <AllFundsTableView
        records={records}
        labelConfig={labelConfig}
        canExport={canExport}
      />
    </>
  )
}
