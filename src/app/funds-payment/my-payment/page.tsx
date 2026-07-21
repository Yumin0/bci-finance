import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/session'
import { FundsPayment, FormSlot } from '@/lib/types'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { getFormSchemas } from '@/app/actions/form-schema'
import { getVoucherCompletionStatuses } from '@/lib/paymentVoucherStatus'
import MyPaymentTableView from './_components/MyPaymentTableView'

export default async function MyPaymentPage() {
  const [session, labelConfig, schemas] = await Promise.all([
    getSession(),
    getStatusLabelConfig(),
    getFormSchemas(),
  ])

  const payeeLabel = schemas.payment_voucher
    .flatMap(b => b.rows.flatMap(r => r.slots))
    .find((s): s is NonNullable<FormSlot> => s !== null && s.dataSource?.startsWith('payee_records:') === true)
    ?.label ?? null

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

  const voucherStatuses = await getVoucherCompletionStatuses(records)

  return (
    <>
      {error && <p style={{ color: '#dc2626' }}>載入失敗：{error.message}</p>}
      <MyPaymentTableView records={records} labelConfig={labelConfig} payeeLabel={payeeLabel} voucherStatuses={voucherStatuses} />
    </>
  )
}
