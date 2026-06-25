'use client'

import { useRef, useState, useEffect } from 'react'
import { logout } from '@/app/actions/auth'

type Props = {
  userId: number
  name: string
  initialAvatarUrl: string | null
}

export default function UserAvatar({ userId, name, initialAvatarUrl }: Props) {
  const [open, setOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('userId', String(userId))
      const res = await fetch('/api/upload-avatar', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) setAvatarUrl(data.url)
    } finally {
      setUploading(false)
      setOpen(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const initial = name.charAt(0)

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title={name}
        style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          border: '2px solid var(--border-color)',
          background: avatarUrl ? 'transparent' : 'var(--btn-primary-bg, #3b82f6)',
          cursor: 'pointer',
          overflow: 'hidden',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', lineHeight: 1 }}>{initial}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 40,
          minWidth: 160,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          zIndex: 200,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-color)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-title)',
          }}>
            {name}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '9px 14px',
              background: 'none',
              border: 'none',
              cursor: uploading ? 'default' : 'pointer',
              fontSize: 13,
              color: 'var(--text-body)',
              opacity: uploading ? 0.5 : 1,
            }}
          >
            {uploading ? '上傳中...' : '上傳頭像'}
          </button>
          <form action={logout}>
            <button
              type="submit"
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '9px 14px',
                background: 'none',
                border: 'none',
                borderTop: '1px solid var(--border-color)',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-muted)',
              }}
            >
              登出
            </button>
          </form>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  )
}
