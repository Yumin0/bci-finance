'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_STATUS_LABEL_CONFIG,
  hexToRgba,
  type StatusLabelConfig,
  type StatusLabelEntry,
} from '@/lib/status-label-config'
import { getStatusLabelConfig, saveStatusLabelConfig } from '@/app/actions/status-labels'
import { Button } from '@/components/ui/button'

const MODULE_LABELS: Record<keyof StatusLabelConfig, string> = {
  funds_allocation: '資金分配申請',
  payment_voucher:  '付款憑單',
  temp_voucher:     '暫付款沖銷憑單',
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [hex, setHex] = useState(value)

  useEffect(() => { setHex(value) }, [value])

  function handleHexInput(v: string) {
    setHex(v)
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v)
  }

  function handleColorPicker(v: string) {
    setHex(v)
    onChange(v)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#000000'}
        onChange={e => handleColorPicker(e.target.value)}
        style={{ width: 32, height: 32, padding: 2, border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', background: 'none' }}
        title="選取顏色"
      />
      <input
        value={hex}
        onChange={e => handleHexInput(e.target.value)}
        maxLength={7}
        placeholder="#000000"
        style={{
          width: 90, padding: '6px 10px', fontSize: 13, borderRadius: 6, fontFamily: 'monospace',
          border: '1px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-body)',
        }}
      />
    </div>
  )
}

export default function StatusLabelsPage() {
  const [config, setConfig] = useState<StatusLabelConfig>(DEFAULT_STATUS_LABEL_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getStatusLabelConfig().then(c => { setConfig(c); setLoading(false) })
  }, [])

  function updateEntry(
    mod: keyof StatusLabelConfig,
    key: string,
    field: keyof StatusLabelEntry,
    value: string | boolean,
  ) {
    setConfig(prev => ({
      ...prev,
      [mod]: { ...prev[mod], [key]: { ...prev[mod][key], [field]: value } },
    }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true); setError(null)
    const result = await saveStatusLabelConfig(config)
    setSaving(false)
    if (result.error) setError(result.error)
    else setSaved(true)
  }

  if (loading) return <p style={{ color: 'var(--text-muted)', padding: 32 }}>載入中...</p>

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>狀態標籤設定</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          自訂各模組的狀態標籤名稱與顏色。更新後全站即時生效。
        </p>
      </div>

      {(Object.keys(MODULE_LABELS) as (keyof StatusLabelConfig)[]).map(mod => (
        <section key={mod} style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
            {MODULE_LABELS[mod]}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* 欄位標題 */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 160px 1fr 120px', gap: 12, paddingBottom: 4, borderBottom: '1px solid var(--border-color)' }}>
              {['預覽', '標籤名稱', '顏色', '顯示步驟'].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>

            {Object.entries(DEFAULT_STATUS_LABEL_CONFIG[mod]).map(([key]) => {
              const entry = config[mod][key]

              return (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '120px 160px 1fr 120px', gap: 12, alignItems: 'center', padding: '6px 0' }}>
                  {/* 預覽 badge */}
                  <span style={{
                    fontSize: 12, padding: '3px 10px', borderRadius: 4, fontWeight: 500,
                    background: hexToRgba(entry.color, 0.15),
                    color: entry.color,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: 120, display: 'inline-block',
                  }}>
                    {entry.label}
                  </span>

                  {/* 標籤文字輸入 */}
                  <input
                    value={entry.label}
                    onChange={e => updateEntry(mod, key, 'label', e.target.value)}
                    style={{
                      padding: '6px 10px', fontSize: 13, borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-page)', color: 'var(--text-body)',
                      width: '100%',
                    }}
                  />

                  {/* 顏色選擇器 */}
                  <ColorPicker
                    value={entry.color}
                    onChange={v => updateEntry(mod, key, 'color', v)}
                  />

                  {/* 顯示步驟 */}
                  <label style={{ fontSize: 13, color: 'var(--text-body)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={entry.showStep}
                      onChange={e => updateEntry(mod, key, 'showStep', e.target.checked)}
                    />
                    顯示步驟
                  </label>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? '儲存中...' : '儲存設定'}
        </Button>
        {saved && <span style={{ fontSize: 13, color: '#166534' }}>已儲存</span>}
        {error && <span style={{ fontSize: 13, color: '#dc2626' }}>{error}</span>}
      </div>
    </div>
  )
}
