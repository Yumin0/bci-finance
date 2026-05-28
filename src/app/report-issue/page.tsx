import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/session'
import { DevTracker, AppUser } from '@/lib/types'
import IssueListView from './IssueListView'

export default async function ReportIssuePage() {
  const [issueResult, userResult, moduleResult, session] = await Promise.all([
    supabase.from('dev_tracker').select('*').order('created_at', { ascending: false }),
    supabase.from('app_users').select('id, name'),
    supabase.from('issue_module_options').select('label').order('sort_order'),
    getSession(),
  ])

  const issues = (issueResult.data as DevTracker[]) ?? []
  const users = (userResult.data as Pick<AppUser, 'id' | 'name'>[]) ?? []
  const moduleOptions = (moduleResult.data ?? []).map((r: { label: string }) => r.label)

  return (
    <IssueListView
      issues={issues}
      users={users}
      currentUserId={session?.userId ?? null}
      moduleOptions={moduleOptions}
    />
  )
}
