'use client'

import Link from 'next/link'
import { useState } from 'react'
import { FundsAllocation, FundsPayment } from '@/lib/types'
import { buttonVariants } from '@/components/ui/button'

type Tab = 'funds' | 'payment'

export default function HomeTabView({
  fundsRecords,
  paymentRecords,
}: {
  fundsRecords: FundsAllocation[]
  paymentRecords: FundsPayment[]
}) {
  const [tab, setTab] = useState<Tab>('funds')

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>我的申請紀錄</h1>

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 24 }}>
        <button
          onClick={() => setTab('funds')}
          style={{
            padding: '8px 20px',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: tab === 'funds' ? '2px solid #111827' : '2px solid transparent',
            color: tab === 'funds' ? '#111827' : '#6b7280',
            marginBottom: -2,
          }}
        >
          資金分配申請單
        </button>
        <button
          onClick={() => setTab('payment')}
          style={{
            padding: '8px 20px',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: tab === 'payment' ? '2px solid #111827' : '2px solid transparent',
            color: tab === 'payment' ? '#111827' : '#6b7280',
            marginBottom: -2,
          }}
        >
          付款憑單申請單
        </button>
      </div>

      {tab === 'funds' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
                {['狀態', '申請處別', '申請課別', '申請人', '職稱', '金額', '出款帳戶', '費用項目', '項目', ''].map((col, i) => (
                  <th key={i} style={th}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fundsRecords.length === 0 && (
                <tr>
                  <td colSpan={10} style={empty}>尚無申請紀錄</td>
                </tr>
              )}
              {fundsRecords.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={td}>{r.status}</td>
                  <td style={td}>{r.apply_division ?? '-'}</td>
                  <td style={td}>{r.apply_section ?? '-'}</td>
                  <td style={td}>{r.applicant ?? '-'}</td>
                  <td style={td}>{r.apply_role ?? '-'}</td>
                  <td style={td}>{r.amount}</td>
                  <td style={td}>{r.payment_account ?? '-'}</td>
                  <td style={td}>{r.expense_item ?? '-'}</td>
                  <td style={td}>{r.name}</td>
                  <td style={td}>
                    <Link href={`/funds-allocation/my-funds/edit/${r.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                      檢視 / 編輯
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'payment' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
                {['狀態', '費用項目', '項目', '付款方式', '金額', ''].map((col, i) => (
                  <th key={i} style={th}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paymentRecords.length === 0 && (
                <tr>
                  <td colSpan={6} style={empty}>尚無付款憑單</td>
                </tr>
              )}
              {paymentRecords.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={td}>{r.status}</td>
                  <td style={td}>{r.expense_item ?? '-'}</td>
                  <td style={td}>{r.name}</td>
                  <td style={td}>{r.payment_method ?? '-'}</td>
                  <td style={td}>{r.amount}</td>
                  <td style={td}>
                    <Link href={`/funds-payment/my-payment/${r.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                      檢視
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontWeight: 600,
  color: 'var(--text-body)',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = { padding: '10px 16px', color: 'var(--text-title)' }

const empty: React.CSSProperties = {
  padding: '24px 16px',
  textAlign: 'center',
  color: 'var(--text-subtle)',
}

