import { TaxFormulaStep, TaxRateOption, FormBlock, FormSlot } from './types'

export function applyTaxFormula(base: number, steps: TaxFormulaStep[]): number {
  let result = base
  for (const step of steps) {
    switch (step.op) {
      case '+': result += step.value; break
      case '-': result -= step.value; break
      case '*': result *= step.value; break
      case '/': result = step.value !== 0 ? result / step.value : 0; break
    }
  }
  return result
}

export type BlockTaxInfo = {
  taxSelectFieldId: string
  baseFieldId: string
  totalFieldId: string
  taxAmountFieldId?: string
  taxBase: number
  taxAmount: number
  total: number
}

export function computeBlockTax(
  block: FormBlock,
  fieldValues: Record<string, string>,
  taxRateOptions: TaxRateOption[]
): BlockTaxInfo | null {
  const allSlots = block.rows.flatMap(r => r.slots).filter(Boolean) as NonNullable<FormSlot>[]
  const taxSelectSlot = allSlots.find(s => s.dataSource === 'tax_rates' && s.taxConfig)
  if (!taxSelectSlot?.taxConfig) return null
  const { baseFieldId, totalFieldId } = taxSelectSlot.taxConfig
  const taxBase = parseFloat(fieldValues[baseFieldId] ?? '0') || 0
  const selectedLabel = fieldValues[taxSelectSlot.fieldId] ?? ''
  const selectedOption = taxRateOptions.find(o => o.label === selectedLabel)
  const taxAmount = selectedOption ? applyTaxFormula(taxBase, selectedOption.formula_steps) : 0
  const { taxAmountFieldId } = taxSelectSlot.taxConfig
  const otherNumbers = allSlots.filter(s =>
    s.type === 'number' &&
    s.fieldId !== totalFieldId &&
    (!taxAmountFieldId || s.fieldId !== taxAmountFieldId)
  )
  const numbersSum = otherNumbers.reduce((sum, s) => sum + (parseFloat(fieldValues[s.fieldId] ?? '0') || 0), 0)
  return {
    taxSelectFieldId: taxSelectSlot.fieldId,
    baseFieldId,
    totalFieldId,
    taxAmountFieldId,
    taxBase,
    taxAmount,
    total: numbersSum + taxAmount,
  }
}

export function formulaSummary(steps: TaxFormulaStep[]): string {
  if (!steps.length) return '（無步驟）'
  const OP_DISPLAY: Record<string, string> = { '+': '＋', '-': '－', '*': '×', '/': '÷' }
  return steps.map(s => `${OP_DISPLAY[s.op] ?? s.op}${s.value}`).join(' ')
}

export function roundTax(n: number): number {
  return Math.floor(n)
}

export function formatTaxNumber(n: number): string {
  const rounded = roundTax(n)
  return rounded.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
