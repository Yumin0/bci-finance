'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { DevTracker, IssueStatus, IssueType, AppUser } from '@/lib/types'
import { saveHtml, updateIssueStatus, updateIssueType, assignIssue } from '@/app/actions/dev-tracker'

// ── helpers ───────────────────────────────────────────────────────────────────

function toEditorHtml(raw: string | null | undefined): string {
  if (!raw) return ''
  // If already HTML (saved by this editor), use as-is
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw
  // Plain text from the original form → escape and preserve line breaks
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

const IMG_STYLE = 'max-width:100%;border-radius:6px;margin:8px 0;display:block;cursor:zoom-in;'

function buildInitialHtml(
  description: string | null | undefined,
  blocks: DevTracker['before_blocks'],
): string {
  const html = toEditorHtml(description)
  // If no blocks data, just return the text html
  if (!blocks || blocks.length === 0) return html
  // If html already contains images (previously saved by this editor), don't append again
  if (html.includes('<img')) return html
  // Migrate: append images from blocks after the text
  const imgHtml = blocks
    .filter((b) => b.type === 'image')
    .map((b) => `<img src="${(b as { type: 'image'; url: string }).url}" style="${IMG_STYLE}" />`)
    .join('<br>')
  if (!imgHtml) return html
  return html ? `${html}<br>${imgHtml}` : imgHtml
}

// ── constants ─────────────────────────────────────────────────────────────────

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

// ── main component ────────────────────────────────────────────────────────────

export default function IssueDetailView({
  issue,
  users,
}: {
  issue: DevTracker
  users: Pick<AppUser, 'id' | 'name'>[]
  currentUserId: number | null
}) {
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [currentType, setCurrentType] = useState(issue.type)
  const [, startTransition] = useTransition()

  const beforeHtml = buildInitialHtml(
    issue.before_description ?? issue.description,
    issue.before_blocks,
  )
  const afterHtml = buildInitialHtml(issue.after_description, issue.after_blocks)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 14 }}>
        <Link href="/report-issue" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
          ← 返回列表
        </Link>
      </div>

      <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>
        #{issue.id}　{issue.title}
      </h1>

      {/* metadata */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <select
          value={currentType}
          onChange={(e) => {
            const val = e.target.value as IssueType
            setCurrentType(val)
            startTransition(async () => { await updateIssueType(issue.id, val) })
          }}
          style={{ ...chip, ...TYPE_COLOR[currentType], border: 'none', cursor: 'pointer', fontWeight: 500 }}
        >
          <option value="feature">新功能許願</option>
          <option value="bug">Bug回報</option>
          <option value="performance">技術效能優化</option>
        </select>
        <span style={{ ...chip, ...PRIORITY_COLOR[issue.priority] }}>
          {{ low: '低', medium: '中', high: '高', critical: '緊急' }[issue.priority]}
        </span>
        <select
          defaultValue={issue.status}
          onChange={(e) => startTransition(async () => { await updateIssueStatus(issue.id, e.target.value) })}
          style={{ ...chip, ...STATUS_COLOR[issue.status], border: 'none', cursor: 'pointer', fontWeight: 500 }}
        >
          <option value="pending">待處理</option>
          <option value="in_progress">進行中</option>
          <option value="completed">已完成</option>
          <option value="on_hold">暫緩</option>
          <option value="rejected">已拒絕</option>
        </select>
        {issue.module && (
          <span style={{ ...chip, background: '#f3f4f6', color: '#6b7280' }}>{issue.module}</span>
        )}
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          建立者：{issue.created_by ? (userMap[issue.created_by] ?? '-') : '-'}　{issue.created_at?.slice(0, 10)}
        </span>
        <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
          承接：
          <select
            defaultValue={issue.assigned_to ?? ''}
            onChange={(e) => startTransition(async () => { await assignIssue(issue.id, e.target.value ? Number(e.target.value) : null) })}
            style={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 4, padding: '2px 6px' }}
          >
            <option value="">未指派</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </span>
      </div>

      {/* panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', flex: 1, minHeight: 0 }}>
        <div style={{ borderRight: '1px solid #e5e7eb', overflowY: 'auto', height: 'calc(100vh - 255px)' }}>
          <ContentEditor
            side="before"
            issueId={issue.id}
            initialHtml={beforeHtml}
            accentColor="#f59e0b"
            title="問題背景（Before）"
            subtitle="這個問題 / 需求是什麼？為什麼要做？"
            onLightbox={setLightboxUrl}
          />
        </div>
        <div style={{ overflowY: 'auto', height: 'calc(100vh - 255px)' }}>
          <ContentEditor
            side="after"
            issueId={issue.id}
            initialHtml={afterHtml}
            accentColor="#10b981"
            title="完成內容（After）"
            subtitle="做了哪些改動？結果是什麼？"
            onLightbox={setLightboxUrl}
          />
        </div>
      </div>

      {/* lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'zoom-out' }}
        >
          <img
            src={lightboxUrl}
            alt="preview"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 6 }}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            style={{ position: 'fixed', top: 16, right: 20, background: 'none', border: 'none', color: '#fff', fontSize: 30, cursor: 'pointer', lineHeight: 1 }}
          >×</button>
        </div>
      )}
    </div>
  )
}

// ── ContentEditor ─────────────────────────────────────────────────────────────

function ContentEditor({
  side,
  issueId,
  initialHtml,
  accentColor,
  title,
  subtitle,
  onLightbox,
}: {
  side: 'before' | 'after'
  issueId: number
  initialHtml: string
  accentColor: string
  title: string
  subtitle: string
  onLightbox: (url: string) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState<boolean | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialHtml
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function uploadAndInsert(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('issueId', String(issueId))
    const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
    const json = await res.json()
    setUploading(false)

    if (json.url) {
      editorRef.current?.focus()
      // Insert image inline at current cursor, followed by a line break to continue typing
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${json.url}" style="max-width:100%;border-radius:6px;margin:8px 0;display:block;cursor:zoom-in;" /><br>`,
      )
    } else {
      alert('上傳失敗：' + (json.error ?? '未知錯誤'))
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const imageItem = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) uploadAndInsert(file)
    }
    // Non-image paste falls through to browser default (text pastes normally)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    Array.from(e.dataTransfer.files)
      .filter((f) => f.type.startsWith('image/'))
      .forEach((f) => uploadAndInsert(f))
  }

  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      onLightbox((target as HTMLImageElement).src)
    }
  }

  async function handleSave() {
    setSaving(true)
    const html = editorRef.current?.innerHTML ?? ''
    const result = await saveHtml(issueId, side, html)
    setSaving(false)
    setSaveOk(!result.error)
    setTimeout(() => setSaveOk(null), 2500)
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 標頭 */}
      <div style={{ borderLeft: `4px solid ${accentColor}`, paddingLeft: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>
      </div>

      {/* 工具列 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{ fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 12px', background: '#fff', cursor: uploading ? 'not-allowed' : 'pointer', color: '#374151' }}
        >
          {uploading ? '上傳中...' : '📷 插入圖片'}
        </button>
        <span style={{ fontSize: 11, color: '#d1d5db' }}>或直接貼上 Cmd+V／拖曳</span>
      </div>

      {/* 編輯區 */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={handleClick}
        style={{
          minHeight: 260,
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '12px 14px',
          fontSize: 14,
          lineHeight: 1.8,
          color: '#111827',
          outline: 'none',
          wordBreak: 'break-word',
        }}
      />

      {/* 儲存（sticky 固定在可視區底部） */}
      <div style={{ position: 'sticky', bottom: 0, background: '#fff', paddingTop: 8, paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? '儲存中...' : '儲存'}
        </button>
        {saveOk !== null && (
          <span style={{ fontSize: 12, color: saveOk ? '#16a34a' : '#dc2626' }}>
            {saveOk ? '已儲存' : '儲存失敗'}
          </span>
        )}
        {uploading && <span style={{ fontSize: 12, color: '#9ca3af' }}>圖片上傳中...</span>}
      </div>

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
  )
}

// ── styles ────────────────────────────────────────────────────────────────────

const chip: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 500,
  whiteSpace: 'nowrap',
}
