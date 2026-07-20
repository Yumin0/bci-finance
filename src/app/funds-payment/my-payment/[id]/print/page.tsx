'use client'

// 付款憑單列印頁（比照筑今版式）：A4 直式表格＋瀏覽器列印（可存 PDF）。
// 開放條件見 lib/paymentPrintEligibility.ts：課處長關卡核准後即可匯出（2026-07-20 財務拍板，不必等已付款），
// 提早匯出時還沒審到的簽核欄（會計/CFO）人名留白給紙本簽。
// 入口：憑單詳細頁右上角「匯出付款憑單」、財務付款憑單管理頁每列「匯出」。
// 筑今差異（Yumin 2026-07-19 拍板）：會計科目欄改印「費用項目（細項）」；簽核欄名照筑今
// （CFO／會計／部門主管／申請人），帶新系統審核紀錄對應人名。

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FormBlock, FormSlot } from '@/lib/types'
import { getFormSchemas } from '@/app/actions/form-schema'
import { canExportPaymentVoucher } from '@/lib/paymentPrintEligibility'

type PrintPayment = {
  id: number
  funds_allocation_id: number | null
  purchase_order_number: string | null
  date: string | null
  amount: number | null
  approved_amount: number | null
  payment_method: string | null
  category: string | null
  status: string
  current_step: number | null
  applicant: string | null
  created_by: string | null
  extra_data: Record<string, string> | null
  funds_allocation: { name: string | null; applicant: string | null } | null
  approval_flow_templates: { approval_flow_steps: Array<{ step_number: number; reviewer_type: string | null }> } | null
}

type ApprovalRow = { step_name: string | null; decision: string | null; reviewer_id: string | null }

const COMPANY_NAME = '商明國際股份有限公司'
// CFO 欄不看審核紀錄、一律印財務長（Yumin 2026-07-19 拍板：不管誰核的都印吳素瑜；換人時改這裡）
const CFO_NAME = '吳素瑜'

// 憑單自己的付款明細組（instance 含 未稅金額/總額 key），與帶入申請單的組區分（含 費用項目（細項））
function parseGroups(extra: Record<string, string> | null) {
  const own: Record<string, string>[] = []
  const fromAllocation: Record<string, string>[] = []
  for (const [k, v] of Object.entries(extra ?? {})) {
    if (!k.startsWith('__group_')) continue
    try {
      const arr = JSON.parse(v)
      if (!Array.isArray(arr)) continue
      for (const inst of arr) {
        if ('未稅金額' in inst || '總額' in inst) own.push(inst)
        else if ('費用項目（細項）' in inst || '費用' in inst) fromAllocation.push(inst)
      }
    } catch { /* 非 JSON 的舊資料跳過 */ }
  }
  return { own, fromAllocation }
}

const cell: React.CSSProperties = { border: '1px solid #333', padding: '6px 10px', fontSize: 13, color: '#111' }

export default function PaymentPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const [record, setRecord] = useState<PrintPayment | null>(null)
  const [reviewerNames, setReviewerNames] = useState<Record<string, string>>({})
  const [approvals, setApprovals] = useState<ApprovalRow[]>([])
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<string[]>([])
  const [applicantName, setApplicantName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { id } = await params
      const [{ data }, { data: recs }, schemas] = await Promise.all([
        supabase
          .from('funds_payment')
          .select('id, funds_allocation_id, purchase_order_number, date, amount, approved_amount, payment_method, category, status, current_step, applicant, created_by, extra_data, funds_allocation:funds_allocation_id(name, applicant), approval_flow_templates(approval_flow_steps(step_number, reviewer_type))')
          .eq('id', Number(id))
          .single(),
        supabase
          .from('approval_records')
          .select('step_name, decision, reviewer_id')
          .eq('funds_payment_id', Number(id))
          .eq('decision', 'approved')
          .order('step_number'),
        getFormSchemas(),
      ])
      const payment = data as unknown as PrintPayment
      const rows = (recs ?? []) as ApprovalRow[]
      setApprovals(rows)
      const ids = [...new Set(rows.map(r => Number(r.reviewer_id)).filter(n => !isNaN(n)))]
      if (ids.length) {
        const { data: users } = await supabase.from('app_users').select('id, name').in('id', ids)
        setReviewerNames(Object.fromEntries((users ?? []).map(u => [String(u.id), u.name])))
      }
      // 申請人一律帶帳號的中文姓名（funds_payment.applicant 存的是英文名）
      const creatorId = Number(payment?.created_by)
      if (!isNaN(creatorId)) {
        const { data: creator } = await supabase.from('app_users').select('name').eq('id', creatorId).single()
        if (creator?.name) setApplicantName(creator.name)
      }
      const pmSlot = (schemas.payment_voucher as FormBlock[])
        .flatMap(b => b.rows.flatMap(r => r.slots))
        .find((s): s is NonNullable<FormSlot> => s !== null && s.fieldId === 'payment_method')
      setPaymentMethodOptions(pmSlot?.staticOptions ?? [])
      setRecord(payment)
      setLoading(false)
    }
    load()
  }, [params])

  if (loading) return <p className="text-muted-foreground">載入中...</p>
  if (!record) return <p className="text-muted-foreground">找不到付款憑單</p>
  if (!canExportPaymentVoucher(record.status, record.current_step, record.approval_flow_templates?.approval_flow_steps)) {
    return <p className="text-muted-foreground">此憑單尚未通過課長、處長審核，各處審核流程跑完後才能匯出付款憑單。</p>
  }

  const extra = record.extra_data ?? {}
  const { own, fromAllocation } = parseGroups(record.extra_data)
  // 細項：以摘要對回申請單帶入的組；對不到退回憑單頂層費用項目
  const detailFor = (summary: string) =>
    fromAllocation.find(g => (g['摘要/用途說明'] ?? '') === summary)?.['費用項目（細項）']
    || extra['費用項目'] || ''
  const rows = own.length ? own : [{ '摘要/用途說明': extra['摘要/用途說明'] ?? '', '總額': String(record.amount ?? '') }]
  const total = rows.reduce((sum, g) => sum + (parseFloat(g['總額'] ?? '0') || 0), 0)

  const nameOf = (r: ApprovalRow | undefined) => (r?.reviewer_id && reviewerNames[r.reviewer_id]) || ''
  const findStep = (match: (name: string) => boolean) => [...approvals].reverse().find(r => match(r.step_name ?? ''))
  const signers = {
    cfo: CFO_NAME,
    accountant: nameOf(findStep(n => n.includes('支出課') || n.includes('財務人員'))),
    manager: nameOf(findStep(n => n.includes('處長'))),
    applicant: applicantName || record.applicant || record.funds_allocation?.applicant || '',
  }
  const bankLine = [extra['受款銀行代碼'], extra['受款分行'] || extra['受款銀行名稱']].filter(Boolean).join(' ')

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', color: '#111' }}>
      <style>{`
        @media print {
          header, nav, aside, .print-hide { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; }
          body { background: #fff !important; }
          @page { size: A4 portrait; margin: 14mm; }
        }
      `}</style>

      {/* 頂部操作列（列印時隱藏）：按列印後在瀏覽器視窗選「另存為 PDF」即可輸出檔案 */}
      <div className="print-hide" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <a
          href={`/funds-payment/my-payment/${record.id}`}
          style={{ border: '1px solid #ccc', background: '#fff', color: '#333', padding: '9px 18px', fontSize: 14, borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          ← 返回付款憑單
        </a>
        <span style={{ fontSize: 13, color: '#666', flex: 1 }}>
          按「列印 / 匯出 PDF」後，在列印視窗的「目的地」選「另存為 PDF」即可輸出檔案
        </span>
        <button
          onClick={() => window.print()}
          style={{ background: '#111', color: '#fff', border: 'none', padding: '10px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer', borderRadius: 6, whiteSpace: 'nowrap' }}
        >
          🖨 列印 / 匯出 PDF
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
        <tbody>
          <tr><td colSpan={4} style={{ ...cell, textAlign: 'center', fontSize: 17, fontWeight: 700, padding: '10px' }}>{COMPANY_NAME}</td></tr>
          <tr><td colSpan={4} style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>付款憑單{record.category ? `(${record.category})` : ''}</td></tr>
          <tr>
            <td style={cell}>申請日期：{record.date?.slice(0, 10) ?? ''}</td>
            <td style={cell}>採購單號：{record.purchase_order_number ?? ''}</td>
            <td colSpan={2} style={cell}>專案名稱：{record.funds_allocation?.name ?? ''}</td>
          </tr>
          <tr><td colSpan={4} style={cell}>受款人：{extra['受款人'] ?? ''}</td></tr>
          <tr>
            <td colSpan={2} style={{ ...cell, fontWeight: 600 }}>摘要/用途說明</td>
            <td style={{ ...cell, fontWeight: 600, textAlign: 'center' }}>費用項目（細項）</td>
            <td style={{ ...cell, fontWeight: 600, textAlign: 'right' }}>金額</td>
          </tr>
          {rows.map((g, i) => (
            <tr key={i}>
              <td colSpan={2} style={cell}>{g['摘要/用途說明'] ?? ''}</td>
              <td style={cell}>{detailFor(g['摘要/用途說明'] ?? '')}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{(parseFloat(g['總額'] ?? '0') || 0).toLocaleString()}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} style={{ ...cell, fontWeight: 600 }}>合計：{total.toLocaleString()}</td>
            <td colSpan={2} style={cell}>
              {(paymentMethodOptions.length ? paymentMethodOptions : [record.payment_method ?? '']).filter(Boolean).map(opt => (
                <span key={opt} style={{ marginRight: 14, whiteSpace: 'nowrap' }}>
                  {opt === record.payment_method ? '☑' : '☐'} {opt}
                </span>
              ))}
            </td>
          </tr>
          <tr>
            <td rowSpan={2} style={cell}>付款條件：{extra['付款條件'] ?? ''}</td>
            <td colSpan={2} style={cell}>受款行：{bankLine}</td>
            <td style={cell}>出納：</td>
          </tr>
          <tr>
            <td colSpan={2} style={cell}>受款帳戶：{extra['受款帳戶'] ?? ''}</td>
            <td style={cell}>簽收：</td>
          </tr>
          <tr>
            {['CFO', '會計', '部門主管', '申請人'].map(t => (
              <td key={t} style={{ ...cell, textAlign: 'center', fontWeight: 600 }}>{t}</td>
            ))}
          </tr>
          <tr>
            {[signers.cfo, signers.accountant, signers.manager, signers.applicant].map((n, i) => (
              <td key={i} style={{ ...cell, textAlign: 'center', height: 44 }}>{n}</td>
            ))}
          </tr>
        </tbody>
      </table>

      <p style={{ margin: '16px 0 4px', fontSize: 13 }}>單據黏貼處</p>
      <div style={{ borderTop: '1px dashed #999', marginBottom: 24 }} />
    </div>
  )
}
