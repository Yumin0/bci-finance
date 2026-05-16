'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
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
  const [state, setState] = useState<IssueFormState>(undefined)
  const [isPending, startFormTransition] = useTransition()
  const [, startStatusTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const tempId = useRef(`new-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))

  useEffect(() => {
    if (state?.success) {
      setShowForm(false)
      setSelectedImg(null)
      if (editorRef.current) editorRef.current.innerHTML = ''
      tempId.current = `new-${Date.now()}-${Math.random().toString(36).slice(2)}`
    }
  }, [state])

  // Clear selection on any scroll so the fixed overlay doesn't drift
  useEffect(() => {
    const onScroll = () => setSelectedImg(null)
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [])

  function handleEditorClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      setSelectedImg(target as HTMLImageElement)
    } else {
      setSelectedImg(null)
    }
  }

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!selectedImg) return

    const startX = e.clientX
    const startW = selectedImg.getBoundingClientRect().width

    function onMove(ev: MouseEvent) {
      const newW = Math.max(40, startW + (ev.clientX - startX))
      selectedImg!.style.width = `${newW}px`
      selectedImg!.style.maxWidth = '100%'
      if (overlayRef.current) {
        const r = selectedImg!.getBoundingClientRect()
        overlayRef.current.style.left = `${r.left}px`
        overlayRef.current.style.top = `${r.top}px`
        overlayRef.current.style.width = `${r.width}px`
        overlayRef.current.style.height = `${r.height}px`
      }
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  async function uploadAndInsert(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('issueId', tempId.current)
    const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
    const json = await res.json()
    setUploading(false)
    if (json.url) {
      editorRef.current?.focus()
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${json.url}" style="max-width:100%;border-radius:6px;margin:8px 0;display:block;" /><br>`,
      )
    } else {
      alert('上傳失敗：' + (json.error ?? '未知錯誤'))
    }
  }

  function handleEditorPaste(e: React.ClipboardEvent) {
    const imageItem = Array.from(e.clipboardData.items).find((item) => item.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) uploadAndInsert(file)
    }
  }

  function handleFormSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('before_description', editorRef.current?.innerHTML ?? '')
    startFormTransition(async () => {
      const result = await submitIssue(undefined, fd)
      setState(result)
    })
  }

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
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{ fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 10px', background: '#fff', cursor: uploading ? 'not-allowed' : 'pointer', color: '#374151' }}
                >
                  {uploading ? '上傳中...' : '📷 插入截圖'}
                </button>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>或直接貼上圖片（Cmd+V）／拖曳</span>
              </div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onPaste={handleEditorPaste}
                onClick={handleEditorClick}
                onInput={() => {
                  if (selectedImg && !selectedImg.isConnected) setSelectedImg(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  Array.from(e.dataTransfer.files)
                    .filter((f) => f.type.startsWith('image/'))
                    .forEach((f) => uploadAndInsert(f))
                }}
                onDragOver={(e) => e.preventDefault()}
                style={{
                  minHeight: 120,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 13,
                  lineHeight: 1.8,
                  color: '#111827',
                  outline: 'none',
                  wordBreak: 'break-word',
                  background: '#fff',
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  Array.from(e.target.files ?? []).forEach((f) => uploadAndInsert(f))
                  e.target.value = ''
                }}
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
                disabled={isPending}
                style={{
                  background: isPending ? '#93c5fd' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '9px 24px',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {isPending ? '提交中...' : '送出回報'}
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

      {/* Drag-resize overlay — position:fixed so it floats above the editor */}
      {selectedImg && selectedImg.isConnected && (() => {
        const r = selectedImg.getBoundingClientRect()
        return (
          <div
            ref={overlayRef}
            style={{ position: 'fixed', left: r.left, top: r.top, width: r.width, height: r.height, outline: '2px solid #2563eb', borderRadius: 4, pointerEvents: 'none', zIndex: 1000, boxSizing: 'border-box' }}
          >
            <div
              onMouseDown={handleResizeMouseDown}
              title="拖曳調整大小"
              style={{ position: 'absolute', right: -5, bottom: -5, width: 12, height: 12, background: '#2563eb', border: '2px solid #fff', borderRadius: '50%', cursor: 'se-resize', pointerEvents: 'all' }}
            />
          </div>
        )
      })()}
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
