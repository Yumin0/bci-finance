import { supabase } from '@/lib/supabase'
import { FundsPayment } from '@/lib/types'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import AllPaymentTableView from './_components/AllPaymentTableView'

export default async function AllPaymentPage() {
  const [{ data, error }, labelConfig] = await Promise.all([
    supabase
      .from('funds_payment')
      .select(`
        *,
        approval_flow_templates(name, approval_flow_steps(step_name, step_number)),
        approval_records!funds_payment_id(step_name, decision)
      `)
      .order('created_at', { ascending: false }),
    getStatusLabelConfig(),
  ])

  const records = (data ?? []) as (FundsPayment & {
    approval_flow_templates: {
      name: string
      approval_flow_steps: Array<{ step_name: string; step_number: number }>
    } | null
    approval_records: Array<{ step_name: string; decision: string }>
  })[]

  return (
    <>
      {error && <p style={{ color: '#dc2626' }}>載入失敗：{error.message}</p>}
      <AllPaymentTableView records={records} labelConfig={labelConfig} />
    </>
  )
}
