import { supabase } from '@/lib/supabase'
import { MOCK_USER_ID } from '@/lib/constants'
import { FundsAllocation } from '@/lib/types'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import MyFundsTableView from './_components/MyFundsTableView'

export default async function MyFundsPage() {
  const [{ data, error }, labelConfig] = await Promise.all([
    supabase
      .from('funds_allocation')
      .select(`
        *,
        approval_flow_templates(
          name,
          approval_flow_steps(step_name, step_number)
        ),
        approval_records!funds_allocation_id(step_name, decision)
      `)
      .eq('created_by', MOCK_USER_ID)
      .order('created_at', { ascending: false }),
    getStatusLabelConfig(),
  ])

  const records = (data as (FundsAllocation & {
    approval_flow_templates: {
      name: string
      approval_flow_steps: Array<{ step_name: string; step_number: number }>
    } | null
    approval_records: Array<{ step_name: string; decision: string }>
  })[]) ?? []

  return (
    <>
      {error && <p style={{ color: '#dc2626' }}>載入失敗：{error.message}</p>}
      <MyFundsTableView records={records} labelConfig={labelConfig} />
    </>
  )
}
