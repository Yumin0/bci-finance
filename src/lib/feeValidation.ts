import type { FormBlock, FormSlot } from '@/lib/types'

// 送出前檢查：付款明細的「費用」（稅額計算的基底欄位，taxConfig.baseFieldId）必須大於 0。
// 費用欄位可能存在三種位置：群組明細（__group_）、可重複列（__repeatable_）、固定欄位，
// 依區塊結構逐一檢查；區塊沒有稅額選擇設定（認不出費用欄位）時跳過不檢查。
// 回傳錯誤訊息字串，全部通過回傳 null。
export function validateFeePositive(
  schema: FormBlock[],
  fieldValues: Record<string, string>,
  repeatableValues: Record<string, Record<string, string>[]>,
  groupInstances: Record<string, Record<string, string>[]>,
): string | null {
  for (const block of schema) {
    if (block.showWhen && fieldValues[block.showWhen.fieldId] !== block.showWhen.value) continue
    const allSlots = block.rows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
    const taxSelectSlot = allSlots.find(s => s.dataSource === 'tax_rates' && s.taxConfig)
    if (!taxSelectSlot?.taxConfig) continue
    const { baseFieldId } = taxSelectSlot.taxConfig
    const feeLabel = allSlots.find(s => s.fieldId === baseFieldId)?.label ?? '費用'
    const blockName = block.title ?? '付款明細'

    const isPositive = (raw: string | undefined) => {
      const n = parseFloat(raw ?? '')
      return Number.isFinite(n) && n > 0
    }

    const groupStartIdx = block.rows.findIndex(r => r.rowGroupStart)
    if (groupStartIdx !== -1) {
      const instances = groupInstances[block.id] ?? [{}]
      for (let i = 0; i < instances.length; i++) {
        if (!isPositive(instances[i][baseFieldId])) {
          return `「${blockName}」第 ${i + 1} 組的「${feeLabel}」必須大於 0 才能送出，請確認金額。`
        }
      }
      continue
    }

    const feeRow = block.rows.find(r => r.repeatable && r.slots.some(s => s?.fieldId === baseFieldId))
    if (feeRow) {
      const instances = repeatableValues[feeRow.id] ?? [{}]
      for (let i = 0; i < instances.length; i++) {
        if (!isPositive(instances[i][baseFieldId])) {
          return `「${blockName}」第 ${i + 1} 列的「${feeLabel}」必須大於 0 才能送出，請確認金額。`
        }
      }
      continue
    }

    if (!isPositive(fieldValues[baseFieldId])) {
      return `「${feeLabel}」必須大於 0 才能送出，請確認金額。`
    }
  }
  return null
}
