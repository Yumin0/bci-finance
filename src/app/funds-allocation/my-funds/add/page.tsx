import { getSession } from '@/lib/session'
import { getFormSchemas } from '@/app/actions/form-schema'
import AddFundsForm from './_components/AddFundsForm'

export default async function AddFundsPage() {
  const [session, schemas] = await Promise.all([getSession(), getFormSchemas()])
  return (
    <AddFundsForm
      applicantName={session?.name ?? ''}
      userId={session?.userId ?? null}
      schema={schemas.funds_allocation}
    />
  )
}
