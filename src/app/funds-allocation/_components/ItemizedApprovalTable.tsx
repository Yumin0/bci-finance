'use client'

import { useState } from 'react'
import { AllocationGroupInfo } from '@/lib/approvedItems'

// 逐項核准明細表格（資金分配審核頁「審核進度」進行中關卡下方）：
// 每列＝申請單付款明細一組，審核人只改「核准費用」，稅額自動重算、手續費原值計入，
// 小計＝核准費用＋手續費＋稅額，總核准金額由呼叫端加總顯示於核准金額欄（不可手改）。
// readOnly＝已完成關卡的逐項明細檢視（值來自該關 approval_records.approved_items）。

type Props = {
  info: AllocationGroupInfo
  bases: string[]        // 各組核准費用（editable 為輸入值字串；readOnly 為已存值）
  taxes: number[]        // 各組稅額（editable 為即時重算值；readOnly 為已存值）
  onBaseChange?: (idx: number, value: string) => void
  readOnly?: boolean
}

const cellStyle: React.CSSProperties = { padding: '8px 12px 8px 0', borderBottom: '1px solid var(--border-color)', color: 'var(--text-body)' }
const numCellStyle: React.CSSProperties = { ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap' }
const headStyle: React.CSSProperties = { textAlign: 'left', padding: '6px 12px 6px 0', fontWeight: 500, color: 'var(--text-body)', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }
const numHeadStyle: React.CSSProperties = { ...headStyle, textAlign: 'right' }

export default function ItemizedApprovalTable({ info, bases, taxes, onBaseChange, readOnly = false }: Props) {
  const hasOtherFees = info.otherFeeLabels.length > 0
  const otherFeesHeader = info.otherFeeLabels.join('＋')
  const num = (v: string | undefined) => {
    const n = parseFloat(v ?? '')
    return Number.isFinite(n) ? n : 0
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {info.detailLabel && <th style={headStyle}>{info.detailLabel}</th>}
            {info.summaryLabel && <th style={headStyle}>{info.summaryLabel}</th>}
            <th style={numHeadStyle}>申請{info.baseLabel}</th>
            <th style={numHeadStyle}>核准{info.baseLabel}</th>
            {hasOtherFees && <th style={numHeadStyle}>{otherFeesHeader}</th>}
            <th style={numHeadStyle}>稅額</th>
            <th style={numHeadStyle}>小計</th>
          </tr>
        </thead>
        <tbody>
          {info.items.map((it, i) => {
            const base = num(bases[i])
            const tax = taxes[i] ?? 0
            const subtotal = base + it.otherFees + tax
            return (
              <tr key={i}>
                {info.detailLabel && <td style={cellStyle}>{it.detail || '—'}</td>}
                {info.summaryLabel && <td style={cellStyle}>{it.summary || '—'}</td>}
                <td style={numCellStyle}>{it.base.toLocaleString()}</td>
                <td style={{ ...numCellStyle, width: 120 }}>
                  {readOnly ? (
                    base.toLocaleString()
                  ) : (
                    <input
                      type="number"
                      value={bases[i] ?? ''}
                      min={0}
                      onChange={e => onBaseChange?.(i, e.target.value)}
                      onWheel={e => e.currentTarget.blur()}
                      style={{
                        width: 110, padding: '6px 8px', borderRadius: 6, textAlign: 'right',
                        border: '1px solid var(--btn-border)', fontSize: 13,
                        background: 'var(--bg-card)', color: 'var(--text-body)', boxSizing: 'border-box',
                      }}
                    />
                  )}
                </td>
                {hasOtherFees && <td style={numCellStyle}>{it.otherFees.toLocaleString()}</td>}
                <td style={numCellStyle}>{tax.toLocaleString()}</td>
                <td style={{ ...numCellStyle, fontWeight: 600 }}>{subtotal.toLocaleString()}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// 已完成關卡的逐項明細：預設收合、點開展開（組數多時保持一列式版面清爽）
export function PastItemizedDetail({ info, bases, taxes }: { info: AllocationGroupInfo; bases: string[]; taxes: number[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}
      >
        {open ? '▾ 收合逐項核准明細' : '▸ 逐項核准明細'}
      </button>
      {open && <ItemizedApprovalTable info={info} bases={bases} taxes={taxes} readOnly />}
    </div>
  )
}
