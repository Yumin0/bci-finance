'use client'

import { useState } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/dateUtils'
import { StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'

type TempVoucherRow = {
  id: number
  funds_payment_id: number
  date: string | null
  amount: number | null
  applicant: string | null
  status: string
  current_step: number | null
  flow_template_id: number | null
  created_at: string
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

// 搜尋欄位設定：要新增或移除搜尋欄位只改這裡
const SEARCH_FIELDS: Array<(r: TempVoucherRow) => string | null | undefined> = [
  (r) => r.applicant,
  (r) => String(r.funds_payment_id),
]

function getStepName(r: TempVoucherRow): string | null {
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

export default function MyVoucherTableView({
  records,
  labelConfig,
}: {
  records: TempVoucherRow[]
  labelConfig: StatusLabelConfig
}) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? records.filter(r => SEARCH_FIELDS.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
    : records

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>我的暫付款沖銷憑單</h1>
        <Input
          placeholder="搜尋申請人或關聯付款憑單編號…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ width: 260, fontSize: 13 }}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
              {['狀態', '申請日期', '暫付金額', '關聯付款憑單', ''].map((col, i) => (
                <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-body)', whiteSpace: 'nowrap' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-subtle)' }}>
                  {query ? '找不到符合的紀錄' : '尚無暫付款沖銷憑單'}
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={td}>
                  <StatusBadge
                    module="temp_voucher"
                    status={r.status}
                    stepName={getStepName(r)}
                    labelConfig={labelConfig}
                  />
                </td>
                <td style={td}>{r.date ? formatDate(r.date) : '-'}</td>
                <td style={td}>{r.amount != null ? r.amount.toLocaleString() : '-'}</td>
                <td style={td}>
                  <Link href={`/funds-payment/my-payment/${r.funds_payment_id}`} style={{ color: '#2563eb', fontSize: 13 }}>
                    #{r.funds_payment_id}
                  </Link>
                </td>
                <td style={td}>
                  <Link href={`/funds-voucher/my-voucher/${r.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>檢視</Link>
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
