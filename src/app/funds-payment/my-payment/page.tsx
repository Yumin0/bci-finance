import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { FundsPayment } from '@/lib/types'

export default async function MyPaymentPage() {
  const session = await getSession()
  const { data, error } = await supabase
    .from('funds_payment')
    .select(`*, approval_flow_templates(name, approval_flow_steps(step_name, step_number))`)
    .eq('created_by', String(session?.userId ?? ''))
    .order('created_at', { ascending: false })

  type RecordWithTemplate = FundsPayment & {
    approval_flow_templates: {
      name: string
      approval_flow_steps: Array<{ step_name: string; step_number: number }>
    } | null
  }
  const records = (data as RecordWithTemplate[]) ?? []

  function statusLabel(r: RecordWithTemplate) {
    if (r.status === 'approved') return '已核准'
    if (r.status === 'rejected') return '已拒絕'
    if (r.status === 'draft') return '草稿'
    const step = r.approval_flow_templates?.approval_flow_steps?.find(s => s.step_number === r.current_step)
    return step ? `審核中・${step.step_name}` : '審核中'
  }

  function statusColor(status: string) {
    if (status === 'approved') return '#16a34a'
    if (status === 'rejected') return '#dc2626'
    if (status === 'draft') return '#9ca3af'
    return 'var(--accent)'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>我的付款憑單</h1>
      </div>

      {error && <p style={{ color: '#dc2626' }}>載入失敗：{error.message}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
              {['狀態', '費用項目', '項目', '付款方式', '金額', ''].map((col, i) => (
                <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-body)', whiteSpace: 'nowrap' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-subtle)' }}>
                  尚無付款憑單
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={td}>
                  <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: `${statusColor(r.status)}1a`, color: statusColor(r.status), fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {statusLabel(r)}
                  </span>
                </td>
                <td style={td}>{r.expense_item ?? '-'}</td>
                <td style={td}>{r.name}</td>
                <td style={td}>{r.payment_method ?? '-'}</td>
                <td style={td}>{r.amount}</td>
                <td style={td}>
                  <Link href={`/funds-payment/my-payment/${r.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>檢視</Link>
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
