import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { FundsPayment } from '@/lib/types'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import MyPaymentTableView from './_components/MyPaymentTableView'

export default async function MyPaymentPage() {
  const [session, labelConfig] = await Promise.all([
    getSession(),
    getStatusLabelConfig(),
  ])

  const { data, error } = await supabase
    .from('funds_payment')
    .select(`
      *,
      approval_flow_templates(name, approval_flow_steps(step_name, step_number)),
      approval_records!funds_payment_id(step_name, decision)
    `)
    .eq('created_by', String(session?.userId ?? ''))
    .order('created_at', { ascending: false })

  const records = (data as (FundsPayment & {
    approval_flow_templates: {
      name: string
      approval_flow_steps: Array<{ step_name: string; step_number: number }>
    } | null
    approval_records: Array<{ step_name: string; decision: string }>
  })[]) ?? []

  return (
    <>
      {error && <p style={{ color: '#dc2626' }}>載入失敗：{error.message}</p>}
      <MyPaymentTableView records={records} labelConfig={labelConfig} />
    </>
  )
}
