'use client'

import { useEffect, useState } from 'react'
import { getEditLogs, type EditLogEntry } from '@/app/actions/edit-logs'
import { formatDateTime } from '@/lib/dateUtils'

type Group = {
  changedByName: string
  changedAt: string
  stepNumber: number | null
  entries: EditLogEntry[]
}

function groupLogs(logs: EditLogEntry[]): Group[] {
  const groups: Group[] = []
  for (const log of logs) {
    const last = groups[groups.length - 1]
    if (last && last.changedByName === log.changed_by_name && last.changedAt === log.changed_at) {
      last.entries.push(log)
    } else {
      groups.push({
        changedByName: log.changed_by_name,
        changedAt: log.changed_at,
        stepNumber: log.step_number,
        entries: [log],
      })
    }
  }
  return groups
}

export default function ChangeLogModal({
  fundsAllocationId,
  fundsPaymentId,
  open,
  onClose,
}: {
  fundsAllocationId?: number
  fundsPaymentId?: number
  open: boolean
  onClose: () => void
}) {
  const [logs, setLogs] = useState<EditLogEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getEditLogs({ fundsAllocationId, fundsPaymentId }).then(data => {
      setLogs(data)
      setLoading(false)
    })
  }, [open, fundsAllocationId, fundsPaymentId])

  if (!open) return null

  const groups = groupLogs(logs)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-title)' }}>變更歷程</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '20px', flex: 1 }}>
          {loading && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>載入中...</p>}

          {!loading && groups.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>尚無變更紀錄</p>
          )}

          {!loading && groups.map((group, i) => (
            <div key={i} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: i < groups.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>{group.changedByName}</span>
                {group.stepNumber !== null && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-sidebar)', padding: '1px 6px', borderRadius: 4 }}>
                    第 {group.stepNumber} 步審核中
                  </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(group.changedAt)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.entries.map((entry, j) => (
                  <div key={j} style={{ fontSize: 13, color: 'var(--text-body)' }}>
                    <span style={{ fontWeight: 500 }}>{entry.field_label}</span>
                    {entry.old_value !== null && entry.new_value !== null && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        ：<span style={{ color: '#dc2626', textDecoration: 'line-through' }}>{entry.old_value || '（空）'}</span>
                        {' → '}
                        <span style={{ color: '#16a34a' }}>{entry.new_value || '（空）'}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
