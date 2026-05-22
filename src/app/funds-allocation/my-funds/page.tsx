import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { MOCK_USER_ID } from '@/lib/constants'
import { FundsAllocation } from '@/lib/types'

export default async function MyFundsPage() {
  const { data, error } = await supabase
    .from('funds_allocation')
    .select(`
      *,
      approval_flow_templates(
        name,
        approval_flow_steps(step_name, step_number)
      )
    `)
    .eq('created_by', MOCK_USER_ID)
    .order('created_at', { ascending: false })

  type RecordWithTemplate = FundsAllocation & {
    approval_flow_templates: {
      name: string
      approval_flow_steps: Array<{ step_name: string; step_number: number }>
    } | null
  }
  const records = (data as RecordWithTemplate[]) ?? []

  function statusLabel(r: RecordWithTemplate) {
    if (r.status === 'approved') return '已核准'
    if (r.status === 'rejected') return '已拒絕'
    const step = r.approval_flow_templates?.approval_flow_steps?.find(
      s => s.step_number === r.current_step
    )
    return step ? `審核中・${step.step_name}` : '審核中'
  }

  function statusColor(status: string) {
    if (status === 'approved') return '#16a34a'
    if (status === 'rejected') return '#dc2626'
    return 'var(--accent)'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>我的資金分配申請</h1>
        <Link
          href="/funds-allocation/my-funds/add"
          className={buttonVariants({ variant: 'default', size: 'sm' })}
        >
          ＋ 新增申請單
        </Link>
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
                  尚無申請紀錄
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
                <td style={td}>{r.apply_division ?? '-'}</td>
                <td style={td}>{r.apply_section ?? '-'}</td>
                <td style={td}>{r.applicant ?? '-'}</td>
                <td style={td}>{r.apply_role ?? '-'}</td>
                <td style={td}>{r.amount}</td>
                <td style={td}>{r.payment_account ?? '-'}</td>
                <td style={td}>{r.expense_item ?? '-'}</td>
                <td style={td}>{r.name}</td>
                <td style={td}>
                  <Link
                    href={`/funds-allocation/my-funds/edit/${r.id}`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    檢視 / 編輯
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
