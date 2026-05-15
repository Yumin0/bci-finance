export default function ReportIssuePage() {
  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>提交問題回報</h1>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
            問題類型
          </label>
          <select
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 14, color: '#374151', background: '#fff' }}
          >
            <option value="">請選擇問題類型</option>
            <option value="bug">系統錯誤 / Bug</option>
            <option value="feature">功能建議</option>
            <option value="data">資料問題</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
            問題標題
          </label>
          <input
            type="text"
            placeholder="請簡述問題"
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 14, color: '#374151', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
            問題描述
          </label>
          <textarea
            rows={5}
            placeholder="請詳細描述發生的問題、操作步驟及預期結果"
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 14, color: '#374151', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="submit"
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            送出回報
          </button>
        </div>
      </form>
    </div>
  );
}
