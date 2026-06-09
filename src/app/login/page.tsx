'use client'
import { useActionState, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { login, register } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loginState, loginAction, loginPending] = useActionState(login, undefined)
  const [registerState, registerAction, registerPending] = useActionState(register, undefined)
  const searchParams = useSearchParams()
  const oauthError = searchParams.get('error')

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
                color: mode === m ? 'var(--text-heading)' : 'var(--text-muted)',
                borderBottom: mode === m ? '2px solid var(--text-heading)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {m === 'login' ? '登入' : '建立帳號'}
            </button>
          ))}
        </div>

        {/* Google 登入按鈕 */}
        <a
          href="/api/auth/google"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '10px 0', borderRadius: 6, marginBottom: 20,
            border: '1px solid var(--border-color)', background: 'var(--bg-card)',
            fontSize: 14, fontWeight: 500, color: 'var(--text-body)',
            textDecoration: 'none', cursor: 'pointer',
          }}
        >
          <GoogleIcon />
          使用 Google {mode === 'login' ? '登入' : '註冊'}
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>或</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
        </div>

        {oauthError && (
          <p style={{ ...errorStyle, marginBottom: 16 }}>Google 登入失敗，請稍後再試</p>
        )}

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
