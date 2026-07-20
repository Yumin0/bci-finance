// 付款明細群組欄位的 showWhen 條件顯示判斷（client/server 共用純函式）。
// 觸發欄位是申請單頂層欄位（如「單據種類」），值不在 showWhen.values 內時整欄隱藏；
// 隱藏欄位在彙總計算與存檔一律視為 0／空值（Q6：單據種類＝國內公司時不顯示 手續費/稅額選擇/稅額）。
import type { FormSlot } from './types'

type Slot = NonNullable<FormSlot>

export function isGroupSlotHidden(slot: Slot, resolveValue: (fieldId: string) => string): boolean {
  if (!slot.showWhen) return false
  return !slot.showWhen.values.includes(resolveValue(slot.showWhen.fieldId))
}

export function visibleGroupSlots(slots: Slot[], resolveValue: (fieldId: string) => string): Slot[] {
  return slots.filter(s => !isGroupSlotHidden(s, resolveValue))
}
