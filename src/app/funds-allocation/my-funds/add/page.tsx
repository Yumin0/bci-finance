import { getSession } from '@/lib/session'
import { getFormSchemas } from '@/app/actions/form-schema'
import { getFundTemplateById } from '@/app/actions/fund-templates'
import { getApplicationCycleConfig } from '@/app/actions/application-cycle'
import { emailToEnglishName } from '@/lib/userNames'
import AddFundsForm from './_components/AddFundsForm'

export default async function AddFundsPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string; editTemplateId?: string }>
}) {
  const { templateId, editTemplateId } = await searchParams
  const loadId = editTemplateId ?? templateId
  const [session, schemas, template, cycleConfig] = await Promise.all([
    getSession(),
    getFormSchemas(),
    loadId ? getFundTemplateById(Number(loadId)) : Promise.resolve(null),
    getApplicationCycleConfig(),
  ])
  // 編輯範本模式：僅限個人範本擁有者，避免帶網址參數改到別人的範本
  const editTemplate =
    editTemplateId && template && !template.is_shared && String(template.created_by) === String(session?.userId)
      ? { id: template.id, name: template.name }
      : null
  return (
    <AddFundsForm
      applicantName={session?.email ? emailToEnglishName(session.email) : (session?.name ?? '')}
      userId={session?.userId ?? null}
      schema={schemas.funds_allocation}
      initialValues={editTemplate || !editTemplateId ? template?.field_values ?? undefined : undefined}
      cycleConfig={cycleConfig}
      editTemplate={editTemplate ?? undefined}
    />
  )
}
