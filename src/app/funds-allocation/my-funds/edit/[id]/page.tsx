import { notFound } from 'next/navigation'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/session'
import { getFormSchemas } from '@/app/actions/form-schema'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { checkCanReviewStep } from '@/app/actions/approval-flow'
import { FundsAllocation, ApprovalRecord } from '@/lib/types'
import EditFundsForm, { type ApprovalStepDef } from './_components/EditFundsForm'

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
  let approvalSteps: ApprovalStepDef[] = []
  let approvalRecords: ApprovalRecord[] = []

  if (record.flow_template_id) {
    const [stepsRes, recordsRes] = await Promise.all([
      supabase
        .from('approval_flow_steps')
        .select('id, step_number, step_name, reviewer_type, role_type_id, org_unit_type, system_role_id, approval_group_id')
        .eq('template_id', record.flow_template_id)
        .order('step_number'),
      supabase
        .from('approval_records')
        .select('*')
        .eq('funds_allocation_id', Number(id))
        .order('step_number'),
    ])
    approvalSteps = (stepsRes.data ?? []) as ApprovalStepDef[]
    approvalRecords = (recordsRes.data ?? []) as ApprovalRecord[]

    if (session?.userId && record.status === 'pending' && record.current_step !== null) {
      const stepDef = (stepsRes.data ?? []).find(
        (s: Record<string, unknown>) => s.step_number === record.current_step
      )
      if (stepDef) {
        isCurrentReviewer = await checkCanReviewStep({
          userId: session.userId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          stepDef: stepDef as any,
          applyDivisionId: record.apply_division_id,
          applySectionId: record.apply_section_id,
        })
      }
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
      approvalSteps={approvalSteps}
      approvalRecords={approvalRecords}
    />
  )
}
