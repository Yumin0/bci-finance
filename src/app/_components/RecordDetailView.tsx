import React from 'react'
import { FormSlot, FundAttachment } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import AttachmentUpload, { AttachmentItem } from '@/app/_components/AttachmentUpload'

// 三個明細頁（資金分配 / 付款憑單 / 暫付款沖銷）共用的唯讀顯示樣式與元件。
// 改動這裡的顏色 / 間距 / 邊框，三個模組會一起連動。

export const detailLabelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
export const detailReadonlyCls = 'bg-[var(--bg-page)] cursor-default'
export const detailBlockStyle: React.CSSProperties = { marginBottom: 16, border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)' }

// 欄位說明小字（form_slots.hint）：顯示在填寫頁欄位內容上方，純提示。
// 附件欄位用來列出該階段常見應附單據，讓職員知道要傳什麼、缺什麼。唯讀明細頁不顯示。
export function FieldHint({ hint }: { hint?: string }) {
  if (!hint?.trim()) return null
  return (
    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 6px', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
      {hint}
    </p>
  )
}

// 欄位版面：horizontal＝標籤在左（固定寬）、內容在右填滿；否則標籤在上、內容在下。
// 與資金分配申請表單同一規則（無群組區塊＝橫式、有群組區塊＝直式），children 可放輸入框或附件等。
export function DetailFieldLayout({ label, required, horizontal, hint, children }: { label: string; required?: boolean; horizontal?: boolean; hint?: string; children: React.ReactNode }) {
  const labelNode = (
    <label style={horizontal ? { ...detailLabelStyle, marginBottom: 0, width: 140, flexShrink: 0 } : detailLabelStyle}>
      {label}{required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
    </label>
  )
  // 有說明小字時，橫式欄位改為頂端對齊：小字會把內容撐高，垂直置中會讓標籤浮在中間對不上輸入框
  const hasHint = !!hint?.trim()
  return horizontal ? (
    <div style={{ display: 'flex', alignItems: hasHint ? 'flex-start' : 'center', gap: 16 }}>
      {hasHint ? <div style={{ width: 140, flexShrink: 0, paddingTop: 8 }}>{labelNode}</div> : labelNode}
      <div style={{ flex: 1, minWidth: 0 }}><FieldHint hint={hint} />{children}</div>
    </div>
  ) : (
    <div>{labelNode}<FieldHint hint={hint} />{children}</div>
  )
}

// 唯讀附件欄位：標籤 + 該欄位的附件（可預覽、不可增刪）。
// lockedItems 放上游單據帶入的附件（例：付款憑單顯示資金分配申請單的附件）；
// 每個帶入附件可自帶 tag 標示來源（同一格混多層來源時用，如「來自申請單」＋「來自付款憑單」）。
// 三個明細/審核頁共用，確保審核人在任何一頁都看得到職員上傳的單據。
export type TaggedAttachment = FundAttachment & { tag?: string }

export function DetailAttachmentField({
  label, horizontal, attachments, lockedItems, lockedTag,
}: {
  label: string
  horizontal?: boolean
  attachments: FundAttachment[]
  lockedItems?: TaggedAttachment[]
  lockedTag?: string
}) {
  const toItem = (a: TaggedAttachment): AttachmentItem => ({
    id: a.id, fileName: a.file_name, storagePath: a.storage_path,
    fileType: a.file_type, url: a.url ?? '', slotLabel: a.slot_label, tag: a.tag,
  })
  const items = attachments.map(toItem)
  const locked = (lockedItems ?? []).map(toItem)
  return (
    <DetailFieldLayout label={label} horizontal={horizontal}>
      {items.length === 0 && locked.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, padding: '8px 0' }}>—</p>
      ) : (
        <AttachmentUpload
          slotLabel={label}
          attachments={items}
          lockedItems={locked.length ? locked : undefined}
          lockedTag={lockedTag}
          onAdd={() => {}}
          onRemove={() => {}}
          readOnly
        />
      )}
    </DetailFieldLayout>
  )
}

// 單一唯讀欄位：標籤 + 唯讀輸入框（或多行）
export function ReadOnlyField({ label, value, required, textarea, horizontal }: { label: string; value: string; required?: boolean; textarea?: boolean; horizontal?: boolean }) {
  return (
    <DetailFieldLayout label={label} required={required} horizontal={horizontal}>
      {textarea
        ? <Textarea value={value} readOnly rows={4} className={detailReadonlyCls} />
        : <Input value={value} readOnly className={detailReadonlyCls} />}
    </DetailFieldLayout>
  )
}

// 欄位列的 grid 樣式：橫式欄位用較寬 columnGap（對齊資金分配表單），直式用一般 gap。
export function detailRowGridStyle(cols: number, horizontal: boolean): React.CSSProperties {
  return horizontal
    ? { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, columnGap: 48, rowGap: 20, marginBottom: 32 }
    : { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 20, marginBottom: 20 }
}

// 區塊卡片：外框 + 標頭列（左標題、右彙總），children 為內容區
export function DetailBlock({ title, summary, children }: { title?: string | null; summary?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={detailBlockStyle}>
      {(title || summary) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)', borderRadius: '9px 9px 0 0' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>{title ?? ''}</span>
          {summary && <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>{summary}</div>}
        </div>
      )}
      <div style={{ padding: '20px 20px 4px' }}>{children}</div>
    </div>
  )
}

// 標頭彙總的單項：例如「總額 100」
// danger：金額異常時以紅字顯示（例如沖銷回存金額為負＝填超過預支金額）。
// 紅色與 SummaryCard 的 SummaryAmount 一致（#be123c，金額負數的既有慣例）——
// 同一頁的卡片與明細標頭會同時顯示同一個數字，兩處顏色必須相同。
export function DetailSummaryItem({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return <span style={{ color: 'var(--text-muted)' }}>{label} <strong style={{ color: danger ? '#be123c' : 'var(--text-body)' }}>{value}</strong></span>
}

// 群組 / 明細表格：欄＝群組欄位 label、列＝各組資料，空值以「—」呈現。
// 資金分配、付款憑單、暫付款沖銷三個明細頁共用同一表格樣式。
export function GroupDetailTable({ slots, instances }: { slots: NonNullable<FormSlot>[]; instances: Record<string, string>[] }) {
  const headers = slots.map(s => s.label)
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
