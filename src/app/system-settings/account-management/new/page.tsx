'use client'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createAccount } from '@/app/actions/account'

export default function NewAccountPage() {
  const router = useRouter()
  const [state, action, pending] = useActionState(createAccount, undefined)

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>新增帳號</h1>

      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>姓名</label>
          <input name="name" required style={inputStyle} />
          {state?.errors?.name && <p style={errorStyle}>{state.errors.name[0]}</p>}
        </div>
        <div>
          <label style={labelStyle}>帳號（Email）</label>
          <input name="email" type="email" required style={inputStyle} />
          {state?.errors?.email && <p style={errorStyle}>{state.errors.email[0]}</p>}
        </div>
        <div>
          <label style={labelStyle}>密碼</label>
          <input name="password" type="password" placeholder="至少 6 個字元" required style={inputStyle} />
          {state?.errors?.password && <p style={errorStyle}>{state.errors.password[0]}</p>}
        </div>

        {state?.message && <p style={errorStyle}>{state.message}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={pending} style={btnStyle}>
            {pending ? '建立中...' : '建立帳號'}
          </button>
          <button type="button" onClick={() => router.back()} style={cancelStyle}>
            取消
          </button>
        </div>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--btn-border)', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }
const btnStyle: React.CSSProperties = { padding: '8px 20px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const cancelStyle: React.CSSProperties = { padding: '8px 20px', background: 'none', color: 'var(--text-body)', border: '1px solid var(--btn-border)', borderRadius: 6, fontSize: 14, cursor: 'pointer' }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginTop: 4 }
