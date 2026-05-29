'use client'

import { useState, useEffect } from 'react'
import { getApplicationCycleConfig, saveApplicationCycleConfig } from '@/app/actions/application-cycle'

const WEEKDAYS = [
  { label: '週一', value: 1 },
  { label: '週二', value: 2 },
  { label: '週三', value: 3 },
  { label: '週四', value: 4 },
  { label: '週五', value: 5 },
  { label: '週六', value: 6 },
  { label: '週日', value: 0 },
]

export default function CycleTab() {
  const [allowedWeekdays, setAllowedWeekdays] = useState<number[]>([])
  const [weeksAhead, setWeeksAhead] = useState(3)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  useEffect(() => {
    getApplicationCycleConfig().then(config => {
      setAllowedWeekdays(config.allowed_weekdays)
      setWeeksAhead(config.weeks_ahead)
      setLoading(false)
    })
  }, [])

  function toggleWeekday(wd: number) {
    setAllowedWeekdays(prev =>
      prev.includes(wd) ? prev.filter(w => w !== wd) : [...prev, wd]
    )
  }

  async function handleSave() {
    setSaving(true)
    setSavedMsg(null)
    const { error } = await saveApplicationCycleConfig({ allowed_weekdays: allowedWeekdays, weeks_ahead: weeksAhead })
    setSaving(false)
    if (error) { setSavedMsg(error) }
    else { setSavedMsg('已儲存'); setTimeout(() => setSavedMsg(null), 3000) }
  }

  if (loading) return <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 14 }}>載入中...</div>

  return (
    <div style={{ maxWidth: 500 }}>
      {/* Weekday selection */}
      <div style={{ marginBottom: 28 }}>
        <p style={sectionTitle}>開放申請的星期</p>
        <p style={sectionDesc}>
          勾選後，申請人填寫資金分配申請單時，「申請日期」只能選擇勾選的星期幾。未勾選任何選項代表不限制。
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {WEEKDAYS.map(wd => {
            const active = allowedWeekdays.includes(wd.value)
            return (
              <button
                key={wd.value}
                type="button"
                onClick={() => toggleWeekday(wd.value)}
                style={{
                  padding: '6px 16px', fontSize: 14, borderRadius: 20, border: '1px solid',
                  borderColor: active ? '#2563eb' : 'var(--border-color)',
                  background: active ? '#eff6ff' : 'white',
                  color: active ? '#2563eb' : 'var(--text-body)',
                  cursor: 'pointer', fontWeight: active ? 600 : 400,
                }}
              >
                {wd.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Weeks ahead */}
      <div style={{ marginBottom: 32 }}>
        <p style={sectionTitle}>可往後選幾週</p>
        <p style={sectionDesc}>
          從最近一個可選日期起，往後幾週的同一星期幾都可以選擇。例如設定 3，代表最近的那個週三加上往後 3 週，共 4 個日期可選。
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="number"
            min={1}
            max={12}
            value={weeksAhead}
            onChange={e => setWeeksAhead(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
            style={{ width: 80, padding: '6px 10px', border: '1px solid var(--btn-border)', borderRadius: 6, fontSize: 14 }}
          />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>週</span>
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '8px 20px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? '儲存中...' : '儲存設定'}
        </button>
        {savedMsg && (
          <span style={{ fontSize: 13, color: savedMsg === '已儲存' ? '#16a34a' : '#dc2626' }}>{savedMsg}</span>
        )}
      </div>
    </div>
  )
}

const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: 'var(--text-title)', marginBottom: 4, marginTop: 0 }
const sectionDesc: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, marginTop: 0, lineHeight: 1.6 }
