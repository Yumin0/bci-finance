import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { FundsPayment, FormSlot } from '@/lib/types'
import { getSession } from '@/lib/session'
import { getUserAllowedItemIds } from '@/app/actions/sidebar-config'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { getFormSchemas } from '@/app/actions/form-schema'
import AllPaymentTableView from './_components/AllPaymentTableView'

export default async function AllPaymentPage() {
  const [session, { data, error }, labelConfig, schemas] = await Promise.all([
    getSession(),
    supabase
      .from('funds_payment')
      .select(`
        *,
        approval_flow_templates(name, approval_flow_steps(step_name, step_number)),
        approval_records!funds_payment_id(step_name, decision)
      `)
      .order('created_at', { ascending: false }),
    getStatusLabelConfig(),
    getFormSchemas(),
  ])

  const canExport = session
    ? await getUserAllowedItemIds(session.userId).then(ids => ids === 'all' || ids.includes('fp-all-export'))
    : false

  const payeeLabel = schemas.payment_voucher
    .flatMap(b => b.rows.flatMap(r => r.slots))
    .find((s): s is NonNullable<FormSlot> => s !== null && s.dataSource?.startsWith('payee_records:') === true)
    ?.label ?? null

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
      <AllPaymentTableView records={records} labelConfig={labelConfig} canExport={canExport} payeeLabel={payeeLabel} />
    </>
  )
}
