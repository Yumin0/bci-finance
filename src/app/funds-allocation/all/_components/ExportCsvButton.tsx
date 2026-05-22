'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getFundsAllocationForExport, type FundsAllocationExportRow } from '@/app/actions/export'
import { formatDate } from '@/lib/dateUtils'

function resolveStepLabel(row: FundsAllocationExportRow): string {
  if (row.status === 'approved') return '已核准'
  if (row.status === 'rejected') return '已拒絕'
  const step = row.approval_flow_templates?.approval_flow_steps?.find(
    s => s.step_number === row.current_step
  )
  return step?.step_name ?? '審核中'
}

// ── 欄位清單 ──────────────────────────────────────────────────────────────────
// 新增或移除欄位只需改這裡，匯出對話框與 CSV 都會自動跟著變。
const COLUMNS: { key: string; label: string; getValue: (r: FundsAllocationExportRow) => string | number }[] = [
  { key: 'created_at',    label: '申請日期', getValue: r => formatDate(r.created_at) },
  { key: 'apply_section', label: '申請課別', getValue: r => r.apply_section ?? '' },
  { key: 'applicant',     label: '申請人',   getValue: r => r.applicant ?? r.created_by },
  { key: 'name',          label: '項目名稱', getValue: r => r.name },
  { key: 'amount',        label: '金額',     getValue: r => r.amount },
  { key: 'flow',          label: '審核流程', getValue: r => r.approval_flow_templates?.name ?? '' },
  { key: 'progress',      label: '目前進度', getValue: r => resolveStepLabel(r) },
]

function downloadCsv(rows: FundsAllocationExportRow[], selectedKeys: Set<string>) {
  const activeCols = COLUMNS.filter(c => selectedKeys.has(c.key))
  const headers = activeCols.map(c => c.label)
  const body = rows.map(r => activeCols.map(c => c.getValue(r)))
  const csv = [headers, ...body]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `funds_allocation_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ExportCsvButton() {
  const [open, setOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [applicant, setApplicant] = useState('')
  const [status, setStatus] = useState('all')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set(COLUMNS.map(c => c.key)))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleOpen() {
    setOpen(true)
    setError(null)
  }

  function handleClose() {
    setOpen(false)
    setDateFrom('')
    setDateTo('')
    setApplicant('')
    setStatus('all')
    setSelectedKeys(new Set(COLUMNS.map(c => c.key)))
    setError(null)
  }

  function toggleKey(key: string) {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleAll() {
    if (selectedKeys.size === COLUMNS.length) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(COLUMNS.map(c => c.key)))
    }
  }

  async function handleExport() {
    if (selectedKeys.size === 0) { setError('請至少勾選一個欄位'); return }
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await getFundsAllocationForExport({ dateFrom, dateTo, applicant, status })
    setLoading(false)
    if (fetchError || !data) { setError(fetchError ?? '資料載入失敗'); return }
    if (data.length === 0) { setError('沒有符合條件的資料'); return }
    downloadCsv(data, selectedKeys)
    handleClose()
  }

  const allChecked = selectedKeys.size === COLUMNS.length
  const someChecked = selectedKeys.size > 0 && !allChecked

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        匯出 CSV
      </Button>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 28, width: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text-title)' }}>匯出 CSV</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 篩選條件 */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>申請日期（起）</label>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>申請日期（迄）</label>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>申請人</label>
                <Input
                  placeholder="輸入申請人姓名（留空則不篩選）"
                  value={applicant}
                  onChange={e => setApplicant(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle}>狀態</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  style={{ width: '100%', height: 32, padding: '0 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-body)', fontSize: 13 }}
                >
                  <option value="all">全部</option>
                  <option value="pending">審核中</option>
                  <option value="approved">已核准</option>
                  <option value="rejected">已拒絕</option>
                </select>
              </div>

              {/* 欄位選擇 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={labelStyle}>匯出欄位</label>
                  <button
                    onClick={toggleAll}
                    style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {allChecked ? '全部取消' : '全選'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', padding: '10px 12px', background: 'var(--bg-sidebar)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  {COLUMNS.map(col => {
                    const checked = selectedKeys.has(col.key)
                    return (
                      <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-body)', cursor: 'pointer', userSelect: 'none' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleKey(col.key)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                        <span style={{
                          flexShrink: 0, width: 15, height: 15, borderRadius: 3,
                          border: '1.5px solid #333',
                          background: checked ? '#333' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {checked && (
                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                              <path d="M1.5 4.5L3.5 6.5L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        {col.label}
                      </label>
                    )
                  })}
                </div>
                {someChecked && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>已選 {selectedKeys.size} / {COLUMNS.length} 個欄位</p>
                )}
              </div>

              {error && <p style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
              <Button variant="outline" size="sm" onClick={handleClose} disabled={loading}>
                取消
              </Button>
              <Button size="sm" onClick={handleExport} disabled={loading}>
                {loading ? '載入中…' : '確認匯出'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-muted)',
  marginBottom: 4,
}
