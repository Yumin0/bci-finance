import { notFound } from 'next/navigation'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/session'
import { getFormSchemas } from '@/app/actions/form-schema'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { FundsAllocation } from '@/lib/types'
import EditFundsForm from './_components/EditFundsForm'

export default async function EditFundsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ data }, session, schemas, labelConfig] = await Promise.all([
    supabase.from('funds_allocation').select('*').eq('id', Number(id)).single(),
    getSession(),
    getFormSchemas(),
    getStatusLabelConfig(),
  ])

  if (!data) notFound()

  return (
    <EditFundsForm
      record={data as FundsAllocation}
      schema={schemas.funds_allocation}
      applicantName={session?.name ?? ''}
      userId={session?.userId ?? null}
      labelConfig={labelConfig}
    />
  )
}
