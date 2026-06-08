import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/session'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { FundsAllocation, FundsPayment } from '@/lib/types'
import HomeTabView from './_components/HomeTabView'

const FUNDS_JOIN_SELECT = `*, approval_flow_templates(approval_flow_steps(step_name, step_number)), approval_records!funds_allocation_id(step_name, decision)`
const PAYMENT_JOIN_SELECT = `*, approval_flow_templates(approval_flow_steps(step_name, step_number)), approval_records!funds_payment_id(step_name, decision)`
const VOUCHER_JOIN_SELECT = `*, approval_flow_templates(approval_flow_steps(step_name, step_number)), approval_records!temp_voucher_id(step_name, decision)`

type StepJoin = {
  status: string
  current_step: number | null
  approval_flow_templates: { approval_flow_steps: Array<{ step_name: string; step_number: number }> } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

function computeStepName(r: StepJoin): string | null {
  if (r.status === 'pending') {
    return r.approval_flow_templates?.approval_flow_steps?.find(
      s => s.step_number === r.current_step
    )?.step_name ?? null
  }
  if (r.status === 'rejected') {
    return r.approval_records?.find(a => a.decision === 'rejected')?.step_name ?? null
  }
  if (r.status === 'approved') {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    if (steps.length === 0) return null
    return steps.reduce((max, s) => s.step_number > max.step_number ? s : max, steps[0])?.step_name ?? null
  }
  return null
}

export default async function Home() {
  const [session, labelConfig] = await Promise.all([
    getSession(),
    getStatusLabelConfig(),
  ])

  const [fundsResult, paymentResult, voucherResult] = await Promise.all([
    supabase
      .from('funds_allocation')
      .select(FUNDS_JOIN_SELECT)
      .eq('created_by', String(session?.userId ?? ''))
      .order('created_at', { ascending: false }),
    supabase
      .from('funds_payment')
      .select(PAYMENT_JOIN_SELECT)
      .eq('created_by', String(session?.userId ?? ''))
      .order('created_at', { ascending: false }),
    supabase
      .from('temp_vouchers')
      .select(VOUCHER_JOIN_SELECT)
      .eq('created_by', session?.userId ?? 0)
      .order('created_at', { ascending: false }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function addStep(data: any): any {
    return (data ?? []).map((r: StepJoin) => ({ ...r, stepName: computeStepName(r) }))
  }

  const fundsRecords = addStep(fundsResult.data)
  const paymentRecords = addStep(paymentResult.data)
  const voucherRecords = addStep(voucherResult.data)

  return (
    <HomeTabView
      fundsRecords={fundsRecords}
      paymentRecords={paymentRecords}
      voucherRecords={voucherRecords}
      labelConfig={labelConfig}
    />
  )
}
