import { notFound } from 'next/navigation'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import EditAccountForm from './_components/EditAccountForm'
import type { SystemRole } from '@/lib/types'

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: user }, { data: systemRoles }] = await Promise.all([
    supabase.from('app_users').select('id, email, name, system_role_id').eq('id', id).single(),
    supabase.from('system_roles').select('id, name, is_admin').order('sort_order'),
  ])

  if (!user) notFound()

  return <EditAccountForm user={user} systemRoles={(systemRoles as SystemRole[]) ?? []} />
}
