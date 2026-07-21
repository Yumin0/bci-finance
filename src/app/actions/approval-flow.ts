'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { ApprovalFlowTemplate, ApprovalFlowStep, ApprovalFlowStepWithRole, ApprovedItem } from '@/lib/types'
import { sumApprovedItems } from '@/lib/approvedItems'
import { notifyReviewersForStep, notifyApplicant } from './notifications'
import { emailToEnglishName } from '@/lib/userNames'
import { calcRemainingAmount, type PaymentForRemaining } from '@/lib/fundsAllocationRemaining'
import { buildOccupiedVoucherSummary } from '@/lib/occupiedVoucherLines'

// ── 查詢 ──────────────────────────────────────────────

export async function getTemplates(formType: 'funds_allocation' | 'payment_voucher') {
  const { data, error } = await supabase
    .from('approval_flow_templates')
    .select('*')
    .eq('form_type', formType)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data as ApprovalFlowTemplate[]
}

export async function getTemplateWithSteps(templateId: number) {
  const [templateRes, stepsRes] = await Promise.all([
    supabase.from('approval_flow_templates').select('*').eq('id', templateId).single(),
    supabase
      .from('approval_flow_steps')
      .select('*, role_types(name), system_roles(name), approval_groups(name)')
      .eq('template_id', templateId)
      .order('step_number', { ascending: true }),
  ])
  if (templateRes.error) throw new Error(templateRes.error.message)
  if (stepsRes.error) throw new Error(stepsRes.error.message)

  const steps: ApprovalFlowStepWithRole[] = (stepsRes.data ?? []).map((s: {
    id: number; template_id: number; step_number: number; step_name: string;
    reviewer_type: 'org_role' | 'system_role' | 'approval_group';
    role_type_id: number | null; org_unit_type: 'division' | 'section' | null;
    system_role_id: number | null; approval_group_id: number | null;
    role_types: { name: string } | null;
    system_roles: { name: string } | null;
    approval_groups: { name: string } | null;
  }) => ({
    id: s.id,
    template_id: s.template_id,
    step_number: s.step_number,
    step_name: s.step_name,
    reviewer_type: s.reviewer_type,
    role_type_id: s.role_type_id,
    org_unit_type: s.org_unit_type,
    system_role_id: s.system_role_id,
    approval_group_id: s.approval_group_id,
    role_type_name: s.role_types?.name ?? null,
    system_role_name: s.system_roles?.name ?? null,
    approval_group_name: s.approval_groups?.name ?? null,
  }))

  return { template: templateRes.data as ApprovalFlowTemplate, steps }
}

export async function getActiveTemplatesWithPaymentAccounts(
  formType: 'funds_allocation' | 'payment_voucher'
) {
  const { data, error } = await supabase
    .from('approval_flow_templates')
    .select('*, template_payment_accounts(payment_account_option_id)')
    .eq('form_type', formType)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data
}

export async function getTemplateByPaymentAccount(
  paymentAccountOptionId: number,
  formType: 'funds_allocation' | 'payment_voucher'
) {
  const { data, error } = await supabase
    .from('template_payment_accounts')
    .select('template_id, approval_flow_templates!inner(id, name, form_type, is_active)')
    .eq('payment_account_option_id', paymentAccountOptionId)
    .eq('approval_flow_templates.form_type', formType)
    .eq('approval_flow_templates.is_active', true)
    .single()
  if (error) return null
  return data
}

// ── 新增範本 ──────────────────────────────────────────

export async function createTemplate(
  name: string,
  formType: 'funds_allocation' | 'payment_voucher' | 'temp_voucher'
): Promise<ApprovalFlowTemplate> {
  const { data, error } = await supabase
    .from('approval_flow_templates')
    .insert({ name, form_type: formType, is_active: true })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ApprovalFlowTemplate
}

// ── 更新範本名稱 ──────────────────────────────────────

export async function updateTemplateName(id: number, name: string) {
  const { error } = await supabase
    .from('approval_flow_templates')
    .update({ name })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── 切換啟用狀態 ──────────────────────────────────────

export async function toggleTemplateActive(id: number, isActive: boolean) {
  const { error } = await supabase
    .from('approval_flow_templates')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── 刪除範本 ──────────────────────────────────────────

export async function deleteTemplate(id: number) {
  const { error } = await supabase
    .from('approval_flow_templates')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── 儲存步驟（整批替換） ──────────────────────────────

export async function saveTemplateSteps(
  templateId: number,
  steps: Array<{
    step_number: number
    step_name: string
    reviewer_type: 'org_role' | 'system_role' | 'approval_group'
    role_type_id: number | null
    org_unit_type: 'division' | 'section' | null
    system_role_id: number | null
    approval_group_id: number | null
  }>
) {
  const { error: deleteError } = await supabase
    .from('approval_flow_steps')
    .delete()
    .eq('template_id', templateId)
  if (deleteError) throw new Error(deleteError.message)

  if (steps.length === 0) return

  const { error: insertError } = await supabase
    .from('approval_flow_steps')
    .insert(steps.map((s) => ({ ...s, template_id: templateId })))
  if (insertError) throw new Error(insertError.message)
}

// ── 儲存出款帳號對應（整批替換） ─────────────────────

export async function saveTemplatePaymentAccounts(
  templateId: number,
  paymentAccountOptionIds: number[]
) {
  const { error: deleteError } = await supabase
    .from('template_payment_accounts')
    .delete()
    .eq('template_id', templateId)
  if (deleteError) throw new Error(deleteError.message)

  if (paymentAccountOptionIds.length === 0) return

  const { error: insertError } = await supabase
    .from('template_payment_accounts')
    .insert(paymentAccountOptionIds.map((id) => ({
      template_id: templateId,
      payment_account_option_id: id,
    })))
  if (insertError) throw new Error(insertError.message)
}

// ── 核准金額存檔前驗證（最後一道防線）────────────────
// 畫面上已有同樣的限制，但畫面的擋法可能被繞過或改壞，
// 這裡在真正寫入前再檢查一次，違反規則就整筆拒收。
// 回傳錯誤訊息字串（白話，含具體人/單/金額），通過回傳 null。

async function validateAllocationApprovedAmount(
  allocationId: number,
  approvedAmount: number,
  reviewerId: string
): Promise<string | null> {
  // 缺口 5：核准 0 元（或負數）在業務上等於不核准，禁止用「核准」送出
  if (!(approvedAmount > 0)) {
    return '核准金額必須大於 0。如果不同意這張申請單，請按「不核准」，不要用 0 元（或負數）核准。'
  }

  const { data: alloc } = await supabase
    .from('funds_allocation')
    .select('amount, approved_amount')
    .eq('id', allocationId)
    .single()
  if (!alloc) return '找不到這張資金分配申請單，無法儲存審核結果。'

  // 缺口 1：只能等於或下修——上限是上一關核准的金額（第一關是申請金額）
  const cap = alloc.approved_amount ?? alloc.amount
  if (cap != null && approvedAmount > cap) {
    const capLabel = alloc.approved_amount != null ? '上一關核准的金額' : '申請人填的申請金額'
    return `核准金額只能等於或低於${capLabel} NT$${Number(cap).toLocaleString()}，不能往上調高。請重新填寫。`
  }

  // 缺口 3：下修不可低於底下付款憑單已經佔用的總額（點名式清單：誰、哪天、哪張單、什麼狀態）
  const { lines, creators, occupiedTotal } = await buildOccupiedVoucherSummary(allocationId, { viewerId: reviewerId })
  if (occupiedTotal === 0 || approvedAmount >= occupiedTotal) return null

  const onlySelf = creators.length === 1 && creators[0] === '你自己'
  const howToFix = onlySelf
    ? '或先刪除／調降你自己建立的上面那（幾）張憑單的金額，再回來下修。'
    : `或請 ${creators.filter(n => n !== '你自己').join('、')}${creators.includes('你自己') ? '（部分是你自己建立的）' : ''} 先刪除／調降上面憑單的金額，再回來下修。`

  return [
    '**這張資金分配單底下已經有付款憑單在用額度：**',
    ...lines,
    '',
    `合計已佔用 NT$${occupiedTotal.toLocaleString()}。核准金額如果改成 NT$${approvedAmount.toLocaleString()}，會低於已經用掉的錢，帳會對不起來，所以無法儲存。`,
    `**請填 NT$${occupiedTotal.toLocaleString()} 以上；${howToFix}**`,
  ].join('\n')
}

async function validatePaymentApprovedAmount(
  paymentId: number,
  approvedAmount: number,
  reviewerId: string
): Promise<string | null> {
  // 缺口 5：同資金分配——0 元或負數不能當「核准」
  if (!(approvedAmount > 0)) {
    return '核准金額必須大於 0。如果不同意這張付款憑單，請按「不核准」，不要用 0 元（或負數）核准。'
  }

  const { data: payment } = await supabase
    .from('funds_payment')
    .select('funds_allocation_id')
    .eq('id', paymentId)
    .single()
  if (!payment?.funds_allocation_id) return null // 沒掛母單的舊資料，無額度可比

  const { data: alloc } = await supabase
    .from('funds_allocation')
    .select('approved_amount')
    .eq('id', payment.funds_allocation_id)
    .single()
  if (!alloc) return null

  // 缺口 1：上限＝母單剩餘額度（排除本張自己目前佔用的金額）
  const { data: siblings } = await supabase
    .from('funds_payment')
    .select('id, status, amount, approved_amount')
    .eq('funds_allocation_id', payment.funds_allocation_id)
  const others = (siblings ?? []).filter(p => p.id !== paymentId) as PaymentForRemaining[]
  const remainingBeforeThis = calcRemainingAmount(alloc.approved_amount, others)
  if (approvedAmount > remainingBeforeThis) {
    // 點名式訊息：核准金額多少、其他憑單各佔多少、這次最多能核多少
    const { lines, occupiedTotal } = await buildOccupiedVoucherSummary(payment.funds_allocation_id, {
      viewerId: reviewerId,
      excludePaymentId: paymentId,
    })
    const approvedLabel = alloc.approved_amount != null ? `NT$${Number(alloc.approved_amount).toLocaleString()}` : '（尚未核准）'
    return [
      `**核准金額 NT$${approvedAmount.toLocaleString()} 超過這張資金分配單剩下可用的額度。**`,
      '',
      `資金分配單的核准金額是 ${approvedLabel}，除了這張憑單以外，底下已經有這些付款憑單在用額度：`,
      ...(lines.length > 0 ? lines : ['（無其他憑單）']),
      '',
      `合計已佔用 NT$${occupiedTotal.toLocaleString()}。`,
      `**這張憑單最多只能核 NT$${remainingBeforeThis.toLocaleString()}，請調低核准金額。**`,
    ].join('\n')
  }
  return null
}

// ── 提交審核決定 ──────────────────────────────────────

export async function submitApprovalDecision(params: {
  fundsAllocationId?: number
  fundsPaymentId?: number
  tempVoucherId?: number
  stepNumber: number
  stepName: string
  decision: 'approved' | 'rejected'
  comment: string
  reviewerId: string
  totalSteps: number
  approvedAmount?: number | null
  // 付款分類：僅付款憑單/沖銷憑單的審核群組步驟會帶入（財務出帳分類，選填）
  paymentCategory?: string | null
  // 逐項核准明細（僅資金分配）：有值時核准金額以逐項加總為準；未帶時（快速/批次核准）自動承接上一關的逐項值
  approvedItems?: ApprovedItem[] | null
}): Promise<{ error: string | null }> {
  const { fundsAllocationId, fundsPaymentId, tempVoucherId, stepNumber, stepName, decision, comment, reviewerId, totalSteps, paymentCategory, approvedItems } = params
  let approvedAmount = params.approvedAmount

  // ── 逐項核准明細（僅資金分配）──────────────────────────────
  let itemsToStore: ApprovedItem[] | null = null
  if (decision === 'approved' && fundsAllocationId) {
    if (approvedItems?.length) {
      for (const it of approvedItems) {
        if (!Number.isFinite(it.approved_base) || it.approved_base < 0) {
          return { error: `第 ${it.index + 1} 組的核准費用不是有效數字（不可為負數），請重新填寫。` }
        }
      }
      itemsToStore = approvedItems
      // 總核准金額以逐項加總為準（避免總額與逐項對不起來）
      approvedAmount = sumApprovedItems(approvedItems)
    } else {
      // 快速/批次核准（沒帶逐項值）＝「全部照上一關的逐項值通過」：承接最新一關的逐項明細，
      // 但僅在這次的總額與承接明細加總一致時（單一金額模式手改過總額時不硬塞對不上的明細）
      const { data: prevRows } = await supabase
        .from('approval_records')
        .select('approved_items, step_number')
        .eq('funds_allocation_id', fundsAllocationId)
        .eq('decision', 'approved')
        .not('approved_items', 'is', null)
        .order('step_number', { ascending: false })
        .limit(1)
      const prevItems = (prevRows?.[0]?.approved_items ?? null) as ApprovedItem[] | null
      if (prevItems?.length && approvedAmount != null && Math.abs(sumApprovedItems(prevItems) - approvedAmount) < 0.5) {
        itemsToStore = prevItems
      }
    }
  }

  // 核准金額存檔前驗證（畫面已擋過一次，這裡是最後一道防線；錯誤用回傳值帶回，
  // 不能用 throw——正式環境 throw 的訊息會被 Next.js 遮蔽，使用者只會看到通用錯誤）
  if (decision === 'approved' && approvedAmount != null) {
    let validationError: string | null = null
    if (fundsAllocationId) {
      validationError = await validateAllocationApprovedAmount(fundsAllocationId, approvedAmount, reviewerId)
    } else if (fundsPaymentId) {
      validationError = await validatePaymentApprovedAmount(fundsPaymentId, approvedAmount, reviewerId)
    }
    if (validationError) return { error: validationError }
  }

  // 下修通知（列20，僅資金分配）：承接值＝上一關核准金額（第一關為申請金額），
  // 必須在 update 覆寫 approved_amount 之前先讀，否則拿到的是這一關的新值
  let allocPrevCap: number | null = null
  if (fundsAllocationId && decision === 'approved' && approvedAmount != null) {
    const { data: prevAlloc } = await supabase
      .from('funds_allocation')
      .select('amount, approved_amount')
      .eq('id', fundsAllocationId)
      .single()
    const cap = prevAlloc?.approved_amount ?? prevAlloc?.amount
    allocPrevCap = cap != null ? Number(cap) : null
  }

  const isLastStep = stepNumber >= totalSteps
  const newStatus = decision === 'rejected' ? 'rejected' : isLastStep ? 'approved' : 'pending'
  const newCurrentStep = decision === 'rejected' || isLastStep ? null : stepNumber + 1

  const { error: recordError } = await supabase
    .from('approval_records')
    .insert({
      funds_allocation_id: fundsAllocationId ?? null,
      funds_payment_id: fundsPaymentId ?? null,
      temp_voucher_id: tempVoucherId ?? null,
      step_number: stepNumber,
      step_name: stepName,
      decision,
      comment: comment || null,
      approved_amount: decision === 'approved' ? (approvedAmount ?? null) : null,
      payment_category: decision === 'approved' ? (paymentCategory || null) : null,
      reviewer_id: reviewerId,
      reviewed_at: new Date().toISOString(),
      // 逐項核准明細：僅有值時帶欄位（避免正式機尚未加欄時，其他單據的審核也跟著失敗）
      ...(itemsToStore ? { approved_items: itemsToStore } : {}),
    })
  // 存檔失敗以中文訊息回傳（不用 throw——正式環境 throw 的訊息會被遮蔽，使用者只看到通用錯誤）
  if (recordError) {
    return { error: `審核結果存檔失敗，這次的審核沒有寫入，請稍後再試。\n\n若重試仍失敗，請把下面這行技術訊息告訴系統管理員：\n${recordError.message}` }
  }

  if (fundsAllocationId) {
    const updatePayload: Record<string, unknown> = { status: newStatus, current_step: newCurrentStep, updated_at: new Date().toISOString() }
    if (decision === 'approved' && approvedAmount != null) updatePayload.approved_amount = approvedAmount
    const { error } = await supabase.from('funds_allocation').update(updatePayload).eq('id', fundsAllocationId)
    if (error) throw new Error(error.message)
  }

  if (fundsPaymentId) {
    const paymentUpdatePayload: Record<string, unknown> = { status: newStatus, current_step: newCurrentStep, updated_at: new Date().toISOString() }
    if (decision === 'approved' && approvedAmount != null) paymentUpdatePayload.approved_amount = approvedAmount
    const { error } = await supabase.from('funds_payment')
      .update(paymentUpdatePayload)
      .eq('id', fundsPaymentId)
    if (error) throw new Error(error.message)
  }

  if (tempVoucherId) {
    const { error } = await supabase.from('temp_vouchers')
      .update({ status: newStatus, current_step: newCurrentStep, updated_at: new Date().toISOString() })
      .eq('id', tempVoucherId)
    if (error) throw new Error(error.message)
  }

  // ── 通知（失敗不影響主流程）────────────────────────────────
  try {
    if (fundsAllocationId) {
      const { data: alloc } = await supabase
        .from('funds_allocation')
        .select('created_by, apply_division_id, apply_section_id, flow_template_id, name')
        .eq('id', fundsAllocationId)
        .single()
      if (alloc) {
        const applicantId = parseInt(String(alloc.created_by), 10)
        const { data: creator } = await supabase.from('app_users').select('email').eq('id', applicantId).single()
        const allocBody = creator?.email ? `申請人：${emailToEnglishName(creator.email)}` : alloc.name
        if (decision === 'approved' && !isLastStep) {
          await notifyReviewersForStep({
            templateId: alloc.flow_template_id,
            stepNumber: stepNumber + 1,
            applyDivisionId: alloc.apply_division_id,
            applySectionId: alloc.apply_section_id,
            title: '資金分配申請待審核',
            itemName: alloc.name,
            body: allocBody,
            link: `/funds-allocation/review/check/${fundsAllocationId}`,
            fundsAllocationId,
          })
        } else if (decision === 'approved' && isLastStep) {
          await notifyApplicant({
            userId: applicantId,
            type: 'approved',
            title: '資金分配申請已核准',
            itemName: alloc.name,
            body: allocBody,
            link: `/funds-allocation/my-funds/edit/${fundsAllocationId}`,
            fundsAllocationId,
          })
          await notifyApplicant({
            userId: applicantId,
            type: 'payment_ready',
            title: '可建立付款憑單',
            itemName: alloc.name,
            body: allocBody,
            link: `/funds-payment/my-payment/add/${fundsAllocationId}`,
            fundsAllocationId,
          })
        } else if (decision === 'rejected') {
          await notifyApplicant({
            userId: applicantId,
            type: 'rejected',
            title: '資金分配申請已退回',
            itemName: alloc.name,
            body: allocBody,
            link: `/funds-allocation/my-funds/edit/${fundsAllocationId}`,
            fundsAllocationId,
          })
        }
        // 列20：核准金額低於承接值（下修）→ 每一關下修都通知申請人一次
        if (decision === 'approved' && approvedAmount != null && allocPrevCap != null && approvedAmount < allocPrevCap) {
          await notifyApplicant({
            userId: applicantId,
            type: 'approved',
            title: '核准金額調整',
            itemName: alloc.name,
            body: `「${stepName}」將核准金額由 NT$${allocPrevCap.toLocaleString()} 調整為 NT$${approvedAmount.toLocaleString()}`,
            link: `/funds-allocation/my-funds/edit/${fundsAllocationId}`,
            fundsAllocationId,
          })
        }
      }
    }

    if (fundsPaymentId) {
      const { data: payment } = await supabase
        .from('funds_payment')
        .select('created_by, flow_template_id, name, funds_allocation_id')
        .eq('id', fundsPaymentId)
        .single()
      if (payment) {
        const applicantId = parseInt(String(payment.created_by), 10)
        const { data: paymentCreator } = await supabase.from('app_users').select('email').eq('id', applicantId).single()
        const paymentBody = paymentCreator?.email ? `申請人：${emailToEnglishName(paymentCreator.email)}` : payment.name
        if (decision === 'approved' && !isLastStep) {
          const orgContext = await getAllocationOrgContext(payment.funds_allocation_id)
          await notifyReviewersForStep({
            templateId: payment.flow_template_id,
            stepNumber: stepNumber + 1,
            applyDivisionId: orgContext.applyDivisionId,
            applySectionId: orgContext.applySectionId,
            title: '付款憑單待審核',
            itemName: payment.name,
            body: paymentBody,
            link: `/funds-payment/review/check/${fundsPaymentId}`,
            fundsPaymentId,
          })
        } else if (decision === 'approved' && isLastStep) {
          await notifyApplicant({
            userId: applicantId,
            type: 'approved',
            title: '付款憑單已核准',
            itemName: payment.name,
            body: paymentBody,
            link: `/funds-payment/my-payment/${fundsPaymentId}`,
            fundsPaymentId,
          })
        } else if (decision === 'rejected') {
          await notifyApplicant({
            userId: applicantId,
            type: 'rejected',
            title: '付款憑單已退回',
            itemName: payment.name,
            body: paymentBody,
            link: `/funds-payment/my-payment/${fundsPaymentId}`,
            fundsPaymentId,
          })
        }
      }
    }

    if (tempVoucherId) {
      const { data: voucher } = await supabase
        .from('temp_vouchers')
        .select('created_by, flow_template_id, funds_payment_id')
        .eq('id', tempVoucherId)
        .single()
      if (voucher) {
        const applicantId = Number(voucher.created_by)
        let voucherItemName: string | null = null
        let voucherAllocationId: number | null = null
        if (voucher.funds_payment_id) {
          const { data: relatedPayment } = await supabase
            .from('funds_payment')
            .select('name, funds_allocation_id')
            .eq('id', voucher.funds_payment_id)
            .single()
          voucherItemName = relatedPayment?.name ?? null
          voucherAllocationId = relatedPayment?.funds_allocation_id ?? null
        }
        if (decision === 'approved' && !isLastStep) {
          const orgContext = await getAllocationOrgContext(voucherAllocationId)
          await notifyReviewersForStep({
            templateId: voucher.flow_template_id,
            stepNumber: stepNumber + 1,
            applyDivisionId: orgContext.applyDivisionId,
            applySectionId: orgContext.applySectionId,
            title: '暫付款沖銷憑單待審核',
            itemName: voucherItemName,
            body: null,
            link: `/funds-voucher/review/check/${tempVoucherId}`,
            tempVoucherId,
          })
        } else if (decision === 'approved' && isLastStep) {
          await notifyApplicant({
            userId: applicantId,
            type: 'approved',
            title: '暫付款沖銷憑單已核准',
            itemName: voucherItemName,
            body: null,
            link: `/funds-voucher/my-voucher/${tempVoucherId}`,
            tempVoucherId,
          })
        } else if (decision === 'rejected') {
          await notifyApplicant({
            userId: applicantId,
            type: 'rejected',
            title: '暫付款沖銷憑單已退回',
            itemName: voucherItemName,
            body: null,
            link: `/funds-voucher/my-voucher/${tempVoucherId}`,
            tempVoucherId,
          })
        }
      }
    }
  } catch (e) {
    console.error('Notification error:', e)
  }

  return { error: null }
}

// ── 審核人資格驗證與待審清單 ─────────────────────────────────

type StepRef = {
  step_number: number
  step_name: string
  reviewer_type: string
  role_type_id: number | null
  org_unit_type: string | null
  system_role_id: number | null
  approval_group_id: number | null
}

async function getReviewerInfo(userId: number) {
  const [membershipsRes, userRes, groupsRes] = await Promise.all([
    supabase.from('org_unit_members').select('org_unit_id, role_type_id').eq('user_id', userId),
    supabase.from('app_users').select('system_role_id').eq('id', userId).single(),
    supabase.from('approval_group_members').select('group_id').eq('user_id', userId),
  ])
  const memberships = (membershipsRes.data ?? []) as { org_unit_id: number; role_type_id: number | null }[]
  const systemRoleId = (userRes.data as { system_role_id: number | null } | null)?.system_role_id ?? null
  const groupIds = new Set((groupsRes.data ?? []).map((r: { group_id: number }) => r.group_id))
  return {
    roleTypeIds: new Set(memberships.map(m => m.role_type_id).filter((id): id is number => id !== null)),
    memberOrgUnitIds: new Set(memberships.map(m => m.org_unit_id)),
    systemRoleId,
    groupIds,
  }
}

function stepMatchesReviewer(
  stepDef: StepRef,
  reviewerInfo: { roleTypeIds: Set<number>; memberOrgUnitIds: Set<number>; systemRoleId: number | null; groupIds: Set<number> },
  orgContext?: { applyDivisionId?: number | null; applySectionId?: number | null }
): boolean {
  if (stepDef.reviewer_type === 'system_role') {
    return stepDef.system_role_id !== null && stepDef.system_role_id === reviewerInfo.systemRoleId
  }
  if (stepDef.reviewer_type === 'org_role') {
    if (stepDef.org_unit_type === 'division') {
      const targetId = orgContext?.applyDivisionId
      return targetId != null && reviewerInfo.memberOrgUnitIds.has(targetId)
    }
    if (stepDef.org_unit_type === 'section') {
      const targetId = orgContext?.applySectionId
      return targetId != null && reviewerInfo.memberOrgUnitIds.has(targetId)
    }
    return stepDef.role_type_id !== null && reviewerInfo.roleTypeIds.has(stepDef.role_type_id)
  }
  if (stepDef.reviewer_type === 'approval_group') {
    return stepDef.approval_group_id !== null && reviewerInfo.groupIds.has(stepDef.approval_group_id)
  }
  return false
}

export async function checkCanReviewStep(params: {
  userId: number
  stepDef: {
    reviewer_type: 'org_role' | 'system_role' | 'approval_group'
    role_type_id: number | null
    org_unit_type?: string | null
    system_role_id: number | null
    approval_group_id: number | null
    step_number?: number
    step_name?: string
  }
  applyDivisionId?: number | null
  applySectionId?: number | null
}): Promise<boolean> {
  const reviewerInfo = await getReviewerInfo(params.userId)
  return stepMatchesReviewer(params.stepDef as StepRef, reviewerInfo, {
    applyDivisionId: params.applyDivisionId,
    applySectionId: params.applySectionId,
  })
}

const STEP_SELECT = 'step_number, step_name, reviewer_type, role_type_id, org_unit_type, system_role_id, approval_group_id'

export async function getPendingAllocationsForReviewer(userId: number) {
  const reviewerInfo = await getReviewerInfo(userId)
  const { data } = await supabase
    .from('funds_allocation')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT}))`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  const filtered = ((data ?? []) as unknown as Array<{ current_step: number | null; apply_division_id: number | null; apply_section_id: number | null; created_by: string; applicant: string | null; approval_flow_templates: { name: string; approval_flow_steps: StepRef[] } | null } & Record<string, unknown>>)
    .filter(r => {
      const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
      return stepDef ? stepMatchesReviewer(stepDef, reviewerInfo, {
        applyDivisionId: r.apply_division_id,
        applySectionId: r.apply_section_id,
      }) : false
    })

  // Resolve English names from created_by
  const creatorIds = [...new Set(
    filtered.map(r => parseInt(r.created_by, 10)).filter(id => !isNaN(id))
  )]
  const emailMap = new Map<number, string>()
  if (creatorIds.length > 0) {
    const { data: users } = await supabase.from('app_users').select('id, email').in('id', creatorIds)
    for (const u of (users ?? [])) emailMap.set(u.id as number, u.email as string)
  }

  return filtered.map(r => {
    const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by),
      step_name: stepDef?.step_name ?? `第 ${r.current_step ?? 1} 步`,
    }
  })
}

type PendingRaw = { current_step: number | null; apply_division_id: number | null; apply_section_id: number | null; created_by: string; applicant: string | null; approval_flow_templates: { name: string; approval_flow_steps: StepRef[] } | null } & Record<string, unknown>

async function resolvePendingNames(items: PendingRaw[]) {
  const creatorIds = [...new Set(items.map(r => parseInt(r.created_by, 10)).filter(id => !isNaN(id)))]
  const emailMap = new Map<number, string>()
  if (creatorIds.length > 0) {
    const { data: users } = await supabase.from('app_users').select('id, email').in('id', creatorIds)
    for (const u of (users ?? [])) emailMap.set(u.id as number, u.email as string)
  }
  return emailMap
}

export async function getPendingAllocationsForOrgRole(userId: number) {
  const reviewerInfo = await getReviewerInfo(userId)
  const { data } = await supabase
    .from('funds_allocation')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT}))`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const filtered = ((data ?? []) as unknown as PendingRaw[]).filter(r => {
    const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
    if (!stepDef || stepDef.reviewer_type !== 'org_role') return false
    return stepMatchesReviewer(stepDef, reviewerInfo, {
      applyDivisionId: r.apply_division_id,
      applySectionId: r.apply_section_id,
    })
  })

  const emailMap = await resolvePendingNames(filtered)
  return filtered.map(r => {
    const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return { ...r, applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by), step_name: stepDef?.step_name ?? `第 ${r.current_step ?? 1} 步` }
  })
}

export async function getPendingAllocationsByApprovalGroup(groupId: number) {
  const { data } = await supabase
    .from('funds_allocation')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT}))`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const filtered = ((data ?? []) as unknown as PendingRaw[]).filter(r => {
    const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
    return stepDef?.reviewer_type === 'approval_group' && stepDef.approval_group_id === groupId
  })

  const emailMap = await resolvePendingNames(filtered)
  return filtered.map(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const stepDef = steps.find(s => s.step_number === r.current_step)
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by),
      step_name: stepDef?.step_name ?? `第 ${r.current_step ?? 1} 步`,
      total_steps: steps.length,
    }
  })
}

type AllRaw = PendingRaw & { id: number; status: string }

// 單子是否已走到指定步驟：待審核看目前步驟、已核准（付款憑單含已付款）視為走完全部步驟、
// 被退回的看審核紀錄實際走到過的最大步驟（退回後 current_step 會被清空）；草稿一律未到達
function hasReachedStep(status: string, currentStep: number | null, stepNumber: number, maxRecordedStep: number): boolean {
  if (status === 'approved' || status === 'paid') return true
  if (status === 'pending') return (currentStep ?? 0) >= stepNumber
  if (status === 'rejected') return maxRecordedStep >= stepNumber
  return false
}

// 查詢多張單子各自在審核紀錄中出現過的最大步驟編號（退回單判斷「曾走到哪一步」用）
async function getMaxRecordedSteps(
  column: 'funds_allocation_id' | 'funds_payment_id' | 'temp_voucher_id',
  ids: number[]
): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map()
  const { data } = await supabase
    .from('approval_records')
    .select(`${column}, step_number`)
    .in(column, ids)
  const map = new Map<number, number>()
  for (const r of (data ?? []) as unknown as Array<Record<string, number>>) {
    const id = r[column]
    if (r.step_number > (map.get(id) ?? 0)) map.set(id, r.step_number)
  }
  return map
}

// 從候選單中過濾出「已走到審核人對應步驟」的單子（myStep 為該審核人/群組在範本中最早的步驟編號）
async function filterReached<T extends { id: number; status: string; current_step: number | null }>(
  column: 'funds_allocation_id' | 'funds_payment_id' | 'temp_voucher_id',
  candidates: Array<{ row: T; myStep: number }>
): Promise<T[]> {
  const rejectedIds = candidates.filter(c => c.row.status === 'rejected').map(c => c.row.id)
  const maxSteps = await getMaxRecordedSteps(column, rejectedIds)
  return candidates
    .filter(c => hasReachedStep(c.row.status, c.row.current_step, c.myStep, maxSteps.get(c.row.id) ?? 0))
    .map(c => c.row)
}

export async function getAllocationsForOrgRoleByWeek(userId: number, weekStart: string, weekEnd: string) {
  const reviewerInfo = await getReviewerInfo(userId)
  const { data } = await supabase
    .from('funds_allocation')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT})), funds_payment(status, amount, approved_amount)`)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date', { ascending: false })

  const candidates = ((data ?? []) as unknown as AllRaw[]).flatMap(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const matching = steps.filter(s =>
      s.reviewer_type === 'org_role' &&
      stepMatchesReviewer(s, reviewerInfo, {
        applyDivisionId: r.apply_division_id,
        applySectionId: r.apply_section_id,
      })
    )
    if (matching.length === 0) return []
    return [{ row: r, myStep: Math.min(...matching.map(s => s.step_number)) }]
  })

  const filtered = await filterReached('funds_allocation_id', candidates)

  const emailMap = await resolvePendingNames(filtered)
  return filtered.map(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const matchingStep = steps.find(s =>
      s.reviewer_type === 'org_role' &&
      stepMatchesReviewer(s, reviewerInfo, {
        applyDivisionId: r.apply_division_id,
        applySectionId: r.apply_section_id,
      })
    )
    const isPendingHere = r.status === 'pending' && r.current_step === matchingStep?.step_number
    const currentStepDef = steps.find(s => s.step_number === r.current_step)
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by),
      step_name: r.status === 'pending'
        ? (currentStepDef?.step_name ?? `第 ${r.current_step ?? 1} 步`)
        : undefined,
      total_steps: steps.length,
      is_pending_here: isPendingHere,
      remainingAmount: calcRemainingAmount(r.approved_amount as number | null, (r.funds_payment as PaymentForRemaining[]) ?? []),
    }
  })
}

export async function getAllocationsForApprovalGroupByWeek(userId: number | null | undefined, groupId: number, weekStart: string, weekEnd: string) {
  // 群組 Tab 的「審核」按鈕只給實際群組成員：非成員（僅有 Tab 檢視權限）看到的是「查閱」，
  // 與審核頁 checkCanReviewStep（同樣要求群組成員）一致，避免列表顯示可審、進去卻不能審。
  const { data: groupMembers } = await supabase
    .from('approval_group_members').select('user_id').eq('group_id', groupId)
  const isGroupMember = userId != null && (groupMembers ?? []).some(m => Number(m.user_id) === Number(userId))

  const { data } = await supabase
    .from('funds_allocation')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT})), funds_payment(status, amount, approved_amount)`)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date', { ascending: false })

  const candidates = ((data ?? []) as unknown as AllRaw[]).flatMap(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const matching = steps.filter(s => s.reviewer_type === 'approval_group' && s.approval_group_id === groupId)
    if (matching.length === 0) return []
    return [{ row: r, myStep: Math.min(...matching.map(s => s.step_number)) }]
  })

  const filtered = await filterReached('funds_allocation_id', candidates)

  const emailMap = await resolvePendingNames(filtered)
  return filtered.map(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const matchingStep = steps.find(s => s.reviewer_type === 'approval_group' && s.approval_group_id === groupId)
    const isPendingHere = isGroupMember && r.status === 'pending' && r.current_step === matchingStep?.step_number
    const currentStepDef = steps.find(s => s.step_number === r.current_step)
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by),
      step_name: r.status === 'pending'
        ? (currentStepDef?.step_name ?? `第 ${r.current_step ?? 1} 步`)
        : undefined,
      total_steps: steps.length,
      is_pending_here: isPendingHere,
      remainingAmount: calcRemainingAmount(r.approved_amount as number | null, (r.funds_payment as PaymentForRemaining[]) ?? []),
    }
  })
}

export async function getApprovalHistoryForReviewer(userId: number) {
  const { data } = await supabase
    .from('approval_records')
    .select(`*, funds_allocation:funds_allocation_id(id, name, amount, status, serial_number, apply_division, apply_section, applicant, apply_role, payment_account, expense_item, created_by)`)
    .eq('reviewer_id', String(userId))
    .not('decision', 'is', null)
    .not('funds_allocation_id', 'is', null)
    .order('reviewed_at', { ascending: false })
    .limit(500)

  type RawItem = Record<string, unknown> & {
    funds_allocation_id: number | null
    step_number: number
    reviewed_at: string | null
    funds_allocation: (Record<string, unknown> & { created_by: string; applicant: string | null }) | null
  }
  const records = (data ?? []) as RawItem[]

  // Deduplicate: keep highest step per allocation
  const seen = new Map<number, RawItem>()
  for (const r of records) {
    const allocId = r.funds_allocation_id ?? 0
    const existing = seen.get(allocId)
    if (!existing || r.step_number > existing.step_number) seen.set(allocId, r)
  }
  const deduped = Array.from(seen.values()).sort(
    (a, b) => new Date(b.reviewed_at ?? '').getTime() - new Date(a.reviewed_at ?? '').getTime()
  )

  // Resolve English names from created_by
  const creatorIds = [...new Set(
    deduped
      .map(r => parseInt(r.funds_allocation?.created_by ?? '', 10))
      .filter(id => !isNaN(id))
  )]
  const emailMap = new Map<number, string>()
  if (creatorIds.length > 0) {
    const { data: users } = await supabase.from('app_users').select('id, email').in('id', creatorIds)
    for (const u of (users ?? [])) emailMap.set(u.id as number, u.email as string)
  }

  return deduped.map(r => {
    if (!r.funds_allocation) return r
    const id = parseInt(r.funds_allocation.created_by ?? '', 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      funds_allocation: {
        ...r.funds_allocation,
        applicant: email ? emailToEnglishName(email) : (r.funds_allocation.applicant ?? r.funds_allocation.created_by),
      },
    }
  })
}

// 付款憑單/暫付款沖銷憑單本身沒有 apply_division_id/apply_section_id 欄位，
// org_role（課長/處長）步驟的審核人需回溯關聯的資金分配申請單取得
export async function getAllocationOrgContext(
  allocationId: number | null | undefined
): Promise<{ applyDivisionId: number | null; applySectionId: number | null }> {
  if (!allocationId) return { applyDivisionId: null, applySectionId: null }
  const { data } = await supabase
    .from('funds_allocation')
    .select('apply_division_id, apply_section_id')
    .eq('id', allocationId)
    .single()
  const alloc = data as { apply_division_id: number | null; apply_section_id: number | null } | null
  return { applyDivisionId: alloc?.apply_division_id ?? null, applySectionId: alloc?.apply_section_id ?? null }
}

type AllocOrgRef = { apply_division_id: number | null; apply_section_id: number | null } | null

type PaymentWeekRaw = {
  id: number
  status: string
  current_step: number | null
  created_by: string
  applicant: string | null
  funds_allocation: AllocOrgRef
  approval_flow_templates: { name: string; approval_flow_steps: StepRef[] } | null
} & Record<string, unknown>

// 啟用中付款憑單範本實際使用到的審核群組（審核管理頁動態 Tab 用）
export async function getPaymentVoucherReviewGroups(): Promise<{ id: number; name: string }[]> {
  const { data } = await supabase
    .from('approval_flow_steps')
    .select('approval_group_id, approval_flow_templates!inner(form_type, is_active)')
    .eq('reviewer_type', 'approval_group')
    .eq('approval_flow_templates.form_type', 'payment_voucher')
    .eq('approval_flow_templates.is_active', true)
    .not('approval_group_id', 'is', null)
  const ids = [...new Set((data ?? []).map((r: { approval_group_id: number }) => r.approval_group_id))]
  if (ids.length === 0) return []
  const { data: groups } = await supabase
    .from('approval_groups')
    .select('id, name')
    .in('id', ids)
    .order('sort_order')
  return (groups ?? []) as { id: number; name: string }[]
}

export async function getPaymentsForOrgRoleByWeek(userId: number, weekStart: string, weekEnd: string) {
  const reviewerInfo = await getReviewerInfo(userId)
  const { data } = await supabase
    .from('funds_payment')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT})), funds_allocation:funds_allocation_id(apply_division_id, apply_section_id)`)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date', { ascending: false })

  const candidates = ((data ?? []) as unknown as PaymentWeekRaw[]).flatMap(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const matching = steps.filter(s =>
      s.reviewer_type === 'org_role' &&
      stepMatchesReviewer(s, reviewerInfo, {
        applyDivisionId: r.funds_allocation?.apply_division_id,
        applySectionId: r.funds_allocation?.apply_section_id,
      })
    )
    if (matching.length === 0) return []
    return [{ row: r, myStep: Math.min(...matching.map(s => s.step_number)) }]
  })

  const filtered = await filterReached('funds_payment_id', candidates)

  const emailMap = await resolvePendingNames(filtered as unknown as PendingRaw[])
  return filtered.map(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const currentStepDef = steps.find(s => s.step_number === r.current_step)
    // 直接判斷「目前步驟」是否輪到此使用者（同範本可能有多個 org_role 步驟，不能只找第一個符合的）
    const isPendingHere = r.status === 'pending' &&
      currentStepDef?.reviewer_type === 'org_role' &&
      stepMatchesReviewer(currentStepDef, reviewerInfo, {
        applyDivisionId: r.funds_allocation?.apply_division_id,
        applySectionId: r.funds_allocation?.apply_section_id,
      })
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by),
      step_name: r.status === 'pending'
        ? (currentStepDef?.step_name ?? `第 ${r.current_step ?? 1} 步`)
        : undefined,
      total_steps: steps.length,
      is_pending_here: isPendingHere,
    }
  })
}

export async function getPaymentsForApprovalGroupByWeek(userId: number | null | undefined, groupId: number, weekStart: string, weekEnd: string) {
  // 群組 Tab 的「審核」按鈕只給實際群組成員：非成員（僅有 Tab 檢視權限）看到的是「查閱」，
  // 與審核頁 checkCanReviewStep（同樣要求群組成員）一致，避免列表顯示可審、進去卻不能審。
  const { data: groupMembers } = await supabase
    .from('approval_group_members').select('user_id').eq('group_id', groupId)
  const isGroupMember = userId != null && (groupMembers ?? []).some(m => Number(m.user_id) === Number(userId))

  const { data } = await supabase
    .from('funds_payment')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT})), funds_allocation:funds_allocation_id(apply_division_id, apply_section_id)`)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date', { ascending: false })

  const candidates = ((data ?? []) as unknown as PaymentWeekRaw[]).flatMap(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const matching = steps.filter(s => s.reviewer_type === 'approval_group' && s.approval_group_id === groupId)
    if (matching.length === 0) return []
    return [{ row: r, myStep: Math.min(...matching.map(s => s.step_number)) }]
  })

  const filtered = await filterReached('funds_payment_id', candidates)

  const emailMap = await resolvePendingNames(filtered as unknown as PendingRaw[])
  return filtered.map(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const currentStepDef = steps.find(s => s.step_number === r.current_step)
    // 直接判斷「目前步驟」是否屬於此群組（同範本可能有多個步驟用同一群組，不能只找第一個符合的）
    const isPendingHere = isGroupMember && r.status === 'pending' &&
      currentStepDef?.reviewer_type === 'approval_group' &&
      currentStepDef.approval_group_id === groupId
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by),
      step_name: r.status === 'pending'
        ? (currentStepDef?.step_name ?? `第 ${r.current_step ?? 1} 步`)
        : undefined,
      total_steps: steps.length,
      is_pending_here: isPendingHere,
    }
  })
}

export async function getPendingPaymentsForReviewer(userId: number) {
  const reviewerInfo = await getReviewerInfo(userId)
  const { data } = await supabase
    .from('funds_payment')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT})), funds_allocation:funds_allocation_id(apply_division_id, apply_section_id)`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return ((data ?? []) as unknown as Array<{ current_step: number | null; funds_allocation: AllocOrgRef; approval_flow_templates: { name: string; approval_flow_steps: StepRef[] } | null } & Record<string, unknown>>)
    .filter(r => {
      const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
      return stepDef ? stepMatchesReviewer(stepDef, reviewerInfo, {
        applyDivisionId: r.funds_allocation?.apply_division_id,
        applySectionId: r.funds_allocation?.apply_section_id,
      }) : false
    })
    .map(r => {
      const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
      return { ...r, step_name: stepDef?.step_name ?? `第 ${r.current_step ?? 1} 步` }
    })
}

export async function getPendingVouchersForReviewer(userId: number) {
  const reviewerInfo = await getReviewerInfo(userId)
  const { data } = await supabase
    .from('temp_vouchers')
    .select(`*, approval_flow_templates(approval_flow_steps(${STEP_SELECT})), funds_payment:funds_payment_id(funds_allocation:funds_allocation_id(apply_division_id, apply_section_id))`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return ((data ?? []) as unknown as Array<{ current_step: number | null; funds_payment: { funds_allocation: AllocOrgRef } | null; approval_flow_templates: { approval_flow_steps: StepRef[] } | null } & Record<string, unknown>>)
    .filter(r => {
      const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
      return stepDef ? stepMatchesReviewer(stepDef, reviewerInfo, {
        applyDivisionId: r.funds_payment?.funds_allocation?.apply_division_id,
        applySectionId: r.funds_payment?.funds_allocation?.apply_section_id,
      }) : false
    })
    .map(r => {
      const stepDef = (r.approval_flow_templates?.approval_flow_steps ?? []).find(s => s.step_number === r.current_step)
      return { ...r, step_name: stepDef?.step_name ?? `第 ${r.current_step ?? 1} 步` }
    })
}

// ── 暫付款沖銷憑單審核管理（Tab 對齊付款憑單）────────────

// 啟用中的暫付款沖銷範本實際使用到的審核群組（產生群組 Tab 用）
export async function getTempVoucherReviewGroups(): Promise<{ id: number; name: string }[]> {
  const { data } = await supabase
    .from('approval_flow_steps')
    .select('approval_group_id, approval_flow_templates!inner(form_type, is_active)')
    .eq('reviewer_type', 'approval_group')
    .eq('approval_flow_templates.form_type', 'temp_voucher')
    .eq('approval_flow_templates.is_active', true)
    .not('approval_group_id', 'is', null)
  const ids = [...new Set((data ?? []).map((r: { approval_group_id: number }) => r.approval_group_id))]
  if (ids.length === 0) return []
  const { data: groups } = await supabase
    .from('approval_groups')
    .select('id, name')
    .in('id', ids)
    .order('sort_order')
  return (groups ?? []) as { id: number; name: string }[]
}

// 沖銷憑單自己沒有出款帳戶與組織欄位，一律回溯母付款憑單（payment_account）與其申請單（處/課別）
type VoucherPaymentRef = {
  payment_account: string | null
  name: string | null
  expense_item: string | null
  payment_method: string | null
  approved_amount: number | null
  amount: number | null
  extra_data: Record<string, string> | null
  purchase_order_number: string | null
  funds_allocation: AllocOrgRef
} | null
type VoucherWeekRaw = {
  id: number
  status: string
  current_step: number | null
  created_by: string
  applicant: string | null
  funds_payment: VoucherPaymentRef
  approval_flow_templates: { name: string; approval_flow_steps: StepRef[] } | null
} & Record<string, unknown>

const VOUCHER_PAYMENT_SELECT =
  'payment_account, name, expense_item, payment_method, approved_amount, amount, extra_data, purchase_order_number, funds_allocation:funds_allocation_id(apply_division_id, apply_section_id)'

// 沖銷憑單列表列的共同後製：解析申請人英文名、步驟名、is_pending_here、並攤平母付款憑單資訊
async function mapVoucherRows(
  filtered: VoucherWeekRaw[],
  isPendingHereFn: (r: VoucherWeekRaw, currentStepDef: StepRef | undefined) => boolean
) {
  const emailMap = await resolvePendingNames(filtered as unknown as PendingRaw[])
  return filtered.map(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const currentStepDef = steps.find(s => s.step_number === r.current_step)
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by),
      payment_account: r.funds_payment?.payment_account ?? null,
      step_name: r.status === 'pending'
        ? (currentStepDef?.step_name ?? `第 ${r.current_step ?? 1} 步`)
        : undefined,
      total_steps: steps.length,
      is_pending_here: isPendingHereFn(r, currentStepDef),
    }
  })
}

export async function getVouchersForOrgRoleByWeek(userId: number, weekStart: string, weekEnd: string) {
  const reviewerInfo = await getReviewerInfo(userId)
  const { data } = await supabase
    .from('temp_vouchers')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT})), funds_payment:funds_payment_id(${VOUCHER_PAYMENT_SELECT})`)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date', { ascending: false })

  const candidates = ((data ?? []) as unknown as VoucherWeekRaw[]).flatMap(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const matching = steps.filter(s =>
      s.reviewer_type === 'org_role' &&
      stepMatchesReviewer(s, reviewerInfo, {
        applyDivisionId: r.funds_payment?.funds_allocation?.apply_division_id,
        applySectionId: r.funds_payment?.funds_allocation?.apply_section_id,
      })
    )
    if (matching.length === 0) return []
    return [{ row: r, myStep: Math.min(...matching.map(s => s.step_number)) }]
  })

  const filtered = await filterReached('temp_voucher_id', candidates)

  return mapVoucherRows(filtered, (r, currentStepDef) =>
    r.status === 'pending' &&
    currentStepDef?.reviewer_type === 'org_role' &&
    stepMatchesReviewer(currentStepDef, reviewerInfo, {
      applyDivisionId: r.funds_payment?.funds_allocation?.apply_division_id,
      applySectionId: r.funds_payment?.funds_allocation?.apply_section_id,
    })
  )
}

export async function getVouchersForApprovalGroupByWeek(userId: number | null | undefined, groupId: number, weekStart: string, weekEnd: string) {
  // 群組 Tab 的「審核」按鈕只給實際群組成員，與審核頁 checkCanReviewStep 一致（非成員看到「查閱」）
  const { data: groupMembers } = await supabase
    .from('approval_group_members').select('user_id').eq('group_id', groupId)
  const isGroupMember = userId != null && (groupMembers ?? []).some(m => Number(m.user_id) === Number(userId))

  const { data } = await supabase
    .from('temp_vouchers')
    .select(`*, approval_flow_templates(name, approval_flow_steps(${STEP_SELECT})), funds_payment:funds_payment_id(${VOUCHER_PAYMENT_SELECT})`)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date', { ascending: false })

  const candidates = ((data ?? []) as unknown as VoucherWeekRaw[]).flatMap(r => {
    const steps = r.approval_flow_templates?.approval_flow_steps ?? []
    const matching = steps.filter(s => s.reviewer_type === 'approval_group' && s.approval_group_id === groupId)
    if (matching.length === 0) return []
    return [{ row: r, myStep: Math.min(...matching.map(s => s.step_number)) }]
  })

  const filtered = await filterReached('temp_voucher_id', candidates)

  return mapVoucherRows(filtered, (r, currentStepDef) =>
    isGroupMember && r.status === 'pending' &&
    currentStepDef?.reviewer_type === 'approval_group' &&
    currentStepDef.approval_group_id === groupId
  )
}

// ── 查詢已被其他範本使用的出款帳號 ───────────────────

export async function getUsedPaymentAccountIds(
  formType: 'funds_allocation' | 'payment_voucher' | 'temp_voucher',
  excludeTemplateId?: number
) {
  let query = supabase
    .from('template_payment_accounts')
    .select('payment_account_option_id, approval_flow_templates!inner(form_type, is_active)')
    .eq('approval_flow_templates.form_type', formType)
    .eq('approval_flow_templates.is_active', true)

  if (excludeTemplateId) {
    query = query.neq('template_id', excludeTemplateId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: { payment_account_option_id: number }) => r.payment_account_option_id)
}

// ── 逐項核准明細 ─────────────────────────────────────

// 取資金分配單「最新一關」的逐項核准明細（建立付款憑單帶入各組核准值用；舊單無逐項資料回傳 null）
export async function getLatestApprovedItems(allocationId: number): Promise<ApprovedItem[] | null> {
  const { data } = await supabase
    .from('approval_records')
    .select('approved_items, step_number')
    .eq('funds_allocation_id', allocationId)
    .eq('decision', 'approved')
    .not('approved_items', 'is', null)
    .order('step_number', { ascending: false })
    .limit(1)
  const items = (data?.[0]?.approved_items ?? null) as ApprovedItem[] | null
  return items?.length ? items : null
}

// ── 付款分類 ─────────────────────────────────────────

// 付款分類選項（財務在支出欄位設定頁維護，dropdown_options field='payment_category'）
export async function getPaymentCategoryOptions(): Promise<string[]> {
  const { data } = await supabase
    .from('dropdown_options')
    .select('label')
    .eq('field', 'payment_category')
    .order('sort_order')
  return (data ?? []).map((r: { label: string }) => r.label)
}

// 取多張付款憑單「最新選定的付款分類」：審核群組步驟核准時加註在審核紀錄，
// 同一張憑單多關都選過時取最後審的那筆（後面關卡可調整前面關卡的選值）
export async function getLatestPaymentCategories(paymentIds: number[]): Promise<Record<number, string>> {
  if (paymentIds.length === 0) return {}
  const { data } = await supabase
    .from('approval_records')
    .select('funds_payment_id, payment_category, reviewed_at')
    .in('funds_payment_id', paymentIds)
    .not('payment_category', 'is', null)
    .order('reviewed_at', { ascending: true })
  const map: Record<number, string> = {}
  for (const r of (data ?? []) as { funds_payment_id: number; payment_category: string | null }[]) {
    if (r.funds_payment_id != null && r.payment_category) map[r.funds_payment_id] = r.payment_category
  }
  return map
}
