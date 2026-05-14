'use client'
import { useActionState, useState } from 'react'
import { login, register } from '@/app/actions/auth'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loginState, loginAction, loginPending] = useActionState(login, undefined)
  const [registerState, registerAction, registerPending] = useActionState(register, undefined)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div style={{ width: 400, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, textAlign: 'center' }}>BCI 財務系統</h1>

        <div style={{ display: 'flex', marginBottom: 24, borderBottom: '1px solid #e5e7eb' }}>
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
              <input name="email" type="email" placeholder="your@email.com" required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>密碼</label>
              <input name="password" type="password" placeholder="請輸入密碼" required style={inputStyle} />
            </div>
            {loginState?.error && <p style={errorStyle}>{loginState.error}</p>}
            <button type="submit" disabled={loginPending} style={btnStyle}>
              {loginPending ? '登入中...' : '登入'}
            </button>
          </form>
        ) : (
          <form action={registerAction}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>姓名</label>
              <input name="name" type="text" placeholder="請輸入姓名" required style={inputStyle} />
              {registerState?.errors?.name && <p style={errorStyle}>{registerState.errors.name[0]}</p>}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email</label>
              <input name="email" type="email" placeholder="your@email.com" required style={inputStyle} />
              {registerState?.errors?.email && <p style={errorStyle}>{registerState.errors.email[0]}</p>}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>密碼</label>
              <input name="password" type="password" placeholder="至少 6 個字元" required style={inputStyle} />
              {registerState?.errors?.password && <p style={errorStyle}>{registerState.errors.password[0]}</p>}
            </div>
            {registerState?.message && <p style={errorStyle}>{registerState.message}</p>}
            <button type="submit" disabled={registerPending} style={btnStyle}>
              {registerPending ? '建立中...' : '建立帳號'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }
const btnStyle: React.CSSProperties = { width: '100%', padding: '10px 0', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginTop: 4 }
