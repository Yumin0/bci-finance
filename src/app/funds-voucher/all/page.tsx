import { supabase } from '@/lib/supabase'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import AllVoucherTableView from './_components/AllVoucherTableView'

type TempVoucherRow = {
  id: number
  funds_payment_id: number
  date: string | null
  apply_section: string | null
  applicant: string | null
  amount: number | null
  status: string
  current_step: number | null
  created_at: string
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

export default async function AllVoucherPage() {
  const [{ data, error }, labelConfig] = await Promise.all([
    supabase
      .from('temp_vouchers')
      .select(`
        *,
        approval_flow_templates(name, approval_flow_steps(step_name, step_number)),
        approval_records!temp_voucher_id(step_name, decision)
      `)
      .order('created_at', { ascending: false }),
    getStatusLabelConfig(),
  ])

  const records = (data ?? []) as TempVoucherRow[]

  return (
    <>
      {error && <p style={{ color: '#dc2626' }}>載入失敗：{error.message}</p>}
      <AllVoucherTableView records={records} labelConfig={labelConfig} />
    </>
  )
}
