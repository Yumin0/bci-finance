import type { FormBlock, FormSlot } from '@/lib/types'

// 送出前檢查：付款明細每列的金額欄必須大於 0。
// 檢查對象：有設定「總額欄位」（taxConfig.totalFieldId，付款憑單）時檢查總額，
// 否則檢查稅額計算基底欄位（taxConfig.baseFieldId，資金分配的「費用」）。
// 付款憑單的未稅金額/稅額可為 0（例如直接填總額 2298），故改以總額為必填正數判斷依據。
// 另外（缺口 6，2026-07-14）：有總額欄位時，總額不可小於「未稅金額＋稅額」的合計
// （剛好等於＝最常見的正常填法，放行；直接填總額、未稅稅額留 0 的用法不受影響）。
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
    const { baseFieldId, totalFieldId, taxAmountFieldId } = taxSelectSlot.taxConfig
    const checkFieldId = totalFieldId || baseFieldId
    const feeLabel = allSlots.find(s => s.fieldId === checkFieldId)?.label ?? '金額'
    const blockName = block.title ?? '付款明細'

    const num = (raw: string | undefined) => {
      const n = parseFloat(raw ?? '')
      return Number.isFinite(n) ? n : 0
    }
    const isPositive = (raw: string | undefined) => {
      const n = parseFloat(raw ?? '')
      return Number.isFinite(n) && n > 0
    }

    // 檢查一組（一列）的值，ordinal 為「第 N 組／列」的說明文字，通過回傳 null
    const checkValues = (values: Record<string, string>, ordinal: string): string | null => {
      if (!isPositive(values[checkFieldId])) {
        return `「${blockName}」${ordinal}的「${feeLabel}」必須大於 0 才能送出，請確認金額。`
      }
      // 總額不可小於未稅＋稅額（僅付款憑單這種有設定總額欄位的表單）
      if (totalFieldId) {
        const total = num(values[totalFieldId])
        const untaxedPlusTax = num(values[baseFieldId]) + num(values[taxAmountFieldId ?? ''])
        if (untaxedPlusTax > 0 && total < untaxedPlusTax) {
          return `「${blockName}」${ordinal}的「總額」（NT$${total.toLocaleString()}）不可低於未稅金額＋稅額的合計 NT$${untaxedPlusTax.toLocaleString()}，請確認金額有沒有填錯。`
        }
      }
      return null
    }

    const groupStartIdx = block.rows.findIndex(r => r.rowGroupStart)
    if (groupStartIdx !== -1) {
      const instances = groupInstances[block.id] ?? [{}]
      for (let i = 0; i < instances.length; i++) {
        const err = checkValues(instances[i], `第 ${i + 1} 組`)
        if (err) return err
      }
      continue
    }

    const feeRow = block.rows.find(r => r.repeatable && r.slots.some(s => s?.fieldId === checkFieldId))
    if (feeRow) {
      const instances = repeatableValues[feeRow.id] ?? [{}]
      for (let i = 0; i < instances.length; i++) {
        const err = checkValues(instances[i], `第 ${i + 1} 列`)
        if (err) return err
      }
      continue
    }

    const err = checkValues(fieldValues, '')
    if (err) return err
  }
  return null
}
