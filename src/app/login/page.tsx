'use client'
import { useActionState, useState } from 'react'
import { login, register } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loginState, loginAction, loginPending] = useActionState(login, undefined)
  const [registerState, registerAction, registerPending] = useActionState(register, undefined)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-sidebar)' }}>
      <div style={{ width: 400, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, textAlign: 'center' }}>BCI 財務系統</h1>

        <div style={{ display: 'flex', marginBottom: 24, borderBottom: '1px solid var(--border-color)' }}>
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '10px 0', fontSize: 14, border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: mode === m ? 600 : 400,
                color: mode === m ? '#111827' : '#6b7280',
                borderBottom: mode === m ? '2px solid #111827' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {m === 'login' ? '登入' : '建立帳號'}
            </button>
          ))}
        </div>

        {mode === 'login' ? (
          <form action={loginAction}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email</label>
              <Input name="email" type="email" placeholder="your@email.com" required />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>密碼</label>
              <Input name="password" type="password" placeholder="請輸入密碼" required />
            </div>
            {loginState?.error && <p style={errorStyle}>{loginState.error}</p>}
            <Button type="submit" disabled={loginPending} className="w-full mt-2">
              {loginPending ? '登入中...' : '登入'}
            </Button>
          </form>
        ) : (
          <form action={registerAction}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>姓名</label>
              <Input name="name" type="text" placeholder="請輸入姓名" required />
              {registerState?.errors?.name && <p style={errorStyle}>{registerState.errors.name[0]}</p>}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email</label>
              <Input name="email" type="email" placeholder="your@email.com" required />
              {registerState?.errors?.email && <p style={errorStyle}>{registerState.errors.email[0]}</p>}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>密碼</label>
              <Input name="password" type="password" placeholder="至少 6 個字元" required />
              {registerState?.errors?.password && <p style={errorStyle}>{registerState.errors.password[0]}</p>}
            </div>
            {registerState?.message && <p style={errorStyle}>{registerState.message}</p>}
            <Button type="submit" disabled={registerPending} className="w-full mt-2">
              {registerPending ? '建立中...' : '建立帳號'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginTop: 4 }
