import { FundsAllocation, FundAttachment } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { type StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import AttachmentUpload from '@/app/_components/AttachmentUpload'

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const readonlyCls = 'bg-[var(--bg-page)] cursor-default'
const blockStyle: React.CSSProperties = { marginBottom: 16, border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)' }
const gridStyle = (cols: number): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 20, marginBottom: 20 })

function Field({ label, value, textarea }: { label: string; value: string; textarea?: boolean }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {textarea
        ? <Textarea value={value} readOnly rows={4} className={readonlyCls} />
        : <Input value={value} readOnly className={readonlyCls} />}
    </div>
  )
}

export default function FundsAllocationDetail({
  record,
  labelConfig,
  stepName,
  attachments,
}: {
  record: FundsAllocation
  labelConfig?: StatusLabelConfig
  stepName?: string | null
  attachments?: FundAttachment[]
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>資金分配申請單</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        <span>狀態：</span>
        {labelConfig
          ? <StatusBadge module="funds_allocation" status={record.status} stepName={stepName} labelConfig={labelConfig} />
          : <strong>{record.status}</strong>}
      </div>

      {/* Block 1：申請人資訊 */}
      <div style={blockStyle}>
        <div style={{ padding: '20px 20px 4px' }}>
          <div style={gridStyle(2)}>
            <Field label="日期 *" value={record.date} />
            <div />
          </div>
          <div style={gridStyle(2)}>
            <Field label="申請處別" value={record.apply_division ?? ''} />
            <Field label="申請課別" value={record.apply_section ?? ''} />
          </div>
          <div style={gridStyle(2)}>
            <Field label="申請人" value={record.applicant ?? ''} />
            <Field label="職稱" value={record.apply_role ?? ''} />
          </div>
        </div>
      </div>

      {/* Block 2：費用資訊 */}
      <div style={blockStyle}>
        <div style={{ padding: '20px 20px 4px' }}>
          <div style={gridStyle(2)}>
            <Field label="機構" value={record.institution ?? ''} />
            <Field label="出款帳戶" value={record.payment_account ?? ''} />
          </div>
          <div style={gridStyle(2)}>
            <Field label="費用項目" value={record.expense_item ?? ''} />
            <Field label="項目 *" value={record.name} />
          </div>
          <div style={gridStyle(2)}>
            <Field label="金額 *" value={String(record.amount)} />
            <Field label="類別" value={record.category ?? ''} />
          </div>
        </div>
      </div>

      {/* Block 3：備註 */}
      <div style={blockStyle}>
        <div style={{ padding: '20px 20px 4px' }}>
          <div style={gridStyle(1)}>
            <Field label="備註" value={record.note ?? ''} textarea />
          </div>
        </div>
      </div>

      {/* 附件 */}
      {attachments && attachments.length > 0 && (() => {
        const bySlot = attachments.reduce<Record<string, FundAttachment[]>>((acc, a) => {
          if (!acc[a.slot_label]) acc[a.slot_label] = []
          acc[a.slot_label].push(a)
          return acc
        }, {})
        return (
          <div style={blockStyle}>
            <div style={{ padding: '10px 20px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)', borderRadius: '9px 9px 0 0' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>附件</span>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(bySlot).map(([label, items]) => (
                <div key={label}>
                  <label style={labelStyle}>{label}</label>
                  <AttachmentUpload
                    slotLabel={label}
                    attachments={items.map(a => ({ id: a.id, fileName: a.file_name, storagePath: a.storage_path, fileType: a.file_type, url: a.url ?? '', slotLabel: a.slot_label }))}
                    onAdd={() => {}}
                    onRemove={() => {}}
                    readOnly
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
