import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { PAYMENT_STATUS } from '@/lib/constants'
import { FundsPayment } from '@/lib/types'

export default async function PaymentStep2Page() {
  const { data, error } = await supabase
    .from('funds_payment')
    .select('*')
    .eq('status', PAYMENT_STATUS.PENDING_STEP2)
    .order('created_at', { ascending: true })

  const records = (data as FundsPayment[]) ?? []

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>處級單據管理</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>待審核的付款憑單（狀態：{PAYMENT_STATUS.PENDING_STEP2}）</p>
      </div>

      {error && <p style={{ color: '#dc2626' }}>載入失敗：{error.message}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['狀態', '費用項目', '項目', '付款方式', '金額', ''].map((col, i) => (
                <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af' }}>
                  目前無待審單據
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={td}>{r.status}</td>
                <td style={td}>{r.expense_item ?? '-'}</td>
                <td style={td}>{r.name}</td>
                <td style={td}>{r.payment_method ?? '-'}</td>
                <td style={td}>{r.amount}</td>
                <td style={td}>
                  <Link
                    href={`/funds-payment/step2/check/${r.id}`}
                    style={{ fontSize: 13, color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 12px', textDecoration: 'none', whiteSpace: 'nowrap' }}
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

const td: React.CSSProperties = { padding: '10px 16px', color: '#111827' }
