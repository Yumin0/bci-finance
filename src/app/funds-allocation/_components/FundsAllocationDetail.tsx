import { FundsAllocation } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { type StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const readonlyCls = 'bg-[var(--bg-page)] cursor-default'

export default function FundsAllocationDetail({
  record,
  labelConfig,
  stepName,
}: {
  record: FundsAllocation
  labelConfig?: StatusLabelConfig
  stepName?: string | null
}) {
  return (
    <div style={{ maxWidth: 480, marginBottom: 32 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>資金分配申請單</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        <span>狀態：</span>
        {labelConfig ? (
          <StatusBadge module="funds_allocation" status={record.status} stepName={stepName} labelConfig={labelConfig} />
        ) : (
          <strong>{record.status}</strong>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>日期 *</label>
          <Input value={record.date} readOnly className={readonlyCls} />
        </div>
        <div>
          <label style={labelStyle}>申請處別</label>
          <Input value={record.apply_division ?? ''} readOnly className={readonlyCls} />
        </div>
        <div>
          <label style={labelStyle}>申請課別</label>
          <Input value={record.apply_section ?? ''} readOnly className={readonlyCls} />
        </div>
        <div>
          <label style={labelStyle}>申請人</label>
          <Input value={record.applicant ?? ''} readOnly className={readonlyCls} />
        </div>
        <div>
          <label style={labelStyle}>職稱</label>
          <Input value={record.apply_role ?? ''} readOnly className={readonlyCls} />
        </div>
        <div>
          <label style={labelStyle}>機構</label>
          <Input value={record.institution ?? ''} readOnly className={readonlyCls} />
        </div>
        <div>
          <label style={labelStyle}>出款帳戶</label>
          <Input value={record.payment_account ?? ''} readOnly className={readonlyCls} />
        </div>
        <div>
          <label style={labelStyle}>費用項目</label>
          <Input value={record.expense_item ?? ''} readOnly className={readonlyCls} />
        </div>
        <div>
          <label style={labelStyle}>名稱 *</label>
          <Input value={record.name} readOnly className={readonlyCls} />
        </div>
        <div>
          <label style={labelStyle}>金額 *</label>
          <Input value={String(record.amount)} readOnly className={readonlyCls} />
        </div>
        <div>
          <label style={labelStyle}>類別</label>
          <Input value={record.category ?? ''} readOnly className={readonlyCls} />
        </div>
        <div>
          <label style={labelStyle}>備註</label>
          <Textarea value={record.note ?? ''} readOnly rows={4} className={readonlyCls} />
        </div>
      </div>
    </div>
  )
}
