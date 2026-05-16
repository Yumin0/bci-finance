'use client'

import { useState, useActionState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { DevTracker, IssueStatus, AppUser } from '@/lib/types'
import { submitIssue, updateIssueStatus, assignIssue, IssueFormState } from '@/app/actions/dev-tracker'

const TYPE_LABEL: Record<string, string> = { feature: '新功能許願', bug: 'Bug回報', performance: '技術效能優化' }
const PRIORITY_LABEL: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '緊急' }
const STATUS_LABEL: Record<IssueStatus, string> = {
  pending: '待處理',
  in_progress: '進行中',
  completed: '已完成',
  rejected: '已拒絕',
  on_hold: '暫緩',
}

const TYPE_COLOR: Record<string, React.CSSProperties> = {
  feature: { background: '#dbeafe', color: '#2563eb' },
  bug: { background: '#fee2e2', color: '#dc2626' },
  performance: { background: '#d1fae5', color: '#065f46' },
}
const PRIORITY_COLOR: Record<string, React.CSSProperties> = {
  low: { background: '#f3f4f6', color: '#6b7280' },
  medium: { background: '#fef3c7', color: '#d97706' },
  high: { background: '#fed7aa', color: '#ea580c' },
  critical: { background: '#fee2e2', color: '#dc2626' },
}
const STATUS_COLOR: Record<IssueStatus, React.CSSProperties> = {
  pending: { background: '#f3f4f6', color: '#6b7280' },
  in_progress: { background: '#dbeafe', color: '#2563eb' },
  completed: { background: '#dcfce7', color: '#16a34a' },
  rejected: { background: '#fee2e2', color: '#dc2626' },
  on_hold: { background: '#fef3c7', color: '#d97706' },
}

const MODULE_OPTIONS = [
  '資金分配申請',
  '付款憑單',
  '單據審核',
  '系統設定',
  '權限管理',
  '側邊欄設定',
  '問題回報',
  '其他',
]

export default function IssueListView({
  issues,
  users,
  currentUserId,
}: {
  issues: DevTracker[]
  users: Pick<AppUser, 'id' | 'name'>[]
  currentUserId: number | null
}) {
  const [showForm, setShowForm] = useState(false)
  const [state, action, pending] = useActionState<IssueFormState, FormData>(submitIssue, undefined)
  const [, startStatusTransition] = useTransition()

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))

  useEffect(() => {
    if (state?.success) setShowForm(false)
  }, [state])

  function handleStatusChange(id: number, status: string) {
    startStatusTransition(async () => {
      await updateIssueStatus(id, status)
    })
  }

  function handleAssignChange(id: number, assignedTo: string) {
    startStatusTransition(async () => {
      await assignIssue(id, assignedTo ? Number(assignedTo) : null)
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>問題回報 / 開發追蹤</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            background: showForm ? '#f3f4f6' : '#2563eb',
            color: showForm ? '#374151' : '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 20px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {showForm ? '取消' : '＋ 新增回報'}
        </button>
      </div>

      {showForm && (
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 24,
          marginBottom: 28,
          background: '#f9fafb',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 0, marginBottom: 20 }}>新增回報</h2>
          <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>類型 *</label>
                <select name="type" required style={inputStyle}>
                  <option value="">請選擇</option>
                  <option value="feature">新功能許願</option>
                  <option value="bug">Bug回報</option>
                  <option value="performance">技術效能優化</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>優先級</label>
                <select name="priority" defaultValue="medium" style={inputStyle}>
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="critical">緊急</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>影響模組</label>
                <select name="module" style={inputStyle}>
                  <option value="">請選擇（選填）</option>
                  {MODULE_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>標題 *</label>
              <input
                name="title"
                type="text"
                placeholder="請簡述問題或需求"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>詳細描述</label>
              <textarea
                name="description"
                rows={4}
                placeholder="請描述問題的發生情況、操作步驟、預期結果，或是新功能的使用情境"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            {state?.error && (
              <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{state.error}</p>
            )}
            {state?.success && (
              <p style={{ color: '#16a34a', fontSize: 13, margin: 0 }}>已成功提交！</p>
            )}
            <div>
              <button
                type="submit"
                disabled={pending}
                style={{
                  background: pending ? '#93c5fd' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '9px 24px',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: pending ? 'not-allowed' : 'pointer',
                }}
              >
                {pending ? '提交中...' : '送出回報'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['類型', '標題', '優先級', '狀態', '模組', '建立者', '建立日期', '承接開發者', '完成日期', ''].map((col) => (
                <th key={col} style={th}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {issues.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af' }}>
                  尚無任何回報紀錄
                </td>
              </tr>
            )}
            {issues.map((issue) => (
              <tr key={issue.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={td}>
                  <span style={{ ...badge, ...TYPE_COLOR[issue.type] }}>
                    {TYPE_LABEL[issue.type]}
                  </span>
                </td>
                <td style={{ ...td, maxWidth: 260, fontWeight: 500 }}>
                  {issue.title}
                  {issue.description && (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, fontWeight: 400 }}>
                      {issue.description.slice(0, 60)}{issue.description.length > 60 ? '…' : ''}
                    </div>
                  )}
                </td>
                <td style={td}>
                  <span style={{ ...badge, ...PRIORITY_COLOR[issue.priority] }}>
                    {PRIORITY_LABEL[issue.priority]}
                  </span>
                </td>
                <td style={td}>
                  <select
                    defaultValue={issue.status}
                    onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                    style={{
                      ...badge,
                      ...STATUS_COLOR[issue.status],
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 500,
                      fontSize: 12,
                      borderRadius: 12,
                      padding: '2px 8px',
                    }}
                  >
                    <option value="pending">待處理</option>
                    <option value="in_progress">進行中</option>
                    <option value="completed">已完成</option>
                    <option value="on_hold">暫緩</option>
                    <option value="rejected">已拒絕</option>
                  </select>
                </td>
                <td style={{ ...td, color: '#6b7280' }}>{issue.module ?? '-'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {issue.created_by ? (userMap[issue.created_by] ?? '-') : '-'}
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: '#6b7280' }}>
                  {issue.created_at ? issue.created_at.slice(0, 10) : '-'}
                </td>
                <td style={td}>
                  <select
                    defaultValue={issue.assigned_to ?? ''}
                    onChange={(e) => handleAssignChange(issue.id, e.target.value)}
                    style={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 4, padding: '2px 6px', color: '#374151' }}
                  >
                    <option value="">未指派</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: '#6b7280' }}>
                  {issue.completed_at ? issue.completed_at.slice(0, 10) : '-'}
                </td>
                <td style={td}>
                  <Link
                    href={`/report-issue/${issue.id}`}
                    style={{ fontSize: 12, color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, padding: '3px 10px', textDecoration: 'none', whiteSpace: 'nowrap' }}
                  >
                    檢視
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 5,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 13,
  color: '#111827',
  background: '#fff',
  boxSizing: 'border-box',
}

const th: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#374151',
  whiteSpace: 'nowrap',
  fontSize: 13,
}

const td: React.CSSProperties = {
  padding: '10px 14px',
  color: '#111827',
  verticalAlign: 'top',
}

const badge: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 500,
  whiteSpace: 'nowrap',
}
