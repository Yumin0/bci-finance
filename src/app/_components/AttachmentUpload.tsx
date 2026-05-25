'use client'

import { useRef, useState } from 'react'
import AttachmentPreviewModal from './AttachmentPreviewModal'

export type AttachmentItem = {
  id?: number
  fileName: string
  storagePath: string
  fileType: string
  url: string
  slotLabel: string
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

export default function AttachmentUpload({ slotLabel, attachments, onAdd, onRemove, readOnly }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<AttachmentItem | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return
    setUploading(true)
    const folder = `pending/${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', folder)
      const res = await fetch('/api/upload-attachment', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        onAdd({ fileName: data.fileName, storagePath: data.storagePath, fileType: data.fileType, url: data.url, slotLabel })
      }
    }
    setUploading(false)
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

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: attachments.length ? 8 : 0 }}>
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
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              border: '1.5px dashed var(--border-color)',
              borderRadius: 6,
              background: 'none',
              color: uploading ? 'var(--text-subtle)' : 'var(--text-muted)',
              fontSize: 13,
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? '上傳中...' : '📎 選擇檔案（PDF / JPG / PNG）'}
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
