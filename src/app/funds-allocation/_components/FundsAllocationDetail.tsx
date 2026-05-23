import { FundsAllocation, FormBlock } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const readonlyCls = 'bg-[var(--bg-page)] cursor-default'

function getFieldValue(fieldId: string, record: FundsAllocation): string {
  const map: Record<string, unknown> = {
    serial_number: record.serial_number,
    date: record.date,
    apply_division: record.apply_division,
    apply_section: record.apply_section,
    applicant: record.applicant,
    apply_role: record.apply_role,
    institution: record.institution,
    payment_account: record.payment_account,
    expense_item: record.expense_item,
    name: record.name,
    amount: record.amount,
    category: record.category,
    note: record.note,
  }
  const val = map[fieldId]
  if (val == null || val === '') return ''
  return String(val)
}

export default function FundsAllocationDetail({
  record,
  schema,
}: {
  record: FundsAllocation
  schema: FormBlock[]
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>資金分配申請單</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        狀態：<strong>{record.status}</strong>
      </p>

      {schema.map(block => (
        <div key={block.id} style={{
          marginBottom: 16,
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          overflow: 'hidden',
          background: 'var(--bg-card)',
        }}>
          {block.title && (
            <div style={{
              padding: '10px 20px',
              background: 'var(--bg-sidebar)',
              borderBottom: '1px solid var(--border-color)',
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>{block.title}</span>
            </div>
          )}
          <div style={{ padding: '20px 20px 4px' }}>
            {block.rows.map(row => (
              <div key={row.id} style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${row.cols}, 1fr)`,
                gap: 20,
                marginBottom: 20,
              }}>
                {row.slots.map((slot, idx) => slot ? (
                  <div key={idx}>
                    <label style={labelStyle}>
                      {slot.label}
                      {slot.required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                    </label>
                    {slot.type === 'textarea' ? (
                      <Textarea
                        value={getFieldValue(slot.fieldId, record)}
                        readOnly
                        rows={4}
                        className={readonlyCls}
                      />
                    ) : slot.type === 'radio' ? (
                      <Input
                        value={getFieldValue(slot.fieldId, record)}
                        readOnly
                        className={readonlyCls}
                      />
                    ) : (
                      <Input
                        value={getFieldValue(slot.fieldId, record)}
                        readOnly
                        className={readonlyCls}
                      />
                    )}
                  </div>
                ) : <div key={idx} />)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
