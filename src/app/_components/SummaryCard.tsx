// 憑單頁面頂部的「母單對照卡片」外框：標題 ＋ 欄位列 ＋ 虛線 ＋ 金額列。
// 兩種卡片共用同一視覺，要改樣式改這裡一次連動：
//   - 付款憑單頁的「已核准資金分配申請單」（AllocationSummaryCard）
//   - 暫付款沖銷憑單頁的「預支的付款憑單」（funds-voucher/_components/PaymentSummaryCard）
export default function SummaryCard({
  title, fields, amounts,
}: {
  title: string
  fields: Array<[string, string]>
  amounts: React.ReactNode
}) {
  return (
    <div style={{
      marginBottom: 20, padding: '14px 20px', border: '1px solid var(--border-color)',
      borderRadius: 10, background: 'var(--bg-card)', fontSize: 13,
    }}>
      <div style={{ fontWeight: 600, color: 'var(--text-title)', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', gap: 24, rowGap: 8, flexWrap: 'wrap' }}>
        {fields.map(([label, value]) => (
          <span key={label} style={{ color: 'var(--text-muted)' }}>
            {label} <strong style={{ color: 'var(--text-body)', fontWeight: 500 }}>{value}</strong>
          </span>
        ))}
      </div>
      <div style={{
        display: 'flex', gap: 24, rowGap: 8, flexWrap: 'wrap', marginTop: 10, paddingTop: 10,
        borderTop: '1px dashed var(--border-color)',
      }}>
        {amounts}
      </div>
    </div>
  )
}

// 卡片下半部金額列的單項。danger：負數等異常值以紅字提示。
export function SummaryAmount({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <span style={{ color: 'var(--text-muted)' }}>
      {label} <strong style={{ color: danger ? '#be123c' : 'var(--text-body)' }}>{value}</strong>
    </span>
  )
}
