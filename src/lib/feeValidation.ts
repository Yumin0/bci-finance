import type { FormBlock, FormSlot } from '@/lib/types'

// 送出前檢查：付款明細每列的金額欄必須大於 0。
// 檢查對象：有設定「總額欄位」（taxConfig.totalFieldId，付款憑單）時檢查總額，
// 否則檢查稅額計算基底欄位（taxConfig.baseFieldId，資金分配的「費用」）。
// 付款憑單的未稅金額/稅額可為 0（例如直接填總額 2298），故改以總額為必填正數判斷依據。
// 金額欄可能存在三種位置：群組明細（__group_）、可重複列（__repeatable_）、固定欄位，
// 依區塊結構逐一檢查；區塊沒有稅額選擇設定（認不出金額欄）時跳過不檢查。
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
    const { baseFieldId, totalFieldId } = taxSelectSlot.taxConfig
    const checkFieldId = totalFieldId || baseFieldId
    const feeLabel = allSlots.find(s => s.fieldId === checkFieldId)?.label ?? '金額'
    const blockName = block.title ?? '付款明細'

    const isPositive = (raw: string | undefined) => {
      const n = parseFloat(raw ?? '')
      return Number.isFinite(n) && n > 0
    }

    const groupStartIdx = block.rows.findIndex(r => r.rowGroupStart)
    if (groupStartIdx !== -1) {
      const instances = groupInstances[block.id] ?? [{}]
      for (let i = 0; i < instances.length; i++) {
        if (!isPositive(instances[i][checkFieldId])) {
          return `「${blockName}」第 ${i + 1} 組的「${feeLabel}」必須大於 0 才能送出，請確認金額。`
        }
      }
      continue
    }

    const feeRow = block.rows.find(r => r.repeatable && r.slots.some(s => s?.fieldId === checkFieldId))
    if (feeRow) {
      const instances = repeatableValues[feeRow.id] ?? [{}]
      for (let i = 0; i < instances.length; i++) {
        if (!isPositive(instances[i][checkFieldId])) {
          return `「${blockName}」第 ${i + 1} 列的「${feeLabel}」必須大於 0 才能送出，請確認金額。`
        }
      }
      continue
    }

    if (!isPositive(fieldValues[checkFieldId])) {
      return `「${feeLabel}」必須大於 0 才能送出，請確認金額。`
    }
  }
  return null
}
