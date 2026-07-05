'use client'

import { useRef, useState, useCallback } from 'react'
import AttachmentPreviewModal from './AttachmentPreviewModal'

export type AttachmentItem = {
  id?: number
  fileName: string
  storagePath: string
  fileType: string
  url: string
  slotLabel: string
}

type UploadingFile = {
  id: string
  name: string
  progress: number
  error?: string
}

type Props = {
  slotLabel: string
  attachments: AttachmentItem[]
  onAdd: (item: AttachmentItem) => void
  onRemove: (item: AttachmentItem) => void
  readOnly?: boolean
}

const ACCEPTED = '.pdf,.jpg,.jpeg,.png'
const ICON: Record<string, string> = { pdf: '📄', jpg: '🖼', jpeg: '🖼', png: '🖼' }

function friendlyError(status: number, body: string): string {
  if (status === 413) return '檔案太大，請選擇較小的檔案後再試'
  if (status === 400) return '檔案格式不支援，請選擇 PDF、JPG 或 PNG'
  if (status === 401 || status === 403) return '你沒有權限上傳檔案，請重新登入後再試'
  try {
    const json = JSON.parse(body)
    if (json?.error) return `上傳失敗：${json.error}`
  } catch { /* ignore */ }
  if (status >= 500) return '伺服器發生問題，請稍後再試'
  return '上傳失敗，請稍後再試'
}

export default function AttachmentUpload({ slotLabel, attachments, onAdd, onRemove, readOnly }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [preview, setPreview] = useState<AttachmentItem | null>(null)

  const uploadFile = useCallback((file: File) => {
    const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const folder = `pending/${fileId}`

    setUploadingFiles(prev => [...prev, { id: fileId, name: file.name, progress: 0 }])

    const xhr = new XMLHttpRequest()
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', folder)

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100)
        setUploadingFiles(prev => prev.map(f => f.id === fileId ? { ...f, progress: pct } : f))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          onAdd({ fileName: data.fileName, storagePath: data.storagePath, fileType: data.fileType, url: data.url, slotLabel })
          setUploadingFiles(prev => prev.filter(f => f.id !== fileId))
        } catch {
          setUploadingFiles(prev => prev.map(f => f.id === fileId ? { ...f, error: '伺服器回應異常，請重新上傳' } : f))
        }
      } else {
        const msg = friendlyError(xhr.status, xhr.responseText)
        setUploadingFiles(prev => prev.map(f => f.id === fileId ? { ...f, error: msg } : f))
      }
    })

    xhr.addEventListener('error', () => {
      setUploadingFiles(prev => prev.map(f => f.id === fileId ? { ...f, error: '網路連線失敗，請確認網路後再試' } : f))
    })

    xhr.open('POST', '/api/upload-attachment')
    xhr.send(fd)
  }, [slotLabel, onAdd])

  function handleFiles(files: FileList | null) {
    if (!files || !files.length) return
    Array.from(files).forEach(uploadFile)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleRemove(item: AttachmentItem) {
    if (!item.id) {
      await fetch('/api/upload-attachment', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: item.storagePath }),
      })
    }
    onRemove(item)
  }

  const hasContent = attachments.length > 0 || uploadingFiles.length > 0

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: hasContent ? 10 : 0 }}>
        {/* 已完成的附件 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {attachments.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                background: 'var(--bg-sidebar)',
                fontSize: 13,
                maxWidth: 240,
              }}
            >
              <span style={{ flexShrink: 0 }}>{ICON[item.fileType] ?? '📎'}</span>
              <button
                type="button"
                onClick={() => setPreview(item)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-body)', fontSize: 13, padding: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160,
                  textAlign: 'left',
                }}
              >
                {item.fileName}
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemove(item)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#9ca3af', fontSize: 15, lineHeight: 1, padding: '0 2px', flexShrink: 0,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 上傳中的檔案（含進度條） */}
        {uploadingFiles.map(uf => (
          <div
            key={uf.id}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '7px 10px',
              border: `1px solid ${uf.error ? '#fca5a5' : 'var(--border-color)'}`,
              borderRadius: 6,
              background: uf.error ? '#fff5f5' : 'var(--bg-sidebar)',
              fontSize: 13,
              maxWidth: 320,
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 1 }}>{uf.error ? '⚠️' : '📎'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: uf.error ? '#dc2626' : 'var(--text-body)',
                marginBottom: uf.error ? 2 : 4,
              }}>
                {uf.name}
              </div>
              {uf.error ? (
                <div style={{ fontSize: 12, color: '#dc2626' }}>{uf.error}</div>
              ) : (
                <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2 }}>
                  <div style={{
                    height: '100%',
                    width: `${uf.progress}%`,
                    background: 'var(--primary, #3b82f6)',
                    borderRadius: 2,
                    transition: 'width 0.15s ease',
                  }} />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setUploadingFiles(prev => prev.filter(f => f.id !== uf.id))}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9ca3af', fontSize: 15, lineHeight: 1, padding: '0 2px', flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {!readOnly && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              border: '1.5px dashed var(--border-color)',
              borderRadius: 6,
              background: 'none',
              color: 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            📎 選擇檔案（PDF / JPG / PNG）
          </button>
        </>
      )}

      {preview && (
        <AttachmentPreviewModal
          url={preview.url}
          fileName={preview.fileName}
          fileType={preview.fileType}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
