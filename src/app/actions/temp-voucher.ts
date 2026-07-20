'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/session'
import { notifyReviewersForStep } from './notifications'
import { getAllocationOrgContext, checkCanReviewStep } from './approval-flow'

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
  fields: Record<string, string>,
  extraData: Record<string, string> = {},
  // 儲存草稿時 asDraft=true：放寬沖銷金額下限（允許 0，仍擋負數與超過原預支上限），送出時為 false
  asDraft = false
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

  // 一張付款憑單只能建立一張沖銷憑單（Yumin 2026-07-14 拍板）：
  // 草稿/審核中/已核准都算佔名額；被退回（不核准）的不算，可重新建立。
  // 畫面按鈕已隱藏，這裡是存檔時的最後防線
  const { data: existing } = await supabase
    .from('temp_vouchers')
    .select('id, serial_number, status')
    .eq('funds_payment_id', fundsPaymentId)
    .neq('status', 'rejected')
    .limit(1)
  if (existing && existing.length > 0) {
    const ex = existing[0]
    const statusLabel = ex.status === 'draft' ? '草稿' : ex.status === 'pending' ? '審核中' : '已核准'
    return {
      id: null,
      error: `這張付款憑單已經建立過暫付款沖銷憑單（單號 ${ex.serial_number ?? `#${ex.id}`}，目前狀態：${statusLabel}），一張付款憑單只能沖銷一次，無法再建立。若要調整內容，請直接處理原本那張沖銷憑單。`,
    }
  }

  // 沖銷金額＝付款明細各組「總額」加總（與付款憑單「憑單金額＝各組總額加總」同一約定）。
  // 群組資料存在 extraData 的 __group_{blockId}（JSON 陣列、key 為欄位 label）；
  // 沒有群組資料時退回舊邏輯：找表單 label「總額」的數字欄位單一值
  let amount = 0
  let hasGroupData = false
  for (const [key, raw] of Object.entries(extraData)) {
    if (!key.startsWith('__group_')) continue
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        hasGroupData = true
        for (const inst of parsed) {
          const v = Number(inst?.['總額'])
          if (Number.isFinite(v)) amount += v
        }
      }
    } catch { /* 忽略解析錯誤 */ }
  }
  if (!hasGroupData) {
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
    amount = Number(amountRaw)
  }

  // 沖銷金額檢查：負數一律擋（草稿也擋）；送出時必須大於 0，儲存草稿允許 0（半成品尚未填總額）
  if (!Number.isFinite(amount) || amount < 0) {
    return { id: null, error: '沖銷金額（各組總額加總）不可為負數。請填寫這次實際要沖銷的金額再儲存。' }
  }
  if (!asDraft && amount <= 0) {
    return { id: null, error: '沖銷金額（各組總額加總）必須大於 0。請填寫這次實際要沖銷的金額再送出。' }
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
      extra_data: Object.keys(extraData).length > 0 ? extraData : null,
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

// 審核人於審核頁直接修改沖銷憑單（比照付款憑單 updatePaymentAsReviewer）。
// 金額欄（未稅金額/稅額/總額）與明細組數不可異動——沖銷金額＝各組總額加總，
// 改金額等於改沖銷金額；沖銷單審核進度沒有核准金額欄，金額不同意一律退回由申請人改。
// 前端已鎖唯讀、不可增刪組，這裡是直接呼叫 action 的最後防線；amount 一律不更新
export async function updateTempVoucherAsReviewer(
  id: number,
  fields: Record<string, string>,
  extraData: Record<string, string>
): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  const { data: voucher } = await supabase
    .from('temp_vouchers')
    .select('status, current_step, flow_template_id, funds_payment_id, extra_data')
    .eq('id', id)
    .single()
  if (!voucher) return { error: '找不到此暫付款沖銷憑單' }
  if (voucher.status !== 'pending' || voucher.current_step == null) {
    return { error: '只有審核中的暫付款沖銷憑單可以由審核人修改' }
  }

  const MONEY_LABELS = ['未稅金額', '稅額', '總額']
  const storedExtra = (voucher.extra_data ?? {}) as Record<string, string>
  for (const key of Object.keys(extraData)) {
    if (!key.startsWith('__group_') || !storedExtra[key]) continue
    let oldArr: Record<string, string>[] = []
    let newArr: Record<string, string>[] = []
    try { oldArr = JSON.parse(storedExtra[key]) } catch { /* empty */ }
    try { newArr = JSON.parse(extraData[key]) } catch { /* empty */ }
    const moneyChanged =
      oldArr.length !== newArr.length ||
      oldArr.some((row, i) => MONEY_LABELS.some(l => (row[l] ?? '') !== (newArr[i]?.[l] ?? '')))
    if (moneyChanged) {
      return { error: '審核人不可直接修改付款明細的金額或增刪明細組。金額有問題時請按「不核准」退回，由申請人修改後重新送審。' }
    }
  }

  const { data: stepDef } = await supabase
    .from('approval_flow_steps')
    .select('reviewer_type, role_type_id, org_unit_type, system_role_id, approval_group_id')
    .eq('template_id', voucher.flow_template_id)
    .eq('step_number', voucher.current_step)
    .limit(1)
    .maybeSingle()
  if (!stepDef) return { error: '找不到目前的審核關卡設定' }

  // 課長/處長（org_role）步驟的處/課別回溯兩層：temp_voucher → funds_payment → funds_allocation
  let allocationId: number | null = null
  if (voucher.funds_payment_id) {
    const { data: payment } = await supabase
      .from('funds_payment')
      .select('funds_allocation_id')
      .eq('id', voucher.funds_payment_id)
      .single()
    allocationId = payment?.funds_allocation_id ?? null
  }
  const orgContext = await getAllocationOrgContext(allocationId)
  const canReview = await checkCanReviewStep({
    userId: Number(session.userId),
    stepDef: stepDef as {
      reviewer_type: 'org_role' | 'system_role' | 'approval_group'
      role_type_id: number | null
      org_unit_type: string | null
      system_role_id: number | null
      approval_group_id: number | null
    },
    applyDivisionId: orgContext.applyDivisionId,
    applySectionId: orgContext.applySectionId,
  })
  if (!canReview) return { error: '你不是目前關卡的審核人，無法修改此暫付款沖銷憑單' }

  const { error } = await supabase
    .from('temp_vouchers')
    .update({
      ...('date' in fields ? { date: fields['date'] || null } : {}),
      ...('note' in fields ? { note: fields['note'] || null } : {}),
      extra_data: Object.keys(extraData).length > 0 ? extraData : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')

  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteTempVoucher(id: number): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  // 只允許刪除本人的草稿（送審後不可刪，避免誤刪審核中的沖銷單）
  const { data: voucher } = await supabase
    .from('temp_vouchers')
    .select('status, created_by')
    .eq('id', id)
    .single()
  if (!voucher) return { error: '找不到此暫付款沖銷憑單' }
  if (String(voucher.created_by) !== String(session.userId)) return { error: '你沒有權限刪除此暫付款沖銷憑單' }
  if (voucher.status !== 'draft') return { error: '只有草稿狀態的暫付款沖銷憑單可以刪除' }

  await supabase.from('notifications').delete().eq('temp_voucher_id', id)
  await supabase.from('fund_attachments').delete().eq('temp_voucher_id', id)
  const { error } = await supabase.from('temp_vouchers').delete().eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}
