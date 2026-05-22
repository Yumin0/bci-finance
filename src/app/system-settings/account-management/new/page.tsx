'use client'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createAccount } from '@/app/actions/account'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function NewAccountPage() {
  const router = useRouter()
  const [state, action, pending] = useActionState(createAccount, undefined)

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>新增帳號</h1>

      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>姓名</label>
          <Input name="name" required />
          {state?.errors?.name && <p style={errorStyle}>{state.errors.name[0]}</p>}
        </div>
        <div>
          <label style={labelStyle}>帳號（Email）</label>
          <Input name="email" type="email" required />
          {state?.errors?.email && <p style={errorStyle}>{state.errors.email[0]}</p>}
        </div>
        <div>
          <label style={labelStyle}>密碼</label>
          <Input name="password" type="password" placeholder="至少 6 個字元" required />
          {state?.errors?.password && <p style={errorStyle}>{state.errors.password[0]}</p>}
        </div>

        {state?.message && <p style={errorStyle}>{state.message}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={pending}>
            {pending ? '建立中...' : '建立帳號'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            取消
          </Button>
        </div>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginTop: 4 }
