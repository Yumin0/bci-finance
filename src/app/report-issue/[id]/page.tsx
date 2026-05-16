import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { DevTracker, AppUser } from '@/lib/types'
import IssueDetailView from './IssueDetailView'

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const id = Number(idStr)
  if (isNaN(id)) notFound()

  const [issueResult, userResult, session] = await Promise.all([
    supabase.from('dev_tracker').select('*').eq('id', id).single(),
    supabase.from('app_users').select('id, name'),
    getSession(),
  ])

  if (!issueResult.data) notFound()

  const issue = issueResult.data as DevTracker
  const users = (userResult.data as Pick<AppUser, 'id' | 'name'>[]) ?? []

  return (
    <IssueDetailView
      issue={issue}
      users={users}
      currentUserId={session?.userId ?? null}
    />
  )
}
