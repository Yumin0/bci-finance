'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FundsAllocationTemplate } from '@/lib/types'
import {
  getVisibleSharedFundTemplates,
  getUserFundTemplates,
  updateUserFundTemplateName,
  deleteUserFundTemplate,
} from '@/app/actions/fund-templates'

function TemplateSummary({ t }: { t: FundsAllocationTemplate }) {
  const v = t.field_values
  const parts = [
    v.payment_account && `出款帳戶：${v.payment_account}`,
    v.expense_item && `費用項目：${v.expense_item}`,
    v.name && `項目：${v.name}`,
  ].filter(Boolean)
  return parts.length > 0 ? (
    <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{parts.join('　｜　')}</p>
  ) : null
}

export default function TemplateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [shared, setShared] = useState<FundsAllocationTemplate[]>([])
  const [mine, setMine] = useState<FundsAllocationTemplate[]>([])
  const [loading, setLoading] = useState(true)

  // Rename inline state
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameInput, setRenameInput] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      getVisibleSharedFundTemplates(),
      getUserFundTemplates(),
    ]).then(([s, m]) => { setShared(s); setMine(m); setLoading(false) })
  }, [])

  function applyTemplate(id: number) {
    onClose()
    router.push(`/funds-allocation/my-funds/add?templateId=${id}`)
  }

  function startRename(t: FundsAllocationTemplate) {
    setRenamingId(t.id)
    setRenameInput(t.name)
  }

  async function confirmRename(id: number) {
    if (!renameInput.trim()) return
    setRenameLoading(true)
    const { error } = await updateUserFundTemplateName(id, renameInput.trim())
    setRenameLoading(false)
    if (!error) {
      setRenamingId(null)
      setMine(prev => prev.map(t => t.id === id ? { ...t, name: renameInput.trim() } : t))
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id)
    const { error } = await deleteUserFundTemplate(id)
    setDeletingId(null)
    if (!error) setMine(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        width: '100%',
        maxWidth: 640,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>選取範本</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-subtle)', lineHeight: 1 }}>×</button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
          {loading && <p style={{ textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>載入中...</p>}

          {!loading && (
            <>
              {/* Shared templates */}
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                共用範本
              </p>
              {shared.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-subtle)', marginBottom: 16 }}>目前沒有適用於你的共用範本</p>
              )}
              {shared.map(t => (
                <div key={t.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 14px', marginBottom: 8, background: 'var(--bg-page)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{t.name}</p>
                      <TemplateSummary t={t} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => applyTemplate(t.id)} style={btnApply}>套用</button>
                    </div>
                  </div>
                </div>
              ))}

              {/* My templates */}
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, marginTop: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                我的範本
              </p>
              {mine.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-subtle)' }}>尚未儲存個人範本。填寫申請單後可從底部「另存為我的範本」建立。</p>
              )}
              {mine.map(t => (
                <div key={t.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 14px', marginBottom: 8, background: 'var(--bg-page)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {renamingId === t.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            value={renameInput}
                            onChange={e => setRenameInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && confirmRename(t.id)}
                            style={{ padding: '4px 8px', border: '1px solid var(--ring)', borderRadius: 5, fontSize: 13, flex: 1, background: 'var(--bg-card)', color: 'var(--text-body)' }}
                            autoFocus
                          />
                          <button onClick={() => confirmRename(t.id)} disabled={renameLoading} style={btnConfirm}>
                            {renameLoading ? '...' : '確認'}
                          </button>
                          <button onClick={() => setRenamingId(null)} style={btnCancel}>取消</button>
                        </div>
                      ) : (
                        <>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{t.name}</p>
                          <TemplateSummary t={t} />
                        </>
                      )}
                    </div>
                    {renamingId !== t.id && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => applyTemplate(t.id)} style={btnApply}>套用</button>
                        <button onClick={() => startRename(t)} style={btnOutline}>改名</button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          disabled={deletingId === t.id}
                          style={btnDanger}
                        >
                          {deletingId === t.id ? '...' : '刪除'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const btnApply: React.CSSProperties = { padding: '5px 12px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const btnOutline: React.CSSProperties = { padding: '5px 10px', background: 'var(--bg-card)', color: 'var(--text-body)', border: '1px solid var(--btn-border)', borderRadius: 5, fontSize: 12, cursor: 'pointer' }
const btnConfirm: React.CSSProperties = { padding: '4px 10px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 5, fontSize: 12, cursor: 'pointer' }
const btnCancel: React.CSSProperties = { padding: '4px 8px', background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--btn-border)', borderRadius: 5, fontSize: 12, cursor: 'pointer' }
const btnDanger: React.CSSProperties = { padding: '5px 10px', background: 'var(--bg-card)', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 5, fontSize: 12, cursor: 'pointer' }
