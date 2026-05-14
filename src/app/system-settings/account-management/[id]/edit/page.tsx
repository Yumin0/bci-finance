import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import EditAccountForm from './_components/EditAccountForm'

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: user } = await supabase
    .from('app_users')
    .select('id, email, name')
    .eq('id', id)
    .single()

  if (!user) notFound()

  return <EditAccountForm user={user} />
}
