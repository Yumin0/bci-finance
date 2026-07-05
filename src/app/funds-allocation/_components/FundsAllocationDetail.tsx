import { FundsAllocation, FundAttachment, FormBlock, FormSlot, FormSchemaRow } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { type StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import AttachmentUpload from '@/app/_components/AttachmentUpload'
import { formatTaxNumber } from '@/lib/taxUtils'

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const readonlyCls = 'bg-[var(--bg-page)] cursor-default'
const blockStyle: React.CSSProperties = { marginBottom: 16, border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)' }

function ReadField({ label, value, textarea, required }: { label: string; value: string; textarea?: boolean; required?: boolean }) {
  return (
    <div>
      <label style={labelStyle}>{label}{required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}</label>
      {textarea
        ? <Textarea value={value} readOnly rows={4} className={readonlyCls} />
        : <Input value={value} readOnly className={readonlyCls} />}
    </div>
  )
}

function getColumnValue(fieldId: string, dataSource: string | undefined, record: FundsAllocation): string | null {
  switch (fieldId) {
    case 'serial_number': return record.serial_number ?? ''
    case 'applicant': return record.applicant ?? ''
    case 'apply_division': return record.apply_division ?? ''
    case 'apply_section': return record.apply_section ?? ''
    case 'apply_role': return record.apply_role ?? ''
    case 'date': return record.date ?? ''
    case 'institution': return record.institution ?? ''
    case 'payment_account': return record.payment_account ?? ''
    case 'expense_item': return record.expense_item ?? ''
    case 'name': return record.name ?? ''
    case 'amount': return String(record.amount ?? 0)
    case 'category': return record.category ?? ''
    case 'note': return record.note ?? ''
    default:
      if (dataSource === 'current_user_name') return record.applicant ?? ''
      return null
  }
}

function getSlotValue(slot: NonNullable<FormSlot>, record: FundsAllocation): string {
  const col = getColumnValue(slot.fieldId, slot.dataSource, record)
  if (col !== null) return col
  return record.extra_data?.[slot.label] ?? ''
}

function getGroupRows(block: FormBlock): FormSchemaRow[] {
  const startIdx = block.rows.findIndex(r => r.rowGroupStart)
  if (startIdx === -1) return []
  return block.rows.slice(startIdx)
}

export default function FundsAllocationDetail({
  record,
  labelConfig,
  stepName,
  attachments,
  schema,
}: {
  record: FundsAllocation
  labelConfig?: StatusLabelConfig
  stepName?: string | null
  attachments?: FundAttachment[]
  schema?: FormBlock[]
}) {
  const attachmentsBySlot = (attachments ?? []).reduce<Record<string, FundAttachment[]>>((acc, a) => {
    if (!acc[a.slot_label]) acc[a.slot_label] = []
    acc[a.slot_label].push(a)
    return acc
  }, {})

  const header = (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>資金分配申請單</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
        <span>狀態：</span>
        {labelConfig
          ? <StatusBadge module="funds_allocation" status={record.status} stepName={stepName} labelConfig={labelConfig} />
          : <strong>{record.status}</strong>}
      </div>
    </div>
  )

  if (!schema || schema.length === 0) {
    return <div style={{ marginBottom: 32 }}>{header}{renderLegacy(record, attachmentsBySlot)}</div>
  }

  function renderRepeatableRow(row: FormSchemaRow) {
    let instances: Record<string, string>[] = []
    try { instances = JSON.parse(record.extra_data?.[`__repeatable_${row.id}`] ?? '[]') } catch { instances = [] }
    if (!instances.length) return null
    const slots = row.slots.filter(Boolean) as NonNullable<FormSlot>[]
    return (
      <div style={{ marginBottom: 20, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {slots.map(s => (
                <th key={s.fieldId} style={{ textAlign: 'left', padding: '6px 12px 6px 0', fontWeight: 500, color: 'var(--text-body)', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {instances.map((inst, i) => (
              <tr key={i}>
                {slots.map(s => (
                  <td key={s.fieldId} style={{ padding: '8px 12px 8px 0', borderBottom: i < instances.length - 1 ? '1px solid var(--border-color)' : 'none', color: 'var(--text-body)' }}>
                    {inst[s.label] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function renderGroupInstances(block: FormBlock) {
    const groupRows = getGroupRows(block)
    if (!groupRows.length) return null

    let instances: Record<string, string>[] = []
    try { instances = JSON.parse(record.extra_data?.[`__group_${block.id}`] ?? '[]') } catch { instances = [] }
    if (!instances.length || (instances.length === 1 && !Object.keys(instances[0]).length)) return null

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

    let instances: Record<string, string>[] = []
    try { instances = JSON.parse(record.extra_data?.[`__group_${block.id}`] ?? '[]') } catch { instances = [] }
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

  const schemaBlocks = schema.filter(block => {
    if (!block.showWhen) return true
    const controlSlot = schema.flatMap(b => b.rows.flatMap(r => r.slots)).find(s => s?.fieldId === block.showWhen!.fieldId)
    const controlVal = controlSlot ? getSlotValue(controlSlot, record) : ''
    return controlVal === block.showWhen.value
  })

  return (
    <div style={{ marginBottom: 32 }}>
      {header}

      {schemaBlocks.map(block => {
        const groupRows = getGroupRows(block)
        const preGroupRows = block.rows.filter(r => !groupRows.includes(r))
        const groupSummary = computeGroupSummary(block)

        return (
          <div key={block.id} style={blockStyle}>
            {(block.title || groupSummary) && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--border-color)', borderRadius: '9px 9px 0 0', background: 'var(--bg-sidebar)' }}>
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

            <div style={{ paddingTop: 20, paddingLeft: 20, paddingBottom: 4, paddingRight: 20 }}>
              {preGroupRows.map(row => {
                if (row.repeatable) return <div key={row.id}>{renderRepeatableRow(row)}</div>

                return (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: `repeat(${row.cols}, 1fr)`, gap: 20, marginBottom: 20 }}>
                    {row.slots.map((slot, idx) => {
                      if (!slot) return <div key={idx} />

                      if (slot.showWhen) {
                        const controlSlot = schema.flatMap(b => b.rows.flatMap(r => r.slots)).find(s => s?.fieldId === slot.showWhen!.fieldId)
                        const controlVal = controlSlot ? getSlotValue(controlSlot, record) : ''
                        if (!slot.showWhen.values.includes(controlVal)) return <div key={idx} />
                      }

                      if (slot.type === 'attachment') {
                        const items = attachmentsBySlot[slot.label] ?? []
                        if (!items.length) return <div key={idx} />
                        return (
                          <div key={idx}>
                            <label style={labelStyle}>{slot.label}</label>
                            <AttachmentUpload
                              slotLabel={slot.label}
                              attachments={items.map(a => ({ id: a.id, fileName: a.file_name, storagePath: a.storage_path, fileType: a.file_type, url: a.url ?? '', slotLabel: a.slot_label }))}
                              onAdd={() => {}} onRemove={() => {}}
                              readOnly
                            />
                          </div>
                        )
                      }

                      return (
                        <ReadField
                          key={idx}
                          label={slot.label}
                          value={getSlotValue(slot, record)}
                          required={slot.required}
                          textarea={slot.type === 'textarea'}
                        />
                      )
                    })}
                  </div>
                )
              })}

              {renderGroupInstances(block)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function renderLegacy(record: FundsAllocation, attachmentsBySlot: Record<string, FundAttachment[]>) {
  const gridStyle = (cols: number): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 20, marginBottom: 20 })
  const readonlyCls = 'bg-[var(--bg-page)] cursor-default'

  function Field({ label, value, textarea }: { label: string; value: string; textarea?: boolean }) {
    return (
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }}>{label}</label>
        {textarea
          ? <Textarea value={value} readOnly rows={4} className={readonlyCls} />
          : <Input value={value} readOnly className={readonlyCls} />}
      </div>
    )
  }

  return (
    <>
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
      <div style={blockStyle}>
        <div style={{ padding: '20px 20px 4px' }}>
          <div style={gridStyle(2)}>
            <Field label="機構" value={record.institution ?? ''} />
            <Field label="出款帳戶" value={record.payment_account ?? ''} />
          </div>
          <div style={gridStyle(2)}>
            <Field label="費用項目" value={record.expense_item ?? ''} />
            <Field label="項目 *" value={record.name ?? ''} />
          </div>
          <div style={gridStyle(2)}>
            <Field label="金額 *" value={String(record.amount)} />
            <Field label="類別" value={record.category ?? ''} />
          </div>
        </div>
      </div>
      <div style={blockStyle}>
        <div style={{ padding: '20px 20px 4px' }}>
          <div style={gridStyle(1)}>
            <Field label="備註" value={record.note ?? ''} textarea />
          </div>
        </div>
      </div>
      {(() => {
        const extraData = record.extra_data ?? {}
        const repeatableEntries = Object.entries(extraData).filter(([k]) => k.startsWith('__repeatable_'))
        if (!repeatableEntries.length) return null
        return repeatableEntries.map(([key, raw]) => {
          let rows: Record<string, string>[] = []
          try { rows = JSON.parse(raw) } catch { return null }
          if (!rows.length) return null
          const headers = Object.keys(rows[0])
          return (
            <div key={key} style={blockStyle}>
              <div style={{ padding: '10px 20px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)', borderRadius: '9px 9px 0 0' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>明細項目</span>
              </div>
              <div style={{ padding: '0 20px 4px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 12 }}>
                  <thead>
                    <tr>{headers.map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 12px 6px 0', fontWeight: 500, color: 'var(--text-body)', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i}>
                        {headers.map(h => <td key={h} style={{ padding: '8px 12px 8px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--border-color)' : 'none', color: 'var(--text-body)' }}>{row[h] || '—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      })()}
      {Object.keys(attachmentsBySlot).length > 0 && (
        <div style={blockStyle}>
          <div style={{ padding: '10px 20px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)', borderRadius: '9px 9px 0 0' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>附件</span>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(attachmentsBySlot).map(([label, items]) => (
              <div key={label}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }}>{label}</label>
                <AttachmentUpload
                  slotLabel={label}
                  attachments={items.map(a => ({ id: a.id, fileName: a.file_name, storagePath: a.storage_path, fileType: a.file_type, url: a.url ?? '', slotLabel: a.slot_label }))}
                  onAdd={() => {}} onRemove={() => {}}
                  readOnly
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
