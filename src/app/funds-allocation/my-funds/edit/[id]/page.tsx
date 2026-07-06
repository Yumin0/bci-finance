import { notFound } from 'next/navigation'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/session'
import { getFormSchemas } from '@/app/actions/form-schema'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { checkCanReviewStep } from '@/app/actions/approval-flow'
import { FundsAllocation } from '@/lib/types'
import EditFundsForm from './_components/EditFundsForm'

export default async function EditFundsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const fromReview = sp.from === 'review'

  const [{ data }, session, schemas, labelConfig] = await Promise.all([
    supabase.from('funds_allocation').select('*').eq('id', Number(id)).single(),
    getSession(),
    getFormSchemas(),
    getStatusLabelConfig(),
  ])

  if (!data) notFound()
  const record = data as FundsAllocation

  let isCurrentReviewer = false
  if (session?.userId && record.status === 'pending' && record.current_step !== null && record.flow_template_id) {
    const { data: stepData } = await supabase
      .from('approval_flow_steps')
      .select('step_number, step_name, reviewer_type, role_type_id, org_unit_type, system_role_id, approval_group_id')
      .eq('template_id', record.flow_template_id)
      .eq('step_number', record.current_step)
      .single()
    if (stepData) {
      isCurrentReviewer = await checkCanReviewStep({
        userId: session.userId,
        stepDef: stepData,
        applyDivisionId: record.apply_division_id,
        applySectionId: record.apply_section_id,
      })
    }
  }

  return (
    <EditFundsForm
      record={record}
      schema={schemas.funds_allocation}
      applicantName={session?.name ?? ''}
      userId={session?.userId ?? null}
      labelConfig={labelConfig}
      isCurrentReviewer={isCurrentReviewer}
      fromReview={fromReview}
    />
  )
}
