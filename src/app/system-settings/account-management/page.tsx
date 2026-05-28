import Link from 'next/link'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/dateUtils'
import { buttonVariants } from '@/components/ui/button'

type AppUser = {
  id: number
  email: string
  name: string
  created_at: string
  updated_at: string | null
}

export default async function AccountManagementPage() {
  const { data: users, error } = await supabase
    .from('app_users')
    .select('id, email, name, created_at, updated_at')
    .order('id')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>帳號管理</h1>
        <Link href="/system-settings/account-management/new" className={buttonVariants({ variant: 'default' })}>
          ＋ 新增帳號
        </Link>
      </div>

      {error && <p style={{ color: '#dc2626' }}>載入失敗：{error.message}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
              {['編號', '帳號', '姓名', '建立日期', '更新日期', ''].map((col, i) => (
                <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-body)', whiteSpace: 'nowrap' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(users as AppUser[] | null)?.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={td}>{user.id}</td>
                <td style={td}>{user.email}</td>
                <td style={td}>{user.name}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatDate(user.created_at)}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatDate(user.updated_at)}</td>
                <td style={td}>
                  <Link href={`/system-settings/account-management/${user.id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    編輯
                  </Link>
                </td>
              </tr>
            ))}
            {!users?.length && (
              <tr>
                <td colSpan={6} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-subtle)' }}>
                  尚無帳號資料
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 16px', color: 'var(--text-title)' }
