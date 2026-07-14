'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/session'
import { notifyReviewersForStep } from './notifications'
import { getAllocationOrgContext } from './approval-flow'

// 注意不可用 maybeSingle()：若同時存在多個啟用中的暫付款範本，
// maybeSingle 會回傳錯誤且被靜默忽略，導致 flow_template_id 存成 null、憑單無人可審
async function findTempVoucherTemplateId(): Promise<number | null> {
  const { data: tpls, error } = await supabase
    .from('approval_flow_templates')
    .select('id')
    .eq('form_type', 'temp_voucher')
    .eq('is_active', true)
    .order('id')
    .limit(1)
  if (error) console.error('findTempVoucherTemplateId error:', error.message)
  return tpls?.[0]?.id ?? null
}

// 暫付款沖銷單號＝母付款憑單採購單號 14 碼＋3 碼流水（001、002…）。
// 取同一張付款憑單底下既有沖銷憑單的最大流水碼 +1，避免中間有單被刪除時重複編號
export async function nextTempVoucherSerial(fundsPaymentId: number, paymentPoNumber: string | null): Promise<string | null> {
  if (!paymentPoNumber) return null
  const { data: siblings } = await supabase
    .from('temp_vouchers')
    .select('serial_number')
    .eq('funds_payment_id', fundsPaymentId)
  let maxSeq = 0
  for (const s of siblings ?? []) {
    const sn = s.serial_number
    if (typeof sn !== 'string' || !sn.startsWith(paymentPoNumber)) continue
    const seq = Number(sn.slice(paymentPoNumber.length))
    if (Number.isInteger(seq) && seq > maxSeq) maxSeq = seq
  }
  return `${paymentPoNumber}${String(maxSeq + 1).padStart(3, '0')}`
}

export async function createTempVoucher(
  fundsPaymentId: number,
  fields: Record<string, string>
): Promise<{ id: number | null; error: string | null }> {
  const session = await getSession()
  if (!session) return { id: null, error: '請先登入' }

  // 僅限「已付款＋預支」的付款憑單可建立沖銷憑單（畫面按鈕已有同樣條件，這裡擋直接呼叫的情況）
  const { data: payment, error: paymentErr } = await supabase
    .from('funds_payment')
    .select('status, category, amount, approved_amount, purchase_order_number')
    .eq('id', fundsPaymentId)
    .single()
  if (paymentErr || !payment) return { id: null, error: '找不到關聯的付款憑單' }
  if (payment.status !== 'paid' || payment.category !== '預支') {
    return { id: null, error: '僅限「已付款」且類型為「預支」的付款憑單可建立暫付款沖銷憑單' }
  }

  // 沖銷金額來源：優先用結構化 amount 欄位；表單沒有這個欄位時，依表單設定
  // 找 label「總額」的數字欄位（現行暫付款沖銷表單的金額欄是自訂欄位「總額」，
  // fieldId 對不到 amount，導致舊資料 amount 一直存 null——這裡一併修正，
  // 與付款憑單「憑單金額＝總額」同一約定）
  let amountRaw = fields['amount']
  if (!amountRaw) {
    const { data: schemaRow } = await supabase
      .from('form_schemas')
      .select('rows')
      .eq('form_type', 'temp_voucher')
      .maybeSingle()
    const blocks = (schemaRow?.rows ?? []) as { rows?: { slots?: ({ fieldId: string; label: string; type: string } | null)[] }[] }[]
    const totalSlot = blocks
      .flatMap(b => b.rows ?? [])
      .flatMap(r => r.slots ?? [])
      .find(s => s?.type === 'number' && s.label === '總額')
    if (totalSlot) amountRaw = fields[totalSlot.fieldId]
  }

  // 沖銷金額檢查：必須大於 0，且不能超過原預支憑單實際付款的金額
  const amount = Number(amountRaw)
  if (!amountRaw || !Number.isFinite(amount) || amount <= 0) {
    return { id: null, error: '沖銷金額（總額）必須大於 0。請填寫這次實際要沖銷的金額再送出。' }
  }
  const paidAmount = payment.approved_amount ?? payment.amount // 已付款憑單實際撥款金額＝核准金額（舊資料無核准金額則用憑單金額）
  if (paidAmount != null && amount > paidAmount) {
    return { id: null, error: `沖銷金額 NT$${amount.toLocaleString()} 超過原本這張預支付款憑單實際付款的金額 NT$${Number(paidAmount).toLocaleString()}——當初就只預支了這麼多，不能沖銷比它更多的錢。請確認金額後重新填寫。` }
  }

  const flowTemplateId = await findTempVoucherTemplateId()
  const serialNumber = await nextTempVoucherSerial(fundsPaymentId, payment.purchase_order_number)

  const { data, error } = await supabase
    .from('temp_vouchers')
    .insert({
      funds_payment_id: fundsPaymentId,
      serial_number: serialNumber,
      date: fields['date'] || null,
      apply_division: fields['apply_division'] || null,
      apply_section: fields['apply_section'] || null,
      applicant: fields['applicant'] || null,
      apply_role: fields['apply_role'] || null,
      amount, // 上方已驗證：> 0 且 ≤ 原預支憑單實際付款金額
      note: fields['note'] || null,
      status: 'draft',
      flow_template_id: flowTemplateId,
      current_step: null,
      created_by: session.userId,
    })
    .select('id')
    .single()

  if (error) return { id: null, error: error.message }
  return { id: data.id, error: null }
}

export async function submitTempVoucher(id: number): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  const flowTemplateId = await findTempVoucherTemplateId()

  const { error } = await supabase
    .from('temp_vouchers')
    .update({
      status: 'pending',
      current_step: 1,
      flow_template_id: flowTemplateId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('created_by', session.userId)
    .eq('status', 'draft')

  if (error) return { error: error.message }

  if (flowTemplateId) {
    ;(async () => {
      const { data: voucher } = await supabase
        .from('temp_vouchers')
        .select('funds_payment_id')
        .eq('id', id)
        .single()
      let itemName: string | null = null
      let allocationId: number | null = null
      if (voucher?.funds_payment_id) {
        const { data: relatedPayment } = await supabase
          .from('funds_payment')
          .select('name, funds_allocation_id')
          .eq('id', voucher.funds_payment_id)
          .single()
        itemName = relatedPayment?.name ?? null
        allocationId = relatedPayment?.funds_allocation_id ?? null
      }
      const orgContext = await getAllocationOrgContext(allocationId)
      await notifyReviewersForStep({
        templateId: flowTemplateId,
        stepNumber: 1,
        applyDivisionId: orgContext.applyDivisionId,
        applySectionId: orgContext.applySectionId,
        title: '暫付款沖銷憑單待審核',
        itemName,
        body: null,
        link: `/funds-voucher/review/check/${id}`,
        tempVoucherId: id,
      })
    })().catch(e => console.error('Notification error:', e))
  }

  return { error: null }
}
