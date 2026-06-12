import Link from 'next/link'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { formatDate } from '@/lib/dateUtils'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import PageHeader from '@/app/_components/PageHeader'

type AppUser = {
  id: number
  email: string
  name: string
  google_id: string | null
  created_at: string
  updated_at: string | null
}

export default async function AccountManagementPage() {
  const { data: users, error } = await supabase
    .from('app_users')
    .select('id, email, name, google_id, created_at, updated_at')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="帳號管理" />

      <Card>
        <CardHeader>
          <CardTitle>帳號列表</CardTitle>
          <CardAction>
            <Link
              href="/system-settings/account-management/new"
              className={buttonVariants({ variant: 'default' })}
            >
              ＋ 新增帳號
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-destructive">載入失敗：{error.message}</p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>編號</TableHead>
                <TableHead>帳號</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>登入方式</TableHead>
                <TableHead>建立日期</TableHead>
                <TableHead>更新日期</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users as AppUser[] | null)?.map((user, index) => (
                <TableRow key={user.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>
                    {user.google_id ? (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: '#e8f0fe', color: '#1a73e8', fontWeight: 500 }}>Google</span>
                    ) : (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-muted)', color: 'var(--text-muted)', fontWeight: 500 }}>Email</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(user.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(user.updated_at)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/system-settings/account-management/${user.id}/edit`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      編輯
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {!users?.length && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    尚無帳號資料
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
