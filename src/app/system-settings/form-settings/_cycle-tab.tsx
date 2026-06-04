'use client'

import { useState, useEffect } from 'react'
import { getApplicationCycleConfig, saveApplicationCycleConfig } from '@/app/actions/application-cycle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

  if (loading) return <p className="text-sm text-muted-foreground">載入中...</p>

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>開放申請的星期</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            勾選後，申請人填寫資金分配申請單時，「申請日期」只能選擇勾選的星期幾。未勾選任何選項代表不限制。
          </p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map(wd => {
              const active = allowedWeekdays.includes(wd.value)
              return (
                <button
                  key={wd.value}
                  type="button"
                  onClick={() => toggleWeekday(wd.value)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    active
                      ? 'border-primary bg-primary/10 font-semibold text-primary'
                      : 'border-border bg-background font-normal text-foreground hover:bg-muted'
                  }`}
                >
                  {wd.label}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>可往後選幾週</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            從最近一個可選日期起，往後幾週的同一星期幾都可以選擇。例如設定 3，代表最近的那個週三加上往後 3 週，共 4 個日期可選。
          </p>
          <div className="flex items-center gap-2.5">
            <Input
              type="number"
              min={1}
              max={12}
              value={weeksAhead}
              onChange={e => setWeeksAhead(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">週</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? '儲存中...' : '儲存設定'}
        </Button>
        {savedMsg && (
          <span className={`text-sm ${savedMsg === '已儲存' ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
            {savedMsg}
          </span>
        )}
      </div>
    </div>
  )
}
