'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { DevTracker, IssueStatus, AppUser } from '@/lib/types'
import { submitIssue, updateIssueStatus, assignIssue, IssueFormState } from '@/app/actions/dev-tracker'
import { formatDate } from '@/lib/dateUtils'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PageHeader from '@/app/_components/PageHeader'

const TYPE_LABEL: Record<string, string> = {
  improvement: '小優化許願',
  feature: '新功能許願',
  bug: 'Bug回報',
  performance: '技術效能優化',
}
const PRIORITY_LABEL: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '緊急' }

const PRIORITY_BADGE_STYLE: Record<string, React.CSSProperties> = {
  low: { background: 'var(--bg-page)', color: 'var(--text-muted)' },
  medium: { background: '#fef3c7', color: '#d97706' },
  high: { background: '#fed7aa', color: '#ea580c' },
  critical: { background: '#fee2e2', color: '#dc2626' },
}

const STATUS_COLOR: Record<IssueStatus, React.CSSProperties> = {
  pending: { background: 'var(--bg-page)', color: 'var(--text-muted)' },
  in_progress: { background: '#dbeafe', color: '#2563eb' },
  completed: { background: '#dcfce7', color: '#16a34a' },
  rejected: { background: '#fee2e2', color: '#dc2626' },
  on_hold: { background: '#fef3c7', color: '#d97706' },
}

const filterSelectCls = 'w-full cursor-pointer rounded border border-border bg-card px-1 py-0.5 text-xs text-foreground'

export default function IssueListView({
  issues,
  users,
  currentUserId: _currentUserId,
  moduleOptions,
}: {
  issues: DevTracker[]
  users: Pick<AppUser, 'id' | 'name'>[]
  currentUserId: number | null
  moduleOptions: string[]
}) {
  const [activeTab, setActiveTab] = useState<'improvement' | 'feature' | 'bug' | 'performance'>('improvement')
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

  const [typeValue, setTypeValue] = useState<string>('')
  const [priorityValue, setPriorityValue] = useState<string>('medium')
  const [moduleValue, setModuleValue] = useState<string>('')

  const [filterPriority, setFilterPriority] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterCreator, setFilterCreator] = useState<string>('')
  const [filterAssignee, setFilterAssignee] = useState<string>('')

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))

  useEffect(() => {
    setFilterPriority(''); setFilterStatus(''); setFilterCreator(''); setFilterAssignee('')
  }, [activeTab])

  const filteredIssues = issues
    .filter((issue) => issue.type === activeTab)
    .filter((issue) => !filterPriority || issue.priority === filterPriority)
    .filter((issue) => !filterStatus || issue.status === filterStatus)
    .filter((issue) => !filterCreator || String(issue.created_by) === filterCreator)
    .filter((issue) => {
      if (!filterAssignee) return true
      if (filterAssignee === '__unassigned__') return !issue.assigned_to
      return String(issue.assigned_to) === filterAssignee
    })

  useEffect(() => {
    if (state?.success) {
      setShowForm(false); setSelectedImg(null); setTypeValue(''); setPriorityValue('medium'); setModuleValue('')
      if (editorRef.current) editorRef.current.innerHTML = ''
      tempId.current = `new-${Date.now()}-${Math.random().toString(36).slice(2)}`
    }
  }, [state])

  useEffect(() => {
    const onScroll = () => setSelectedImg(null)
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [])

  function handleEditorClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') setSelectedImg(target as HTMLImageElement)
    else setSelectedImg(null)
  }

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!selectedImg) return
    const startX = e.clientX
    const startW = selectedImg.getBoundingClientRect().width
    function onMove(ev: MouseEvent) {
      const newW = Math.max(40, startW + (ev.clientX - startX))
      selectedImg!.style.width = `${newW}px`; selectedImg!.style.maxWidth = '100%'
      if (overlayRef.current) {
        const r = selectedImg!.getBoundingClientRect()
        overlayRef.current.style.left = `${r.left}px`; overlayRef.current.style.top = `${r.top}px`
        overlayRef.current.style.width = `${r.width}px`; overlayRef.current.style.height = `${r.height}px`
      }
    }
    function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }

  async function uploadAndInsert(file: File) {
    setUploading(true)
    const fd = new FormData(); fd.append('file', file); fd.append('issueId', tempId.current)
    const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
    const json = await res.json()
    setUploading(false)
    if (json.url) {
      editorRef.current?.focus()
      document.execCommand('insertHTML', false, `<img src="${json.url}" style="max-width:100%;border-radius:6px;margin:8px 0;display:block;" /><br>`)
    } else {
      alert('上傳失敗：' + (json.error ?? '未知錯誤'))
    }
  }

  function handleEditorPaste(e: React.ClipboardEvent) {
    const imageItem = Array.from(e.clipboardData.items).find((item) => item.type.startsWith('image/'))
    if (imageItem) { e.preventDefault(); const file = imageItem.getAsFile(); if (file) uploadAndInsert(file) }
  }

  function handleFormSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('before_description', editorRef.current?.innerHTML ?? '')
    startFormTransition(async () => { const result = await submitIssue(undefined, fd); setState(result) })
  }

  function handleStatusChange(id: number, status: string) {
    startStatusTransition(async () => { await updateIssueStatus(id, status) })
  }

  function handleAssignChange(id: number, assignedTo: string) {
    startStatusTransition(async () => { await assignIssue(id, assignedTo ? Number(assignedTo) : null) })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="問題回報 / 開發追蹤"
        action={
          <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? 'outline' : 'default'}>
            {showForm ? '取消' : '＋ 新增回報'}
          </Button>
        }
      />

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>新增回報</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">類型 *</label>
                  <Select name="type" value={typeValue} onValueChange={(v) => setTypeValue(v ?? '')}>
                    <SelectTrigger className="w-full">
                      <span className={typeValue ? 'text-foreground' : 'text-muted-foreground'}>
                        {typeValue ? TYPE_LABEL[typeValue] : '請選擇'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="improvement">小優化許願</SelectItem>
                      <SelectItem value="feature">新功能許願</SelectItem>
                      <SelectItem value="bug">Bug回報</SelectItem>
                      <SelectItem value="performance">技術效能優化</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="type" value={typeValue} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">優先級</label>
                  <Select name="priority" value={priorityValue} onValueChange={(v) => setPriorityValue(v ?? 'medium')}>
                    <SelectTrigger className="w-full">
                      <span className="text-foreground">{PRIORITY_LABEL[priorityValue]}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">低</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="critical">緊急</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="priority" value={priorityValue} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">影響模組</label>
                  <Select name="module" value={moduleValue} onValueChange={(v) => setModuleValue(v ?? '')}>
                    <SelectTrigger className="w-full">
                      <span className={moduleValue ? 'text-foreground' : 'text-muted-foreground'}>
                        {moduleValue || '請選擇（選填）'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {moduleOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="module" value={moduleValue} />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">標題 *</label>
                <Input name="title" type="text" placeholder="請簡述問題或需求" required />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">詳細描述</label>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? '上傳中...' : '📷 插入截圖'}
                  </Button>
                  <span className="text-xs text-muted-foreground">或直接貼上圖片（Cmd+V）／拖曳</span>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onPaste={handleEditorPaste}
                  onClick={handleEditorClick}
                  onInput={() => { if (selectedImg && !selectedImg.isConnected) setSelectedImg(null) }}
                  onDrop={(e) => { e.preventDefault(); Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/')).forEach((f) => uploadAndInsert(f)) }}
                  onDragOver={(e) => e.preventDefault()}
                  className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                  style={{ minHeight: 120, lineHeight: 1.8, wordBreak: 'break-word' }}
                />
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { Array.from(e.target.files ?? []).forEach((f) => uploadAndInsert(f)); e.target.value = '' }} />
              </div>

              {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
              {state?.success && <p className="text-sm text-green-600 dark:text-green-400">已成功提交！</p>}

              <div>
                <Button type="submit" disabled={isPending}>
                  {isPending ? '提交中...' : '送出回報'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tab 切換 */}
      <div className="flex border-b border-border">
        {(['improvement', 'feature', 'bug', 'performance'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveTab(type)}
            className={`-mb-px whitespace-nowrap border-b-2 px-5 py-2 text-sm font-medium transition-colors ${
              activeTab === type
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {TYPE_LABEL[type]}
          </button>
        ))}
      </div>

      {/* 問題列表 */}
      <Card className="overflow-hidden p-0">
        <Table className="[&_th]:align-top [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3">
          <TableHeader>
            <TableRow>
              <TableHead>影響模組</TableHead>
              <TableHead>標題</TableHead>
              <TableHead>
                <div className="flex flex-col gap-1">
                  <span>優先級</span>
                  <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className={filterSelectCls}>
                    <option value="">全部</option>
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="critical">緊急</option>
                  </select>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex flex-col gap-1">
                  <span>狀態</span>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={filterSelectCls}>
                    <option value="">全部</option>
                    <option value="pending">待處理</option>
                    <option value="in_progress">進行中</option>
                    <option value="completed">已完成</option>
                    <option value="on_hold">暫緩</option>
                    <option value="rejected">已拒絕</option>
                  </select>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex flex-col gap-1">
                  <span>建立者</span>
                  <select value={filterCreator} onChange={(e) => setFilterCreator(e.target.value)} className={filterSelectCls}>
                    <option value="">全部</option>
                    {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                  </select>
                </div>
              </TableHead>
              <TableHead>建立日期</TableHead>
              <TableHead>
                <div className="flex flex-col gap-1">
                  <span>承接開發者</span>
                  <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className={filterSelectCls}>
                    <option value="">全部</option>
                    <option value="__unassigned__">未指派</option>
                    {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                  </select>
                </div>
              </TableHead>
              <TableHead>完成日期</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIssues.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  尚無任何回報紀錄
                </TableCell>
              </TableRow>
            )}
            {filteredIssues.map((issue) => (
              <TableRow key={issue.id}>
                <TableCell className="text-muted-foreground">{issue.module ?? '-'}</TableCell>
                <TableCell className="max-w-[260px] font-medium">
                  <Link href={`/report-issue/${issue.id}`} className="hover:underline">
                    {issue.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge style={PRIORITY_BADGE_STYLE[issue.priority]}>
                    {PRIORITY_LABEL[issue.priority]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <select
                    defaultValue={issue.status}
                    onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                    style={{
                      ...STATUS_COLOR[issue.status],
                      border: 'none', cursor: 'pointer', fontWeight: 500,
                      fontSize: 12, borderRadius: 12, padding: '2px 8px', display: 'inline-block',
                    }}
                  >
                    <option value="pending">待處理</option>
                    <option value="in_progress">進行中</option>
                    <option value="completed">已完成</option>
                    <option value="on_hold">暫緩</option>
                    <option value="rejected">已拒絕</option>
                  </select>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {issue.created_by ? (userMap[issue.created_by] ?? '-') : '-'}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(issue.created_at)}
                </TableCell>
                <TableCell>
                  <select
                    defaultValue={issue.assigned_to ?? ''}
                    onChange={(e) => handleAssignChange(issue.id, e.target.value)}
                    className="rounded border border-border bg-card px-1.5 py-0.5 text-xs text-foreground"
                  >
                    <option value="">未指派</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(issue.completed_at)}
                </TableCell>
                <TableCell>
                  <Link href={`/report-issue/${issue.id}`} className="whitespace-nowrap rounded border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted">
                    檢視
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

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
