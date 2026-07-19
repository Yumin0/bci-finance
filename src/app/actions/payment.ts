'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getSession } from '@/lib/session'
import { FundsPayment, FundsAllocation } from '@/lib/types'
import { PAYMENT_STATUS } from '@/lib/constants'
import { calcRemainingAmount, type PaymentForRemaining } from '@/lib/fundsAllocationRemaining'
import { buildOccupiedVoucherSummary } from '@/lib/occupiedVoucherLines'
import { notifyReviewersForStep } from './notifications'
import { getAllocationOrgContext, checkCanReviewStep } from './approval-flow'
import { recalcAllocationCloseStatus } from './fund-budget'
import { taipeiToday } from '@/lib/dateUtils'

// 採購單號＝母單號 11 碼＋3 碼流水（001、002…）。
// 取同母單既有憑單的最大流水碼 +1，而不是數筆數，避免中間有憑單被刪除時重複編號
export async function nextPurchaseOrderNumber(allocationId: number, allocationSerial: string | null): Promise<string | null> {
  if (!allocationSerial) return null
  const { data: siblings } = await supabase
    .from('funds_payment')
    .select('purchase_order_number')
    .eq('funds_allocation_id', allocationId)
  let maxSeq = 0
  for (const s of siblings ?? []) {
    const po = s.purchase_order_number
    if (typeof po !== 'string' || !po.startsWith(allocationSerial)) continue
    const seq = Number(po.slice(allocationSerial.length))
    if (Number.isInteger(seq) && seq > maxSeq) maxSeq = seq
  }
  return `${allocationSerial}${String(maxSeq + 1).padStart(3, '0')}`
}

// 檢查這筆金額（新建或修改一筆憑單）是否會讓同一張資金分配單的佔用總額超過核准金額。
// excludePaymentId：修改既有憑單時，要先排除它自己原本佔用的金額，否則會拿自己當作額外佔用去卡自己。
async function checkAmountWithinRemaining(
  allocationId: number,
  amount: number,
  excludePaymentId?: number,
  viewerId?: string | null,
  // 儲存草稿時放寬下限：允許金額為 0（半成品尚未填總額），但仍擋負數；
  // 送出時 allowZero=false，維持「必須 > 0」的嚴格檢查
  allowZero = false
): Promise<string | null> {
  // 下限：負數一律不可存檔（草稿也擋）——負數會讓母單剩餘金額不減反增，直接扭曲全站帳面
  if (amount < 0) {
    return `付款憑單金額不可為負數（目前為 NT$${Number(amount || 0).toLocaleString()}）。請確認付款明細每一組的「總額」都已填寫正確再儲存。`
  }
  // 送出時（非草稿）金額必須 > 0；儲存草稿允許 0
  if (!allowZero && !(amount > 0)) {
    return `付款憑單金額必須大於 0（目前為 NT$${Number(amount || 0).toLocaleString()}）。請確認付款明細每一組的「總額」都已填寫正確再儲存。`
  }
  const { data: alloc } = await supabase
    .from('funds_allocation')
    .select('approved_amount')
    .eq('id', allocationId)
    .single()
  if (!alloc) return '找不到資金分配申請單'

  const { data: payments } = await supabase
    .from('funds_payment')
    .select('id, status, amount, approved_amount')
    .eq('funds_allocation_id', allocationId)

  const others = (payments ?? []).filter(p => p.id !== excludePaymentId) as (PaymentForRemaining & { id: number })[]
  const remainingBeforeThis = calcRemainingAmount(alloc.approved_amount, others)
  if (amount > remainingBeforeThis) {
    // 點名式訊息：核准金額多少、底下已有哪幾張憑單（誰、哪天、狀態、各佔多少）、這次最多能填多少
    const { lines, occupiedTotal } = await buildOccupiedVoucherSummary(allocationId, { viewerId, excludePaymentId })
    const approvedLabel = alloc.approved_amount != null ? `NT$${Number(alloc.approved_amount).toLocaleString()}` : '（尚未核准）'
    return [
      `**這張憑單填的金額 NT$${amount.toLocaleString()} 超過資金分配單剩下可用的額度。**`,
      '',
      `這張資金分配單的核准金額是 ${approvedLabel}，底下已經有這些付款憑單在用額度：`,
      ...(lines.length > 0 ? lines : ['（無其他憑單）']),
      '',
      `合計已佔用 NT$${occupiedTotal.toLocaleString()}，目前剩餘 NT$${remainingBeforeThis.toLocaleString()}。`,
      `**這次最多只能填 NT$${remainingBeforeThis.toLocaleString()}，請調低本張金額，或先處理上面佔用額度的憑單。**`,
    ].join('\n')
  }
  return null
}

// 依出款帳戶找對應的付款憑單審核流程範本。
// 注意不可用 maybeSingle()：同一出款帳戶若同時綁定多個啟用中範本，
// maybeSingle 會回傳錯誤且被靜默忽略，導致 flow_template_id 存成 null、憑單無人可審
async function findPaymentVoucherTemplateId(paymentAccount: string | null): Promise<number | null> {
  if (!paymentAccount) return null
  const { data: paOpt } = await supabase
    .from('dropdown_options')
    .select('id')
    .eq('field', 'payment_account')
    .eq('label', paymentAccount)
    .maybeSingle()
  if (!paOpt?.id) return null
  const { data: tpas, error } = await supabase
    .from('template_payment_accounts')
    .select('template_id, approval_flow_templates!inner(id, form_type, is_active)')
    .eq('payment_account_option_id', paOpt.id)
    .eq('approval_flow_templates.form_type', 'payment_voucher')
    .eq('approval_flow_templates.is_active', true)
    .order('template_id')
    .limit(1)
  if (error) console.error('findPaymentVoucherTemplateId error:', error.message)
  return tpas?.[0]?.template_id ?? null
}

export async function getMyPayment(id: number): Promise<{ data: FundsPayment | null; error: string | null }> {
  const session = await getSession()
  if (!session) return { data: null, error: '請先登入' }

  const { data, error } = await supabase
    .from('funds_payment')
    .select('*')
    .eq('id', id)
    .eq('created_by', String(session.userId))
    .single()

  if (error) return { data: null, error: '找不到此付款憑單' }
  return { data: data as FundsPayment, error: null }
}

export async function createPayment(
  allocationId: number,
  paymentMethod: string,
  extraData: Record<string, string> = {},
  category: string | null = null,
  amount?: number,
  // 儲存草稿時 asDraft=true：放寬金額下限（允許 0，仍擋負數與超過剩餘），送出時為 false
  asDraft = false
): Promise<{ id: number | null; error: string | null }> {
  const session = await getSession()
  if (!session) return { id: null, error: '請先登入' }

  const { data: alloc, error: allocErr } = await supabase
    .from('funds_allocation')
    .select('*')
    .eq('id', allocationId)
    .single()

  if (allocErr || !alloc) return { id: null, error: '找不到資金分配申請單' }

  const record = alloc as FundsAllocation
  // 未傳入金額時（例如舊呼叫端）退回分配單全額，維持相容
  const paymentAmount = amount ?? record.amount

  const amountError = await checkAmountWithinRemaining(allocationId, paymentAmount, undefined, String(session.userId), asDraft)
  if (amountError) return { id: null, error: amountError }

  // 根據出款帳號查找對應的付款憑單審核流程範本
  const flowTemplateId = await findPaymentVoucherTemplateId(record.payment_account)
  const purchaseOrderNumber = await nextPurchaseOrderNumber(record.id, record.serial_number)

  const { data: inserted, error } = await supabase.from('funds_payment').insert({
    funds_allocation_id: record.id,
    name: record.name,
    amount: paymentAmount,
    // 日期＝實際建單日（台北時區），不再繼承母單申請日期（母單申請日期看頁首摘要卡）
    date: taipeiToday(),
    institution: record.institution,
    payment_account: record.payment_account,
    expense_item: record.expense_item,
    // 類型（一般/預支）自 2026-07 起改在建立付款憑單時選擇；未傳入時退回申請單的舊值（相容舊資料）
    category: category ?? record.category,
    note: record.note,
    apply_division: record.apply_division,
    apply_section: record.apply_section,
    applicant: record.applicant,
    apply_role: record.apply_role,
    payment_method: paymentMethod || null,
    purchase_order_number: purchaseOrderNumber,
    extra_data: { ...(record.extra_data ?? {}), ...extraData },
    created_by: String(session.userId),
    status: PAYMENT_STATUS.DRAFT,
    flow_template_id: flowTemplateId,
    current_step: null,
  }).select('id').single()

  if (error) return { id: null, error: error.message }
  return { id: inserted.id, error: null }
}

// 審核人於審核頁直接修改審核中（pending）的憑單。與 updateDraftPayment 的差異：
// 不限本人草稿，但 server 端必須驗證呼叫者確實是目前關卡的審核人（不能只信前端 canReview）；
// 類型（一般/預支）送審後鎖定，此處不更新 category；
// 金額（amount 與付款明細金額欄）審核人不可異動——金額調整一律走「核准金額」（2026-07-19 Yumin 拍板，
// 避免「憑單金額改了、核准金額沒跟」兩個地方要改造成的怪帳），此處不更新 amount、前端金額欄鎖唯讀
export async function updatePaymentAsReviewer(
  id: number,
  paymentMethod: string,
  extraData: Record<string, string>
): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  const { data: payment } = await supabase
    .from('funds_payment')
    .select('status, current_step, flow_template_id, funds_allocation_id, extra_data')
    .eq('id', id)
    .single()
  if (!payment) return { error: '找不到此付款憑單' }
  if (payment.status !== PAYMENT_STATUS.PENDING || payment.current_step == null) {
    return { error: '只有審核中的付款憑單可以由審核人修改' }
  }

  // 金額欄防線：付款明細群組裡的金額欄位值必須與已存資料一致（前端已鎖唯讀，這裡再擋一次）
  // 只比對既有 __group_ key（舊憑單無此 key、群組由申請單資料補出時無從比對，放行）
  const MONEY_LABELS = ['未稅金額', '稅額', '總額', '稅額選擇']
  const storedExtra = (payment.extra_data ?? {}) as Record<string, string>
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
      return { error: '審核人不可直接修改付款明細的金額或增刪明細組，金額調整請使用「核准金額」欄位。' }
    }
  }

  const { data: stepDef } = await supabase
    .from('approval_flow_steps')
    .select('reviewer_type, role_type_id, org_unit_type, system_role_id, approval_group_id')
    .eq('template_id', payment.flow_template_id)
    .eq('step_number', payment.current_step)
    .limit(1)
    .maybeSingle()
  if (!stepDef) return { error: '找不到目前的審核關卡設定' }

  const orgContext = await getAllocationOrgContext(payment.funds_allocation_id)
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
  if (!canReview) return { error: '你不是目前關卡的審核人，無法修改此付款憑單' }

  const { error } = await supabase
    .from('funds_payment')
    .update({
      payment_method: paymentMethod || null,
      extra_data: Object.keys(extraData).length > 0 ? extraData : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', PAYMENT_STATUS.PENDING)

  if (error) return { error: error.message }
  return { error: null }
}

export async function updateDraftPayment(
  id: number,
  paymentMethod: string,
  extraData: Record<string, string>,
  category?: string,
  amount?: number
): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  if (amount !== undefined) {
    const { data: payment } = await supabase
      .from('funds_payment')
      .select('funds_allocation_id')
      .eq('id', id)
      .single()
    if (payment) {
      const amountError = await checkAmountWithinRemaining(payment.funds_allocation_id, amount, id, String(session.userId))
      if (amountError) return { error: amountError }
    }
  }

  const { error } = await supabase
    .from('funds_payment')
    .update({
      payment_method: paymentMethod || null,
      extra_data: Object.keys(extraData).length > 0 ? extraData : null,
      ...(category !== undefined ? { category: category || null } : {}),
      ...(amount !== undefined ? { amount } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('created_by', String(session.userId))
    .eq('status', PAYMENT_STATUS.DRAFT)

  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteDraftPayment(id: number): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  // 只允許刪除本人的草稿（送審後不可刪，避免誤刪審核中的憑單）
  const { data: payment } = await supabase
    .from('funds_payment')
    .select('status, created_by')
    .eq('id', id)
    .single()
  if (!payment) return { error: '找不到此付款憑單' }
  if (String(payment.created_by) !== String(session.userId)) return { error: '你沒有權限刪除此付款憑單' }
  if (payment.status !== PAYMENT_STATUS.DRAFT) return { error: '只有草稿狀態的付款憑單可以刪除' }

  await supabase.from('notifications').delete().eq('funds_payment_id', id)
  await supabase.from('fund_attachments').delete().eq('funds_payment_id', id)
  const { error } = await supabase.from('funds_payment').delete().eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}

export async function confirmPayment(id: number): Promise<{ error: string | null }> {
  const { data: updated, error } = await supabase
    .from('funds_payment')
    .update({ status: PAYMENT_STATUS.PAID, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', PAYMENT_STATUS.APPROVED)
    .select('funds_allocation_id')
    .single()

  if (error) return { error: error.message }

  if (updated?.funds_allocation_id) {
    await recalcAllocationCloseStatus(updated.funds_allocation_id).catch(e =>
      console.error('recalcAllocationCloseStatus error:', e)
    )
  }

  return { error: null }
}

export async function submitMyPayment(id: number): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  // 查出付款憑單的出款帳號，重新確認對應範本
  const { data: payment } = await supabase
    .from('funds_payment')
    .select('payment_account, name, funds_allocation_id')
    .eq('id', id)
    .single()

  const flowTemplateId = await findPaymentVoucherTemplateId(payment?.payment_account ?? null)

  const { error } = await supabase
    .from('funds_payment')
    .update({
      status: PAYMENT_STATUS.PENDING,
      current_step: 1,
      flow_template_id: flowTemplateId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('created_by', String(session.userId))

  if (error) return { error: error.message }

  if (flowTemplateId) {
    ;(async () => {
      const orgContext = await getAllocationOrgContext(payment?.funds_allocation_id)
      await notifyReviewersForStep({
        templateId: flowTemplateId,
        stepNumber: 1,
        applyDivisionId: orgContext.applyDivisionId,
        applySectionId: orgContext.applySectionId,
        title: '付款憑單待審核',
        body: payment?.name ?? null,
        link: `/funds-payment/review/check/${id}`,
        fundsPaymentId: id,
      })
    })().catch(e => console.error('Notification error:', e))
  }

  return { error: null }
}
