'use client'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createAccount } from '@/app/actions/account'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/app/_components/PageHeader'

export default function NewAccountPage() {
  const router = useRouter()
  const [state, action, pending] = useActionState(createAccount, undefined)

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <PageHeader title="新增帳號" />

      <Card>
        <CardHeader>
          <CardTitle>帳號資訊</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">姓名</label>
              <Input name="name" required />
              {state?.errors?.name && (
                <p className="mt-1 text-xs text-destructive">{state.errors.name[0]}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">帳號（Email）</label>
              <Input name="email" type="email" required />
              {state?.errors?.email && (
                <p className="mt-1 text-xs text-destructive">{state.errors.email[0]}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">密碼</label>
              <Input name="password" type="password" placeholder="至少 6 個字元" required />
              {state?.errors?.password && (
                <p className="mt-1 text-xs text-destructive">{state.errors.password[0]}</p>
              )}
            </div>

            {state?.message && (
              <p className="text-sm text-destructive">{state.message}</p>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={pending}>
                {pending ? '建立中...' : '建立帳號'}
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
