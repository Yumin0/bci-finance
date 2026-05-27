'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FundsAllocation } from '@/lib/types'
import { StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import ExportCsvButton from './ExportCsvButton'
import { Input } from '@/components/ui/input'

type AllocationRow = FundsAllocation & {
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

const SEARCH_FIELDS: Array<(r: AllocationRow) => string | null | undefined> = [
  (r) => r.serial_number,
  (r) => r.apply_division,
  (r) => r.apply_section,
  (r) => r.applicant,
  (r) => r.expense_item,
  (r) => r.name,
]

function getStepName(r: AllocationRow): string | null {
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

export default function AllFundsTableView({
  records,
  labelConfig,
  canExport,
}: {
  records: AllocationRow[]
  labelConfig: StatusLabelConfig
  canExport: boolean
}) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? records.filter(r =>
        SEARCH_FIELDS.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase()))
      )
    : records

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>全部申請紀錄</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>所有資金分配申請的完整狀態覽表</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Input
            placeholder="搜尋單號、申請處別、申請課別、申請人、費用項目、項目名稱…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ width: 260, fontSize: 13 }}
          />
          {canExport && <ExportCsvButton labelConfig={labelConfig} />}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
              {['狀態', '單號', '申請處別', '申請課別', '申請人', '職稱', '金額', '出款帳戶', '費用項目', '項目', ''].map((col, i) => (
                <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-subtle)' }}>
                  {query ? '找不到符合的紀錄' : '目前無申請紀錄'}
                </td>
              </tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={td}>
                  <StatusBadge
                    module="funds_allocation"
                    status={r.status}
                    stepName={getStepName(r)}
                    labelConfig={labelConfig}
                  />
                </td>
                <td style={td}>
                  <Link
                    href={`/funds-allocation/my-funds/edit/${r.id}`}
                    style={{ color: '#2563eb', textDecoration: 'underline', fontSize: 13 }}
                  >
                    {r.status === 'draft' ? '繼續編輯' : (r.serial_number ?? '-')}
                  </Link>
                </td>
                <td style={td}>{r.apply_division ?? '-'}</td>
                <td style={td}>{r.apply_section ?? '-'}</td>
                <td style={td}>{r.applicant ?? r.created_by}</td>
                <td style={td}>{r.apply_role ?? '-'}</td>
                <td style={td}>{r.amount.toLocaleString()}</td>
                <td style={td}>{r.payment_account ?? '-'}</td>
                <td style={td}>{r.expense_item ?? '-'}</td>
                <td style={td}>{r.name}</td>
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
