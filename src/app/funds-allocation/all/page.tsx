import { supabase } from '@/lib/supabase'
import { FundsAllocation } from '@/lib/types'
import { formatDate } from '@/lib/dateUtils'
import Link from 'next/link'

export default async function AllFundsPage() {
  const { data, error } = await supabase
    .from('funds_allocation')
    .select(`
      *,
      approval_flow_templates(
        name,
        approval_flow_steps(step_name, step_number)
      )
    `)
    .order('created_at', { ascending: false })

  const records = (data ?? []) as (FundsAllocation & {
    approval_flow_templates: {
      name: string
      approval_flow_steps: Array<{ step_name: string; step_number: number }>
    } | null
  })[]

  function currentStepLabel(r: typeof records[0]) {
    if (r.status === 'approved') return '已核准'
    if (r.status === 'rejected') return '已拒絕'
    const step = r.approval_flow_templates?.approval_flow_steps?.find(
      s => s.step_number === r.current_step
    )
    return step?.step_name ?? `第 ${r.current_step} 步`
  }

  function statusColor(status: string) {
    if (status === 'approved') return '#16a34a'
    if (status === 'rejected') return '#dc2626'
    return 'var(--accent)'
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>全部申請紀錄</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>所有資金分配申請的完整狀態覽表</p>
      </div>

      {error && <p style={{ color: '#dc2626' }}>載入失敗：{error.message}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
              {['申請日期', '申請課別', '申請人', '項目名稱', '金額', '審核流程', '目前進度', ''].map((col, i) => (
                <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-subtle)' }}>
                  目前無申請紀錄
                </td>
              </tr>
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
                  <span style={{
                    fontSize: 12, padding: '2px 8px', borderRadius: 4,
                    background: `${statusColor(r.status)}1a`,
                    color: statusColor(r.status), fontWeight: 500,
                  }}>
                    {currentStepLabel(r)}
                  </span>
                </td>
                <td style={td}>
                  <Link
                    href={`/funds-allocation/my-funds/edit/${r.id}`}
                    style={{ fontSize: 13, color: 'var(--text-body)', border: '1px solid var(--btn-border)', borderRadius: 4, padding: '4px 12px', textDecoration: 'none' }}
                  >
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
