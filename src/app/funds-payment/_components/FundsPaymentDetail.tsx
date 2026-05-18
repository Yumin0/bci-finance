import { FundsPayment } from '@/lib/types'

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const readonlyStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--btn-border)', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', background: 'var(--bg-page)', cursor: 'default' }
const textareaReadonlyStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--btn-border)', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', background: 'var(--bg-page)', cursor: 'default', resize: 'vertical' }

export default function FundsPaymentDetail({ record }: { record: FundsPayment }) {
  return (
    <div style={{ maxWidth: 480, marginBottom: 32 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>付款憑單</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>狀態：<strong>{record.status}</strong></p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>日期</label>
          <input value={record.date} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>申請處別</label>
          <input value={record.apply_division ?? ''} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>申請課別</label>
          <input value={record.apply_section ?? ''} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>申請人</label>
          <input value={record.applicant ?? ''} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>職稱</label>
          <input value={record.apply_role ?? ''} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>機構</label>
          <input value={record.institution ?? ''} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>出款帳戶</label>
          <input value={record.payment_account ?? ''} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>費用項目</label>
          <input value={record.expense_item ?? ''} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>項目</label>
          <input value={record.name} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>金額</label>
          <input value={record.amount} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>類別</label>
          <input value={record.category ?? ''} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>備註</label>
          <textarea value={record.note ?? ''} readOnly rows={4} style={textareaReadonlyStyle} />
        </div>
        <div>
          <label style={labelStyle}>付款方式</label>
          <input value={record.payment_method ?? ''} readOnly style={readonlyStyle} />
        </div>
      </div>
    </div>
  )
}
