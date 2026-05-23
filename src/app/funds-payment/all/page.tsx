import { supabase } from '@/lib/supabase'
import { FundsPayment } from '@/lib/types'
import { formatDate } from '@/lib/dateUtils'
import Link from 'next/link'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import StatusBadge from '@/app/_components/StatusBadge'

export default async function AllPaymentPage() {
  const [{ data, error }, labelConfig] = await Promise.all([
    supabase
      .from('funds_payment')
      .select(`
        *,
        approval_flow_templates(name, approval_flow_steps(step_name, step_number)),
        approval_records!funds_payment_id(step_name, decision)
      `)
      .order('created_at', { ascending: false }),
    getStatusLabelConfig(),
  ])

  const records = (data ?? []) as (FundsPayment & {
    approval_flow_templates: {
      name: string
      approval_flow_steps: Array<{ step_name: string; step_number: number }>
    } | null
    approval_records: Array<{ step_name: string; decision: string }>
  })[]

  function getStepName(r: typeof records[0]): string | null {
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
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>全部付款紀錄</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>所有付款憑單的完整狀態覽表</p>
      </div>

      {error && <p style={{ color: '#dc2626' }}>載入失敗：{error.message}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
              {['申請日期', '申請課別', '申請人', '憑單名稱', '金額', '審核流程', '目前進度', ''].map((col, i) => (
                <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-subtle)' }}>目前無付款紀錄</td></tr>
            )}
            {records.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={td}>{formatDate(r.created_at)}</td>
                <td style={td}>{r.apply_section ?? '-'}</td>
                <td style={td}>{r.applicant ?? r.created_by}</td>
                <td style={td}>{r.name}</td>
                <td style={td}>{r.amount.toLocaleString()}</td>
                <td style={td}>{r.approval_flow_templates?.name ?? '-'}</td>
                <td style={td}>
                  <StatusBadge
                    module="payment_voucher"
                    status={r.status}
                    stepName={getStepName(r)}
                    labelConfig={labelConfig}
                  />
                </td>
                <td style={td}>
                  <Link href={`/funds-payment/my-payment/${r.id}`}
                    style={{ fontSize: 13, color: 'var(--text-body)', border: '1px solid var(--btn-border)', borderRadius: 4, padding: '4px 12px', textDecoration: 'none' }}>
                    查閱
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
