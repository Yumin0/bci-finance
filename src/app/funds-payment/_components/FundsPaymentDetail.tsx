import { FundsPayment, FormBlock, FormSlot } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const readonlyCls = 'bg-[var(--bg-page)] cursor-default'

function getFieldValue(slot: NonNullable<FormSlot>, record: FundsPayment): string {
  const map: Record<string, unknown> = {
    purchase_order_number: record.purchase_order_number,
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
    payment_method: record.payment_method,
  }
  const val = map[slot.fieldId]
  if (val != null && val !== '') return String(val)
  // Custom / extra fields stored by label
  if (record.extra_data) {
    const extra = record.extra_data[slot.label]
    if (extra != null && extra !== '') return extra
  }
  return '-'
}

function renderSlot(slot: NonNullable<FormSlot>, record: FundsPayment) {
  const value = getFieldValue(slot, record)
  if (slot.type === 'textarea') {
    return <Textarea value={value} readOnly rows={4} className={readonlyCls} />
  }
  return <Input value={value} readOnly className={readonlyCls} />
}

export default function FundsPaymentDetail({ record, schema }: { record: FundsPayment; schema: FormBlock[] }) {
  return (
    <div style={{ marginBottom: 32 }}>
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
                    <label style={labelStyle}>{slot.label}</label>
                    {renderSlot(slot, record)}
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
