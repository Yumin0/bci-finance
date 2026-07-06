import { getSession } from '@/lib/session'
import { getFormSchemas } from '@/app/actions/form-schema'
import { getFundTemplateById } from '@/app/actions/fund-templates'
import { getApplicationCycleConfig } from '@/app/actions/application-cycle'
import { emailToEnglishName } from '@/lib/userNames'
import AddFundsForm from './_components/AddFundsForm'

export default async function AddFundsPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>
}) {
  const { templateId } = await searchParams
  const [session, schemas, template, cycleConfig] = await Promise.all([
    getSession(),
    getFormSchemas(),
    templateId ? getFundTemplateById(Number(templateId)) : Promise.resolve(null),
    getApplicationCycleConfig(),
  ])
  return (
    <AddFundsForm
      applicantName={session?.email ? emailToEnglishName(session.email) : (session?.name ?? '')}
      userId={session?.userId ?? null}
      schema={schemas.funds_allocation}
      initialValues={template?.field_values ?? undefined}
      cycleConfig={cycleConfig}
    />
  )
}
