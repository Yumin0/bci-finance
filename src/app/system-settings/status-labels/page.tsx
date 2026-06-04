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
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/app/_components/PageHeader'

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
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#000000'}
        onChange={e => handleColorPicker(e.target.value)}
        className="h-8 w-8 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
        title="選取顏色"
      />
      <Input
        value={hex}
        onChange={e => handleHexInput(e.target.value)}
        maxLength={7}
        placeholder="#000000"
        className="w-24 font-mono"
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

  if (loading) return <p className="p-8 text-muted-foreground">載入中...</p>

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <PageHeader title="狀態標籤設定" />
        <p className="mt-1 text-sm text-muted-foreground">
          自訂各模組的狀態標籤名稱與顏色。更新後全站即時生效。
        </p>
      </div>

      {(Object.keys(MODULE_LABELS) as (keyof StatusLabelConfig)[]).map(mod => (
        <Card key={mod}>
          <CardHeader>
            <CardTitle>{MODULE_LABELS[mod]}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-[120px_160px_1fr_120px] gap-3 border-b pb-2">
              {['預覽', '標籤名稱', '顏色', '顯示步驟'].map(h => (
                <span key={h} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {h}
                </span>
              ))}
            </div>

            {Object.entries(DEFAULT_STATUS_LABEL_CONFIG[mod]).map(([key]) => {
              const entry = config[mod][key]
              return (
                <div key={key} className="grid grid-cols-[120px_160px_1fr_120px] items-center gap-3 py-1.5">
                  <span style={{
                    fontSize: 12, padding: '3px 10px', borderRadius: 4, fontWeight: 500,
                    background: hexToRgba(entry.color, 0.15),
                    color: entry.color,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: 120, display: 'inline-block',
                  }}>
                    {entry.label}
                  </span>
                  <Input
                    value={entry.label}
                    onChange={e => updateEntry(mod, key, 'label', e.target.value)}
                  />
                  <ColorPicker
                    value={entry.color}
                    onChange={v => updateEntry(mod, key, 'color', v)}
                  />
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm text-foreground">
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
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center gap-3 border-t pt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? '儲存中...' : '儲存設定'}
        </Button>
        {saved && <span className="text-sm text-green-700 dark:text-green-400">已儲存</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  )
}
