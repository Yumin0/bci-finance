import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FundsPayment } from '@/lib/types'

export default async function FinancePaymentPage() {
  const { data, error } = await supabase
    .from('funds_payment')
    .select('*')
    .order('created_at', { ascending: false })

  const records = (data as FundsPayment[]) ?? []

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>付款憑單管理</h1>

      {error && <p style={{ color: '#dc2626' }}>載入失敗：{error.message}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
              {['狀態', '申請人', '出款帳戶', '費用項目', '項目', '付款方式', '金額', ''].map((col, i) => (
                <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-body)', whiteSpace: 'nowrap' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-subtle)' }}>
                  尚無付款憑單
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={td}>{r.status}</td>
                <td style={td}>{r.applicant ?? '-'}</td>
                <td style={td}>{r.payment_account ?? '-'}</td>
                <td style={td}>{r.expense_item ?? '-'}</td>
                <td style={td}>{r.name}</td>
                <td style={td}>{r.payment_method ?? '-'}</td>
                <td style={td}>{r.amount.toLocaleString()}</td>
                <td style={td}>
                  <Link
                    href={`/funds-payment/my-payment/${r.id}`}
                    style={{ fontSize: 13, color: 'var(--text-body)', border: '1px solid var(--btn-border)', borderRadius: 4, padding: '4px 12px', textDecoration: 'none', whiteSpace: 'nowrap' }}
                  >
                    檢視
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
