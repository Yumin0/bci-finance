'use client'

import React from 'react'
import { FormSlot } from '@/lib/types'

// 群組明細（rowGroupStart 起的可重複組）的「可編輯」表格：表頭只印一次、每組一列、
// 行尾 ✕ 刪除、表格下方＋新增項目，對齊唯讀明細頁的 GroupDetailTable 與筑今系統排版，
// 讓多組明細的金額欄可以上下對照。
// 資金分配新增/編輯、付款憑單建立/草稿編輯、暫付款沖銷建立、表單設定範本分頁共用，
// 要改群組編輯排版改這裡一次連動。
//
// 欄位順序＝表單設定群組列的攤平順序（列欄配置對群組區塊而言只決定順序，不決定排版）。
// 欄寬依欄位型別自動配置：數字/日期窄、下拉中等、文字撐滿剩餘寬度；
// 總寬超過容器時區塊內橫向捲動（儲存格內的 SearchableSelect 需開 portal，否則下拉被捲動容器裁切）。
//
// 純渲染外殼：儲存格內容由呼叫端 renderCell 提供，
// 稅額公式自動帶入、總額唯讀加總、費用項目主細項連動等計算邏輯全部留在各頁。

const REMOVE_COL_WIDTH = 32
const FLEX_MIN_WIDTH = 140 // 無固定寬度欄（文字/textarea）計入 minWidth 的最小寬度（有餘裕時自動變寬）

// 估算一段文字的顯示寬度（14px 字級：全形字 ~14px、半形字 ~7.5px）
function estimateTextWidth(s: string): number {
  let w = 0
  for (const ch of s) w += ch.charCodeAt(0) > 255 ? 14 : 7.5
  return w
}

// 下拉欄寬依「最長選項」自動配置：選項短的欄（如稅額選擇）變窄、長的（如費用項目細項）加寬，
// 已選值才不會被截斷；56 = 輸入框左內距 14 + 右側清除鈕/箭頭區 36 + 緩衝
function selectWidthFor(optionLabels: string[] | undefined): number {
  if (!optionLabels?.length) return 200
  const longest = Math.max(...optionLabels.map(estimateTextWidth))
  return Math.round(Math.min(280, Math.max(140, longest + 56)))
}

// 欄寬抓「資金分配付款明細在 13～14 吋筆電（側欄展開）不用橫向捲動」為基準；
// 空間有餘時文字欄（摘要）自動吃掉剩餘寬度，數字/日期/下拉維持固定欄寬
function fixedWidthFor(
  slot: NonNullable<FormSlot>,
  selectOptionLabels?: (slot: NonNullable<FormSlot>) => string[] | undefined,
): number | undefined {
  switch (slot.type) {
    case 'number': return 95
    case 'date': return 130
    case 'select':
    case 'radio': return selectWidthFor(selectOptionLabels?.(slot))
    default: return undefined // 文字欄吃剩餘寬度
  }
}

export default function GroupEditTable({
  slots,
  instances,
  renderCell,
  onAdd,
  onRemove,
  addLabel = '＋ 新增項目',
  selectOptionLabels,
}: {
  slots: NonNullable<FormSlot>[]
  instances: Record<string, string>[]
  renderCell: (slot: NonNullable<FormSlot>, instValues: Record<string, string>, instIdx: number) => React.ReactNode
  onAdd?: () => void // 未提供＝不可新增（唯讀情境）
  onRemove?: (instIdx: number) => void // 未提供＝不顯示刪除欄（唯讀情境）
  addLabel?: string
  /** 回傳某下拉欄的全部選項文字，供依最長選項自動配置欄寬；未提供時下拉欄用預設寬 200 */
  selectOptionLabels?: (slot: NonNullable<FormSlot>) => string[] | undefined
}) {
  const removable = !!onRemove
  // table-layout: fixed 搭配明確 minWidth：窄螢幕時讓表格溢出、外層橫向捲動，而不是把文字欄壓扁
  const minTableWidth =
    slots.reduce((sum, s) => sum + (fixedWidthFor(s, selectOptionLabels) ?? FLEX_MIN_WIDTH), 0) + (removable ? REMOVE_COL_WIDTH : 0)

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: minTableWidth, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
          <colgroup>
            {slots.map((s, i) => {
              const w = fixedWidthFor(s, selectOptionLabels)
              return <col key={i} style={w ? { width: w } : undefined} />
            })}
            {removable && <col style={{ width: REMOVE_COL_WIDTH }} />}
          </colgroup>
          <thead>
            <tr>
              {slots.map((s, i) => (
                <th key={i} style={{
                  textAlign: 'left', padding: '0 12px 8px 0', fontSize: 13, fontWeight: 500,
                  color: 'var(--text-body)', borderBottom: '1px solid var(--border-color)', verticalAlign: 'bottom',
                }}>
                  {s.label}
                  {s.required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                  {s.hint?.trim() && (
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'pre-line' }}>{s.hint}</div>
                  )}
                </th>
              ))}
              {removable && <th style={{ borderBottom: '1px solid var(--border-color)' }} />}
            </tr>
          </thead>
          <tbody>
            {instances.map((inst, instIdx) => {
              const rowBorder = instIdx < instances.length - 1 ? '1px dashed var(--border-color)' : 'none'
              return (
                <tr key={instIdx}>
                  {slots.map((s, i) => (
                    <td key={i} style={{ padding: '10px 12px 10px 0', verticalAlign: 'middle', borderBottom: rowBorder }}>
                      {renderCell(s, inst, instIdx)}
                    </td>
                  ))}
                  {removable && (
                    <td style={{ verticalAlign: 'middle', textAlign: 'center', borderBottom: rowBorder }}>
                      {instances.length > 1 && (
                        <button type="button" onClick={() => onRemove!(instIdx)} title="刪除此項"
                          style={{ width: 28, height: 28, border: 'none', borderRadius: 6, background: 'none', color: '#dc2626', fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>
                          ✕
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {onAdd && (
        <button type="button" onClick={onAdd}
          style={{ padding: '6px 14px', fontSize: 13, border: '1.5px dashed #d1d5db',
            borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: 12 }}>
          {addLabel}
        </button>
      )}
    </div>
  )
}
