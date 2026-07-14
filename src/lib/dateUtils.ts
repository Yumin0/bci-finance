const TZ = 'Asia/Taipei'

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('zh-TW', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 今天的日期字串（台北時區，YYYY-MM-DD）；付款憑單/沖銷憑單的日期＝實際建單日用這個
export function taipeiToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

// 依申請週期設定（允許的星期幾）算出今天或之後最近一個可選日期
export function computeNearestAllowedDate(allowedWeekdays: number[]): string {
  if (!allowedWeekdays.length) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let nearest: Date | null = null
  for (const wd of allowedWeekdays) {
    const daysUntil = (wd - today.getDay() + 7) % 7
    const candidate = new Date(today)
    candidate.setDate(candidate.getDate() + daysUntil)
    if (!nearest || candidate < nearest) nearest = candidate
  }
  if (!nearest) return ''

  const y = nearest.getFullYear()
  const m = String(nearest.getMonth() + 1).padStart(2, '0')
  const d = String(nearest.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
