import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { FUNDS_STATUS } from '@/lib/constants'
import { FundsAllocation } from '@/lib/types'

export default async function Step5ListPage() {
  const { data, error } = await supabase
    .from('funds_allocation')
    .select('*')
    .eq('status', FUNDS_STATUS.PENDING_STEP5)
    .order('created_at', { ascending: true })

  const records = (data as FundsAllocation[]) ?? []

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>財務長單據管理列表</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>待審核的資金分配申請單（狀態：{FUNDS_STATUS.PENDING_STEP5}）</p>
      </div>

      {error && <p style={{ color: '#dc2626' }}>載入失敗：{error.message}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
              {['狀態', '申請處別', '申請課別', '申請人', '職稱', '金額', '出款帳戶', '費用項目', '項目', ''].map((col, i) => (
                <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-body)', whiteSpace: 'nowrap' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-subtle)' }}>
                  目前無待審單據
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={td}>{r.status}</td>
                <td style={td}>{r.apply_division ?? '-'}</td>
                <td style={td}>{r.apply_section ?? '-'}</td>
                <td style={td}>{r.applicant ?? r.created_by}</td>
                <td style={td}>{r.apply_role ?? '-'}</td>
                <td style={td}>{r.amount}</td>
                <td style={td}>{r.payment_account ?? '-'}</td>
                <td style={td}>{r.expense_item ?? '-'}</td>
                <td style={td}>{r.name}</td>
                <td style={td}>
                  <Link
                    href={`/funds-allocation/step5/check/${r.id}`}
                    style={{ fontSize: 13, color: 'var(--text-body)', border: '1px solid var(--btn-border)', borderRadius: 4, padding: '4px 12px', textDecoration: 'none', whiteSpace: 'nowrap' }}
                  >
                    檢視 / 審核
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 16px', color: 'var(--text-title)' }
