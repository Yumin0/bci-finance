import { FormBlock, FundAttachment } from '@/lib/types'

// 附件欄位（form_slots type='attachment'）與 fund_attachments.slot_label 的對應規則，
// 資金分配 / 付款憑單 / 暫付款沖銷三個模組的填寫頁與明細頁共用。

export function allSlotsOf(schema: FormBlock[]) {
  return schema.flatMap(b => b.rows.flatMap(r => r.slots)).filter(s => s !== null)
}

export function attachmentSlotLabels(schema: FormBlock[]): Set<string> {
  return new Set(allSlotsOf(schema).filter(s => s!.type === 'attachment').map(s => s!.label))
}

// 上游單據的附件帶入的位置＝表單第一個附件欄位（要換位置就在表單設定調欄位順序）
export function firstAttachmentSlotLabel(schema: FormBlock[]): string | null {
  const first = allSlotsOf(schema).find(s => s!.type === 'attachment')
  return first ? first!.label : null
}

// 某個附件欄位要顯示哪些附件。
// slot_label 對得上的照常歸位；對不上的（例如舊付款憑單寫死的 'payment'、或表單事後改過欄位名稱）
// 一律收進第一個附件欄位——否則檔案還在資料庫、畫面上卻整個消失。
export function attachmentsForSlot(
  schema: FormBlock[],
  attachments: FundAttachment[],
  slotLabel: string
): FundAttachment[] {
  const known = attachmentSlotLabels(schema)
  const isFirst = slotLabel === firstAttachmentSlotLabel(schema)
  return attachments.filter(a => a.slot_label === slotLabel || (isFirst && !known.has(a.slot_label)))
}
