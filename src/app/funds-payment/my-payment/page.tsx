import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { FundsPayment } from '@/lib/types'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import StatusBadge from '@/app/_components/StatusBadge'

export default async function MyPaymentPage() {
  const [session, labelConfig] = await Promise.all([
    getSession(),
    getStatusLabelConfig(),
  ])

  const { data, error } = await supabase
    .from('funds_payment')
    .select(`
      *,
      approval_flow_templates(name, approval_flow_steps(step_name, step_number)),
      approval_records!funds_payment_id(step_name, decision)
    `)
    .eq('created_by', String(session?.userId ?? ''))
    .order('created_at', { ascending: false })

  type RecordWithTemplate = FundsPayment & {
    approval_flow_templates: {
      name: string
      approval_flow_steps: Array<{ step_name: string; step_number: number }>
    } | null
    approval_records: Array<{ step_name: string; decision: string }>
  }
  const records = (data as RecordWithTemplate[]) ?? []

  function getStepName(r: RecordWithTemplate): string | null {
    if (r.status === 'pending') {
      return r.approval_flow_templates?.approval_flow_steps?.find(
        s => s.step_number === r.current_step
      )?.step_name ?? null
    }
    if (r.status === 'rejected') {
      return r.approval_records?.find(a => a.decision === 'rejected')?.step_name ?? null
    }
    if (r.status === 'approved') {
      const steps = r.approval_flow_templates?.approval_flow_steps ?? []
      return steps.reduce((max, s) => s.step_number > max.step_number ? s : max, steps[0])?.step_name ?? null
    }
    return null
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
                  <StatusBadge
                    module="payment_voucher"
                    status={r.status}
                    stepName={getStepName(r)}
                    labelConfig={labelConfig}
                  />
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
