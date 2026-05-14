import { getSession } from '@/lib/session'
import AddFundsForm from './_components/AddFundsForm'

export default async function AddFundsPage() {
  const session = await getSession()
  return <AddFundsForm applicantName={session?.name ?? ''} userId={session?.userId ?? null} />
}
