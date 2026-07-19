import { ApprovalRecord, ApprovedItem, FormBlock, FormSlot, TaxRateOption } from './types'
import { applyTaxFormula, roundTax } from './taxUtils'

// 逐項核准金額共用純函式（client/server 共用）：
// 資金分配審核的核准金額改為「逐組核准」——審核人只改各組的「核准費用」，
// 稅額依該組稅額選擇自動重算、手續費等其他數字欄照原值計入，總核准金額＝各組小計加總（不可手改）。
// 規格：docs/core-logic/優化第二批規格提案_2026-07-19.md 第一節

// 申請單付款明細一組的原始資料（自 extra_data.__group_ 解析，label 為 key）
export type AllocationGroupItem = {
  detail: string         // 費用項目（細項）
  summary: string        // 摘要/用途說明
  base: number           // 申請費用（稅基）
  otherFees: number      // 手續費等其他數字欄原值合計
  taxAmount: number      // 申請時存的稅額（無法重算時的退路值）
  taxSelectValue: string // 稅額選擇（驅動重算）
}

export type AllocationGroupInfo = {
  blockId: string
  detailLabel: string | null
  summaryLabel: string | null
  baseLabel: string          // 「費用」欄 label（核准費用欄的名稱來源）
  otherFeeLabels: string[]   // 其他數字欄 labels（手續費…）
  items: AllocationGroupItem[]
}

// 從資金分配表單 schema＋extra_data 解析付款明細各組（找不到群組區塊或無資料回傳 null，
// 呼叫端退回既有的單一核准金額模式）
export function getAllocationGroupItems(
  schema: FormBlock[],
  extraData: Record<string, string> | null
): AllocationGroupInfo | null {
  for (const block of schema) {
    const startIdx = block.rows.findIndex(r => r.rowGroupStart)
    if (startIdx === -1) continue
    const groupSlots = block.rows.slice(startIdx).flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
    const taxSelectSlot = groupSlots.find(s => s.dataSource === 'tax_rates' && s.taxConfig)
    if (!taxSelectSlot?.taxConfig) continue

    const raw = extraData?.[`__group_${block.id}`]
    if (!raw) return null
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { return null }
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const instances = parsed as Record<string, string>[]

    const { baseFieldId, totalFieldId, taxAmountFieldId } = taxSelectSlot.taxConfig
    const baseSlot = groupSlots.find(s => s.fieldId === baseFieldId)
    if (!baseSlot) return null
    const taxSlot = taxAmountFieldId ? groupSlots.find(s => s.fieldId === taxAmountFieldId) : undefined
    // 其他數字欄（手續費…）：金額三欄（費用/稅額/總額）以外的 number 欄，原值計入小計、不可改
    const otherFeeSlots = groupSlots.filter(s =>
      s.type === 'number' && s.fieldId !== baseFieldId && s.fieldId !== totalFieldId && s.fieldId !== taxAmountFieldId
    )
    // 費用項目（細項）＝群組內 label 含「費用項目」的 fee_records 欄位（與主細項連動同一約定）
    const detailSlot = groupSlots.find(s => s.dataSource?.startsWith('fee_records:') && s.label.includes('費用項目'))
    // 摘要欄：優先 label 含「摘要」，退回第一個文字欄
    const summarySlot =
      groupSlots.find(s => s.label.includes('摘要')) ??
      groupSlots.find(s => (s.type === 'text' || s.type === 'textarea') && s !== detailSlot)

    const num = (v: string | undefined) => {
      const n = parseFloat(v ?? '')
      return Number.isFinite(n) ? n : 0
    }
    return {
      blockId: block.id,
      detailLabel: detailSlot?.label ?? null,
      summaryLabel: summarySlot?.label ?? null,
      baseLabel: baseSlot.label,
      otherFeeLabels: otherFeeSlots.map(s => s.label),
      items: instances.map(inst => ({
        detail: detailSlot ? (inst[detailSlot.label] ?? '') : '',
        summary: summarySlot ? (inst[summarySlot.label] ?? '') : '',
        base: num(inst[baseSlot.label]),
        otherFees: otherFeeSlots.reduce((sum, s) => sum + num(inst[s.label]), 0),
        taxAmount: taxSlot ? num(inst[taxSlot.label]) : 0,
        taxSelectValue: inst[taxSelectSlot.label] ?? '',
      })),
    }
  }
  return null
}

// 依該組稅額選擇重算稅額（與填寫頁自動帶稅同一算法：floor(公式(費用))）；
// 稅額選擇為空或選項已被移除（無法重算）時退回 fallback（原稅額）
export function recomputeItemTax(
  base: number,
  taxSelectValue: string,
  taxRateOptions: TaxRateOption[],
  fallback: number
): number {
  const opt = taxRateOptions.find(o => o.label === taxSelectValue)
  if (!opt) return fallback
  return roundTax(applyTaxFormula(base, opt.formula_steps))
}

export function approvedItemSubtotal(it: ApprovedItem): number {
  return it.approved_base + it.other_fees + it.tax_amount
}

export function sumApprovedItems(items: ApprovedItem[]): number {
  return items.reduce((sum, it) => sum + approvedItemSubtotal(it), 0)
}

// 取歷史審核紀錄中「最新一關」的逐項核准明細（步驟最大的 approved 紀錄；無逐項資料回傳 null）
export function latestApprovedItems(pastRecords: ApprovalRecord[]): ApprovedItem[] | null {
  let best: ApprovalRecord | null = null
  for (const r of pastRecords) {
    if (r.decision !== 'approved' || !Array.isArray(r.approved_items) || r.approved_items.length === 0) continue
    if (!best || r.step_number > best.step_number) best = r
  }
  return best?.approved_items ?? null
}
