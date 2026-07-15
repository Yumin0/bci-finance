import { FundsPayment, FormBlock, FormSchemaRow, FormSlot } from '@/lib/types'
import { formatTaxNumber } from '@/lib/taxUtils'
import { DetailBlock, DetailSummaryItem, GroupDetailTable, ReadOnlyField, detailRowGridStyle } from '@/app/_components/RecordDetailView'

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
  // 結構化欄位但 schema 掛自訂 fieldId 的，以 label 回退（與草稿編輯頁 getRecordFieldValue 一致）
  const labelToColumn: Record<string, unknown> = {
    '類型': record.category,
    '日期': record.date,
    '申請日期': record.date,
    '職稱': record.apply_role,
  }
  const colFallback = labelToColumn[slot.label]
  if (colFallback != null && colFallback !== '') return String(colFallback)
  // Custom / extra fields stored by label
  if (record.extra_data) {
    const extra = record.extra_data[slot.label]
    if (extra != null && extra !== '') return extra
  }
  return '-'
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
    return <GroupDetailTable slots={groupSlots} instances={instances} />
  }

  // 付款憑單「總額」為純手動填寫、不自動加總，彙總總額＝各組「總額」欄位加總
  function computeGroupSummary(block: FormBlock): { taxBase: number; taxAmount: number; total: number } | null {
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
    const totalSlot = groupSlots.find(s => s.fieldId === totalFieldId)

    let totalBase = 0, totalTax = 0, totalAmount = 0
    for (const inst of instances) {
      totalBase += baseSlot ? (parseFloat(inst[baseSlot.label] ?? '0') || 0) : 0
      totalTax += taxAmtSlot ? (parseFloat(inst[taxAmtSlot.label] ?? '0') || 0) : 0
      totalAmount += totalSlot ? (parseFloat(inst[totalSlot.label] ?? '0') || 0) : 0
    }

    return { taxBase: totalBase, taxAmount: totalTax, total: totalAmount }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      {schema.map(block => {
        const groupRows = getGroupRows(block)
        const preGroupRows = block.rows.filter(r => !groupRows.includes(r))
        const groupSummary = computeGroupSummary(block)
        // 含群組/可重複列的區塊（付款明細）維持直式；其餘區塊橫式（標籤在左），與資金分配申請表單一致
        const verticalLayout = block.rows.some(r => r.repeatable || r.rowGroupStart)

        return (
          <DetailBlock
            key={block.id}
            title={block.title}
            summary={groupSummary && (
              <>
                <DetailSummaryItem label="未稅金額" value={formatTaxNumber(groupSummary.taxBase)} />
                <DetailSummaryItem label="稅額" value={formatTaxNumber(groupSummary.taxAmount)} />
                <DetailSummaryItem label="總額" value={formatTaxNumber(groupSummary.total)} />
              </>
            )}
          >
            {preGroupRows.map(row => (
              <div key={row.id} style={detailRowGridStyle(row.cols, !verticalLayout)}>
                {row.slots.map((slot, idx) => slot ? (
                  <ReadOnlyField key={idx} label={slot.label} value={getFieldValue(slot, record)} textarea={slot.type === 'textarea'} horizontal={!verticalLayout} />
                ) : <div key={idx} />)}
              </div>
            ))}
            {renderGroupInstances(block)}
          </DetailBlock>
        )
      })}
    </div>
  )
}
