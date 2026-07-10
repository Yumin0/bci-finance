'use client'

type Props = {
  url: string
  fileName: string
  fileType: string
  onClose: () => void
}

export default function AttachmentPreviewModal({ url, fileName, fileType, onClose }: Props) {
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileType.toLowerCase())

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          overflow: 'hidden',
          width: '90vw',
          maxWidth: 900,
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-sidebar)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileName}
          </span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 12 }}>
            <a
              href={url}
              download={fileName}
              style={{
                fontSize: 12, padding: '4px 12px', borderRadius: 5, border: '1px solid var(--border-color)',
                background: 'var(--bg-card)', color: 'var(--text-body)', textDecoration: 'none', cursor: 'pointer',
              }}
            >
              下載
            </a>
            <button
              onClick={onClose}
              style={{
                fontSize: 18, lineHeight: 1, background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' }}>
          {isImage ? (
            <img
              src={url}
              alt={fileName}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          ) : (
            <iframe
              src={url}
              title={fileName}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
