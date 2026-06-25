'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  type NotificationItem,
} from '@/app/actions/notifications'
import { formatDateTime } from '@/lib/dateUtils'

type Props = {
  userId: number
  initialUnreadCount: number
}

const TYPE_ICON: Record<string, string> = {
  approval_needed: '📋',
  approved: '✅',
  rejected: '↩️',
  payment_ready: '💳',
}

export default function NotificationBell({ userId, initialUnreadCount }: Props) {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function handleOpen() {
    if (open) { setOpen(false); return }
    setOpen(true)
    setLoading(true)
    const items = await getNotifications(userId)
    setNotifications(items)
    setLoading(false)
  }

  async function handleClickItem(item: NotificationItem) {
    if (!item.is_read) {
      await markAsRead(item.id)
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
    setOpen(false)
    if (item.link) router.push(item.link)
  }

  async function handleMarkAllRead() {
    await markAllAsRead(userId)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  // 每 60 秒重新拉取未讀數量（不開 dropdown 也能更新紅點）
  useEffect(() => {
    const timer = setInterval(async () => {
      const count = await getUnreadCount(userId)
      setUnreadCount(count)
    }, 60000)
    return () => clearInterval(timer)
  }, [userId])

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={handleOpen}
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          borderRadius: 8,
          border: '1px solid var(--border-color)',
          background: open ? 'var(--bg-hover, rgba(0,0,0,0.06))' : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          flexShrink: 0,
        }}
        title="通知"
      >
        {/* Bell icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 4,
            right: 4,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            background: '#ef4444',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
            border: '1.5px solid var(--bg-header)',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 42,
          width: 320,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
          zIndex: 200,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-title)' }}>
              通知
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  fontSize: 12,
                  color: 'var(--color-primary, #3b82f6)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                全部標為已讀
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                載入中…
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                沒有通知
              </div>
            ) : (
              notifications.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleClickItem(item)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    background: item.is_read ? 'transparent' : 'var(--bg-unread, rgba(59,130,246,0.06))',
                    border: 'none',
                    borderBottom: '1px solid var(--border-color)',
                    cursor: item.link ? 'pointer' : 'default',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                    {TYPE_ICON[item.type] ?? '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: item.is_read ? 400 : 600,
                      color: 'var(--text-title)',
                      marginBottom: 2,
                    }}>
                      {item.title}
                    </div>
                    {item.body && (
                      <div style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {item.body}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      {formatDateTime(item.created_at)}
                    </div>
                  </div>
                  {!item.is_read && (
                    <span style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#3b82f6',
                      flexShrink: 0,
                      marginTop: 5,
                    }} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
