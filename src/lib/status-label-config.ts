export type StatusLabelEntry = {
  label: string
  color: string   // hex 色碼，例如 '#166534'，作為文字色；背景自動加透明度
  showStep: boolean
}

export type ModuleStatusConfig = Record<string, StatusLabelEntry>

export type StatusLabelConfig = {
  funds_allocation: ModuleStatusConfig
  payment_voucher: ModuleStatusConfig
  temp_voucher: ModuleStatusConfig
}

// 舊資料（儲存為 'gray'/'green'/'blue'/'red'）的遷移對應
const LEGACY_COLOR_MAP: Record<string, string> = {
  gray:  '#4b5563',
  green: '#166534',
  blue:  '#1d4ed8',
  red:   '#be123c',
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function migrateColor(color: string): string {
  return LEGACY_COLOR_MAP[color] ?? color
}

export const PRESET_COLORS = [
  { label: '灰',  value: '#4b5563' },
  { label: '綠',  value: '#166534' },
  { label: '藍',  value: '#1d4ed8' },
  { label: '紅',  value: '#be123c' },
]

export const DEFAULT_STATUS_LABEL_CONFIG: StatusLabelConfig = {
  funds_allocation: {
    draft:    { label: '草稿',   color: '#4b5563', showStep: false },
    pending:  { label: '新單',   color: '#166534', showStep: true  },
    approved: { label: '已核准', color: '#1d4ed8', showStep: true  },
    rejected: { label: '未核准', color: '#be123c', showStep: true  },
  },
  payment_voucher: {
    draft:    { label: '草稿',   color: '#4b5563', showStep: false },
    pending:  { label: '新單',   color: '#166534', showStep: true  },
    approved: { label: '已核准', color: '#be123c', showStep: true  },
    rejected: { label: '未核准', color: '#be123c', showStep: true  },
    paid:     { label: '已付款', color: '#be123c', showStep: false },
  },
  temp_voucher: {
    draft:    { label: '草稿',   color: '#4b5563', showStep: false },
    pending:  { label: '新單',   color: '#166534', showStep: true  },
    approved: { label: '已核准', color: '#1d4ed8', showStep: true  },
    rejected: { label: '未核准', color: '#be123c', showStep: true  },
  },
}

export function mergeStatusLabelConfig(saved: Partial<StatusLabelConfig>): StatusLabelConfig {
  const result: StatusLabelConfig = {
    funds_allocation: { ...DEFAULT_STATUS_LABEL_CONFIG.funds_allocation },
    payment_voucher:  { ...DEFAULT_STATUS_LABEL_CONFIG.payment_voucher  },
    temp_voucher:     { ...DEFAULT_STATUS_LABEL_CONFIG.temp_voucher     },
  }

  for (const mod of ['funds_allocation', 'payment_voucher', 'temp_voucher'] as const) {
    const savedMod = saved[mod]
    if (!savedMod) continue
    for (const key of Object.keys(DEFAULT_STATUS_LABEL_CONFIG[mod])) {
      if (savedMod[key]) {
        result[mod][key] = {
          ...DEFAULT_STATUS_LABEL_CONFIG[mod][key],
          ...savedMod[key],
          color: migrateColor(savedMod[key].color ?? DEFAULT_STATUS_LABEL_CONFIG[mod][key].color),
        }
      }
    }
  }

  return result
}

export function formatStatusLabel(
  entry: StatusLabelEntry,
  stepName?: string | null,
): string {
  if (entry.showStep && stepName) return `${entry.label} - ${stepName}`
  return entry.label
}
