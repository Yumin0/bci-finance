import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/session'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import MyVoucherTableView from './_components/MyVoucherTableView'

type TempVoucherRow = {
  id: number
  funds_payment_id: number
  serial_number: string | null
  date: string | null
  amount: number | null
  applicant: string | null
  status: string
  current_step: number | null
  flow_template_id: number | null
  created_at: string
  funds_payment: { purchase_order_number: string | null } | null
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

export default async function MyVoucherPage() {
  const [session, labelConfig] = await Promise.all([
    getSession(),
    getStatusLabelConfig(),
  ])

  const { data, error } = await supabase
    .from('temp_vouchers')
    .select(`
      *,
      funds_payment:funds_payment_id(purchase_order_number),
      approval_flow_templates(name, approval_flow_steps(step_name, step_number)),
      approval_records!temp_voucher_id(step_name, decision)
    `)
    .eq('created_by', session?.userId ?? 0)
    .order('created_at', { ascending: false })

  const records = (data as TempVoucherRow[]) ?? []

  return (
    <>
      {error && <p style={{ color: '#dc2626' }}>載入失敗：{error.message}</p>}
      <MyVoucherTableView records={records} labelConfig={labelConfig} />
    </>
  )
}
