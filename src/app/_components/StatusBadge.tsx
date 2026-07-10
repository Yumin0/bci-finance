import {
  hexToRgba,
  formatStatusLabel,
  type StatusLabelConfig,
  type ModuleStatusConfig,
} from '@/lib/status-label-config'

type Props = {
  module: keyof StatusLabelConfig
  status: string
  stepName?: string | null
  labelConfig: StatusLabelConfig
}

export default function StatusBadge({ module, status, stepName, labelConfig }: Props) {
  const moduleConfig: ModuleStatusConfig = labelConfig[module]
  const entry = moduleConfig[status]

  if (!entry) {
    return (
      <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, background: 'var(--bg-page)', color: 'var(--text-muted)', fontWeight: 500 }}>
        {status}
      </span>
    )
  }

  const label = formatStatusLabel(entry, stepName)

  return (
    <span style={{
      fontSize: 12,
      padding: '3px 10px',
      borderRadius: 4,
      background: hexToRgba(entry.color, 0.15),
      color: entry.color,
      fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}
