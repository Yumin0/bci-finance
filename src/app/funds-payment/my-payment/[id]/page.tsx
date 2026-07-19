'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsPayment, ApprovalRecord, FormBlock, FundAttachment } from '@/lib/types'
import { PAYMENT_STATUS } from '@/lib/constants'
import { deleteDraftPayment } from '@/app/actions/payment'
import { useConfirm } from '@/app/_components/useConfirm'
import { getAllocationRemainingInfo, type AllocationRemainingInfo } from '@/app/actions/fund-budget'
import AllocationSummaryCard from '@/app/_components/AllocationSummaryCard'
import { getFormSchemas } from '@/app/actions/form-schema'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { DEFAULT_STATUS_LABEL_CONFIG, type StatusLabelConfig } from '@/lib/status-label-config'
import { getAttachmentsByAllocationId, getAttachmentsByPaymentId } from '@/app/actions/attachments'
import FundsPaymentDetail from '@/app/funds-payment/_components/FundsPaymentDetail'
import PaymentEditForm from '@/app/funds-payment/_components/PaymentEditForm'
import StatusBadge from '@/app/_components/StatusBadge'
import ShareLinkButton from '@/app/_components/ShareLinkButton'
import ReviewProgressBlock, { type ReviewStepDef } from '@/app/_components/ReviewProgressBlock'
import ErrorDialog from '@/app/_components/ErrorDialog'
import { Button, buttonVariants } from '@/components/ui/button'

type RecordWithTemplate = FundsPayment & {
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ id: number; step_name: string; step_number: number; reviewer_type?: string }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [confirm, confirmDialog] = useConfirm()
  const [record, setRecord] = useState<RecordWithTemplate | null>(null)
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([])
  const [reviewerNames, setReviewerNames] = useState<Record<string, string>>({})
  const [schema, setSchema] = useState<FormBlock[]>([])
  const [labelConfig, setLabelConfig] = useState<StatusLabelConfig>(DEFAULT_STATUS_LABEL_CONFIG)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  // 草稿編輯中的即時金額（PaymentEditForm 回報），供對照卡片的「本次填寫金額」試算
  const [grandTotal, setGrandTotal] = useState(0)
  const [remainingInfo, setRemainingInfo] = useState<AllocationRemainingInfo | null>(null)
  // 已存在的「活的」沖銷憑單（草稿/審核中/已核准）；有值時不再顯示「建立暫付款沖銷憑單」按鈕
  const [existingTempVoucher, setExistingTempVoucher] = useState<{ id: number; serial_number: string | null; status: string } | null>(null)

  // 非草稿唯讀顯示用附件（草稿編輯的附件由 PaymentEditForm 自行載入管理）
  const [inheritedAttachments, setInheritedAttachments] = useState<FundAttachment[]>([])
  const [ownAttachmentRows, setOwnAttachmentRows] = useState<FundAttachment[]>([])

  useEffect(() => {
    async function load() {
      const { id } = await params
      const numId = Number(id)

      const [[recordRes, histRes, config], schemas] = await Promise.all([
        Promise.all([
          supabase.from('funds_payment')
            .select(`*, approval_flow_templates(name, approval_flow_steps(id, step_name, step_number, reviewer_type)), approval_records!funds_payment_id(step_name, decision)`)
            .eq('id', numId).single(),
          supabase.from('approval_records')
            .select('*').eq('funds_payment_id', numId).order('step_number'),
          getStatusLabelConfig(),
        ]),
        getFormSchemas(),
      ])

      const { data, error: fetchError } = recordRes
      if (fetchError || !data) { setNotFound(true); setLoading(false); return }

      const rec = data as RecordWithTemplate
      setRecord(rec)
      const histRecords = (histRes.data as ApprovalRecord[]) ?? []
      setApprovalHistory(histRecords)
      setLabelConfig(config)
      setSchema(schemas.payment_voucher)

      // 審核進度共用元件：已完成階段顯示審核人名（key = reviewer_id）
      const reviewerIds = histRecords
        .map(r => r.reviewer_id)
        .filter((rid): rid is string => !!rid && !isNaN(Number(rid)))
      if (reviewerIds.length > 0) {
        const { data: users } = await supabase
          .from('app_users')
          .select('id, name')
          .in('id', reviewerIds.map(Number))
        const names: Record<string, string> = {}
        for (const u of users ?? []) names[String(u.id)] = u.name
        setReviewerNames(names)
      }

      // 一張付款憑單只能建一張沖銷憑單：查是否已有「活的」沖銷單（草稿/審核中/已核准；退回的不算）
      if (rec.status === PAYMENT_STATUS.PAID && rec.category === '預支') {
        const { data: tv } = await supabase
          .from('temp_vouchers')
          .select('id, serial_number, status')
          .eq('funds_payment_id', numId)
          .neq('status', 'rejected')
          .limit(1)
        if (tv && tv.length > 0) setExistingTempVoucher(tv[0] as { id: number; serial_number: string | null; status: string })
      }

      if (rec.funds_allocation_id) {
        setRemainingInfo(await getAllocationRemainingInfo(rec.funds_allocation_id, rec.id))
        if (rec.status !== PAYMENT_STATUS.DRAFT) {
          getAttachmentsByAllocationId(rec.funds_allocation_id).then(setInheritedAttachments)
        }
      }
      if (rec.status !== PAYMENT_STATUS.DRAFT) {
        getAttachmentsByPaymentId(numId).then(setOwnAttachmentRows)
      }

      setLoading(false)
    }
    load()
  }, [params])

  async function handleDelete() {
    if (!record) return
    if (!(await confirm({ message: '確定要刪除此單據嗎？此操作無法復原。', danger: true, confirmText: '刪除' }))) return
    setSubmitting(true)
    setError(null)
    const { error: deleteError } = await deleteDraftPayment(record.id)
    if (deleteError) { setError(deleteError); setSubmitting(false); return }
    router.push('/funds-payment/my-payment')
  }

  if (loading) return <p>載入中...</p>
  if (notFound) return (
    <div>
      <p style={{ color: '#dc2626' }}>找不到此付款憑單，或你沒有權限檢視。</p>
      <Link href="/funds-payment/my-payment" style={{ fontSize: 14, color: '#2563eb' }}>返回列表</Link>
    </div>
  )

  const isDraft = record!.status === PAYMENT_STATUS.DRAFT

  function getStepName(): string | null {
    const r = record!
    if (r.status === 'pending') {
      return r.approval_flow_templates?.approval_flow_steps?.find(s => s.step_number === r.current_step)?.step_name ?? null
    }
    if (r.status === 'rejected') {
      return r.approval_records?.find(a => a.decision === 'rejected')?.step_name ?? null
    }
    if (r.status === 'approved') {
      const steps = r.approval_flow_templates?.approval_flow_steps ?? []
      return steps.reduce((max, s) => s.step_number > max.step_number ? s : max, steps[0])?.step_name ?? null
    }
    return null
  }

  return (
    <div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Link href="/funds-payment/my-payment" className={buttonVariants({ variant: 'outline' })}>← 返回列表</Link>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>付款憑單</h1>
          {/* 一鍵複製分享連結（列22）：職員複製給主管，連結為中介轉址路由依身份分流；草稿還沒送審沒有分享意義 */}
          {!isDraft && <ShareLinkButton path={`/funds-payment/share/${record!.id}`} />}
          {record!.status === PAYMENT_STATUS.PAID && (
            // 已付款才可匯出列印版（比照筑今）；職員從這裡匯出自己的單、財務從付款憑單管理頁代匯出
            <Link
              href={`/funds-payment/my-payment/${record!.id}/print`}
              target="_blank"
              className={buttonVariants({ variant: 'outline' })}
              style={{ marginLeft: 'auto' }}
            >
              匯出付款憑單
            </Link>
          )}
          {isDraft && (
            <Button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              style={{ marginLeft: 'auto', background: '#dc2626', color: '#fff', border: 'none' }}
            >
              刪除此單據
            </Button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          <span>狀態：</span>
          <StatusBadge module="payment_voucher" status={record!.status} stepName={getStepName()} labelConfig={labelConfig} />
          <span>　資金分配申請單 #</span>
          <Link href={`/funds-allocation/my-funds/edit/${record!.funds_allocation_id}`} style={{ color: '#2563eb' }}>
            {record!.funds_allocation_id}
          </Link>
        </div>

        {remainingInfo && (
          <AllocationSummaryCard
            info={remainingInfo}
            remainingLabel="剩餘（不含本張）"
            submitPreview={isDraft ? grandTotal : undefined}
          />
        )}

        {/* 草稿：內嵌可編輯表單（共用元件，審核頁審核人編輯亦同一元件） */}
        {isDraft ? (
          <PaymentEditForm
            record={record!}
            schema={schema}
            mode="draft"
            onGrandTotalChange={setGrandTotal}
          />
        ) : (
          <FundsPaymentDetail
            record={record!}
            schema={schema}
            attachments={ownAttachmentRows}
            inheritedAttachments={inheritedAttachments}
          />
        )}

        {/* 刪除被擋等錯誤改用全站共用中央彈窗（表單內的錯誤由 PaymentEditForm 自行顯示） */}
        <ErrorDialog message={error} title="無法刪除" onClose={() => setError(null)} />
        {confirmDialog}

        {/* 附件已改為顯示在表單各自的附件欄位內（草稿：PaymentEditForm；已送出：FundsPaymentDetail），
            不再有底部的獨立附件區塊——原本它的「本憑單附件」與表單「上傳單據」欄位重複，職員會傳錯位置 */}

        {record!.status === PAYMENT_STATUS.PAID && record!.category === '預支' && (
          <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border-color)' }}>
            {existingTempVoucher ? (
              // 一張付款憑單只能建一張沖銷憑單（退回的不算）：已有活的沖銷單就不顯示建立按鈕，改顯示連結
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                此付款憑單已建立暫付款沖銷憑單：
                <Link href={`/funds-voucher/my-voucher/${existingTempVoucher.id}`} style={{ color: '#2563eb', marginLeft: 4 }}>
                  {existingTempVoucher.serial_number ?? `#${existingTempVoucher.id}`}
                </Link>
              </p>
            ) : (
              <Link href={`/funds-voucher/my-voucher/add/${record!.id}`} className={buttonVariants({ variant: 'default' })}>
                建立暫付款沖銷憑單
              </Link>
            )}
          </div>
        )}
      </div>

      {/* 審核進度：申請人唯讀一列式排版（比照資金分配編輯頁，共用 ReviewProgressBlock） */}
      {record && record.status !== PAYMENT_STATUS.DRAFT && (record.approval_flow_templates?.approval_flow_steps?.length ?? 0) > 0 && (
        <div style={{ marginTop: 40 }}>
          <ReviewProgressBlock
            readOnly
            steps={[...(record.approval_flow_templates!.approval_flow_steps)]
              .sort((a, b) => a.step_number - b.step_number)
              .map(s => ({
                id: s.id,
                step_number: s.step_number,
                step_name: s.step_name,
                reviewer_type: s.reviewer_type as ReviewStepDef['reviewer_type'],
              }))}
            pastRecords={approvalHistory}
            currentStep={record.current_step}
            status={record.status}
            canReview={false}
            showApprovedAmount
            reviewerNames={reviewerNames}
            completionMessages={{
              approved: '✓ 此憑單已全數核准',
              paid: '✓ 此憑單已全數核准（已付款）',
              rejected: '✗ 此憑單已被退回',
            }}
          />
        </div>
      )}
    </div>
  )
}
