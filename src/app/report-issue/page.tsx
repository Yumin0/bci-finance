import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { DevTracker, AppUser } from '@/lib/types'
import IssueListView from './IssueListView'

export default async function ReportIssuePage() {
  const [issueResult, userResult, session] = await Promise.all([
    supabase.from('dev_tracker').select('*').order('created_at', { ascending: false }),
    supabase.from('app_users').select('id, name'),
    getSession(),
  ])

  const issues = (issueResult.data as DevTracker[]) ?? []
  const users = (userResult.data as Pick<AppUser, 'id' | 'name'>[]) ?? []

  return (
    <IssueListView
      issues={issues}
      users={users}
      currentUserId={session?.userId ?? null}
    />
  )
}
