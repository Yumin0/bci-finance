'use client'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { updateAccount } from '@/app/actions/account'
import type { SystemRole } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/app/_components/PageHeader'

type User = { id: number; email: string; name: string; system_role_id: number | null }

export default function EditAccountForm({ user, systemRoles }: { user: User; systemRoles: SystemRole[] }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updateAccount.bind(null, user.id), undefined)

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <PageHeader title="編輯帳號" />

      <Card>
        <CardHeader>
          <CardTitle>帳號資訊</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">姓名</label>
              <Input name="name" defaultValue={user.name} required />
              {state?.errors?.name && (
                <p className="mt-1 text-xs text-destructive">{state.errors.name[0]}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">帳號（Email）</label>
              <Input name="email" type="email" defaultValue={user.email} required />
              {state?.errors?.email && (
                <p className="mt-1 text-xs text-destructive">{state.errors.email[0]}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">新密碼（留空則不更改）</label>
              <Input name="password" type="password" placeholder="留空則不更改" />
              {state?.errors?.password && (
                <p className="mt-1 text-xs text-destructive">{state.errors.password[0]}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">系統角色（直接指派）</label>
              <select
                name="system_role_id"
                defaultValue={user.system_role_id ?? ''}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/50 dark:bg-input/30"
              >
                <option value="">依組織職位決定</option>
                {systemRoles.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.is_admin ? '（系統管理員）' : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">留空則依此人在組織架構中的職位自動判斷權限</p>
            </div>

            {state?.message && (
              <p className="text-sm text-destructive">{state.message}</p>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={pending}>
                {pending ? '儲存中...' : '儲存'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                取消
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
