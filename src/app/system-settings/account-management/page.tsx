import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import PageHeader from '@/app/_components/PageHeader'
import AccountTableView from './_components/AccountTableView'

export default async function AccountManagementPage() {
  const { data: users, error } = await supabase
    .from('app_users')
    .select('id, email, name, google_id, created_at, updated_at')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="帳號管理" />

      {error && (
        <p className="text-sm text-destructive">載入失敗：{error.message}</p>
      )}
      <AccountTableView users={users ?? []} />
    </div>
  )
}
