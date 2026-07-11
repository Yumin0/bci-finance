import { FundsPayment, FormBlock, FormSchemaRow, FormSlot } from '@/lib/types'
import { formatTaxNumber } from '@/lib/taxUtils'
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
  // 類型（一般/預支）存在結構化欄位，schema 中可能掛自訂 fieldId，以 label 回退
  if (slot.label === '類型' && record.category) return record.category
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

function getGroupRows(block: FormBlock): FormSchemaRow[] {
  const startIdx = block.rows.findIndex(r => r.rowGroupStart)
  if (startIdx === -1) return []
  return block.rows.slice(startIdx)
}

function parseGroupInstances(record: FundsPayment, blockId: string): Record<string, string>[] {
  // 優先讀本憑單的群組資料；沒有時退回申請單合併進來的 __group_ 資料（舊憑單相容）
  let raw = record.extra_data?.[`__group_${blockId}`]
  if (!raw) {
    const fallbackKey = Object.keys(record.extra_data ?? {}).find(k => k.startsWith('__group_'))
    if (fallbackKey) raw = record.extra_data![fallbackKey]
  }
  let instances: Record<string, string>[] = []
  try { instances = JSON.parse(raw ?? '[]') } catch { instances = [] }
  if (instances.length === 1 && !Object.keys(instances[0]).length) return []
  return instances
}

export default function FundsPaymentDetail({ record, schema }: { record: FundsPayment; schema: FormBlock[] }) {
  function renderGroupInstances(block: FormBlock) {
    const groupRows = getGroupRows(block)
    if (!groupRows.length) return null

    const instances = parseGroupInstances(record, block.id)
    if (!instances.length) return null

    const groupSlots = groupRows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
    const headers = groupSlots.map(s => s.label)

    return (
      <div style={{ marginBottom: 20, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {headers.map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 12px 6px 0', fontWeight: 500, color: 'var(--text-body)', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {instances.map((inst, i) => (
              <tr key={i}>
                {headers.map(h => (
                  <td key={h} style={{ padding: '8px 12px 8px 0', borderBottom: i < instances.length - 1 ? '1px solid var(--border-color)' : 'none', color: 'var(--text-body)' }}>
                    {inst[h] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function computeGroupSummary(block: FormBlock): { taxBase: number; handling: number; taxAmount: number; total: number } | null {
    const groupRows = getGroupRows(block)
    if (!groupRows.length) return null

    const instances = parseGroupInstances(record, block.id)
    if (!instances.length) return null

    const groupSlots = groupRows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
    const taxSelectSlot = groupSlots.find(s => s.dataSource === 'tax_rates' && s.taxConfig)
    if (!taxSelectSlot?.taxConfig) return null

    const { baseFieldId, taxAmountFieldId, totalFieldId } = taxSelectSlot.taxConfig
    const baseSlot = groupSlots.find(s => s.fieldId === baseFieldId)
    const taxAmtSlot = groupSlots.find(s => s.fieldId === taxAmountFieldId)
    const handlingSlots = groupSlots.filter(s =>
      s.type === 'number' &&
      s.fieldId !== baseFieldId &&
      (!taxAmountFieldId || s.fieldId !== taxAmountFieldId) &&
      s.fieldId !== totalFieldId
    )

    let totalBase = 0, totalHandling = 0, totalTax = 0
    for (const inst of instances) {
      totalBase += baseSlot ? (parseFloat(inst[baseSlot.label] ?? '0') || 0) : 0
      totalHandling += handlingSlots.reduce((acc, s) => acc + (parseFloat(inst[s.label] ?? '0') || 0), 0)
      totalTax += taxAmtSlot ? (parseFloat(inst[taxAmtSlot.label] ?? '0') || 0) : 0
    }

    return { taxBase: totalBase, handling: totalHandling, taxAmount: totalTax, total: totalBase + totalHandling + totalTax }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      {schema.map(block => {
        const groupRows = getGroupRows(block)
        const preGroupRows = block.rows.filter(r => !groupRows.includes(r))
        const groupSummary = computeGroupSummary(block)

        return (
          <div key={block.id} style={{
            marginBottom: 16,
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            overflow: 'hidden',
            background: 'var(--bg-card)',
          }}>
            {(block.title || groupSummary) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 20px',
                background: 'var(--bg-sidebar)',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>{block.title ?? ''}</span>
                {groupSummary && (
                  <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>費用 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(groupSummary.taxBase)}</strong></span>
                    <span style={{ color: 'var(--text-muted)' }}>手續費 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(groupSummary.handling)}</strong></span>
                    <span style={{ color: 'var(--text-muted)' }}>稅額 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(groupSummary.taxAmount)}</strong></span>
                    <span style={{ color: 'var(--text-muted)' }}>總額 <strong style={{ color: 'var(--text-body)' }}>{formatTaxNumber(groupSummary.total)}</strong></span>
                  </div>
                )}
              </div>
            )}
            <div style={{ padding: '20px 20px 4px' }}>
              {preGroupRows.map(row => (
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
              {renderGroupInstances(block)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
