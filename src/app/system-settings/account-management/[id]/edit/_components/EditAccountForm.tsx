'use client'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { updateAccount } from '@/app/actions/account'
import type { SystemRole } from '@/lib/types'

type User = { id: number; email: string; name: string; system_role_id: number | null }

export default function EditAccountForm({ user, systemRoles }: { user: User; systemRoles: SystemRole[] }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updateAccount.bind(null, user.id), undefined)

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>編輯帳號</h1>

      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>姓名</label>
          <input name="name" defaultValue={user.name} required style={inputStyle} />
          {state?.errors?.name && <p style={errorStyle}>{state.errors.name[0]}</p>}
        </div>
        <div>
          <label style={labelStyle}>帳號（Email）</label>
          <input name="email" type="email" defaultValue={user.email} required style={inputStyle} />
          {state?.errors?.email && <p style={errorStyle}>{state.errors.email[0]}</p>}
        </div>
        <div>
          <label style={labelStyle}>新密碼（留空則不更改）</label>
          <input name="password" type="password" placeholder="留空則不更改" style={inputStyle} />
          {state?.errors?.password && <p style={errorStyle}>{state.errors.password[0]}</p>}
        </div>
        <div>
          <label style={labelStyle}>系統角色（直接指派）</label>
          <select name="system_role_id" defaultValue={user.system_role_id ?? ''} style={inputStyle}>
            <option value="">依組織職位決定</option>
            {systemRoles.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}{r.is_admin ? '（系統管理員）' : ''}
              </option>
            ))}
          </select>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>留空則依此人在組織架構中的職位自動判斷權限</p>
        </div>

        {state?.message && <p style={errorStyle}>{state.message}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={pending} style={btnStyle}>
            {pending ? '儲存中...' : '儲存'}
          </button>
          <button type="button" onClick={() => router.back()} style={cancelStyle}>
            取消
          </button>
        </div>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }
const btnStyle: React.CSSProperties = { padding: '8px 20px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const cancelStyle: React.CSSProperties = { padding: '8px 20px', background: 'none', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, cursor: 'pointer' }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginTop: 4 }
