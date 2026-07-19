'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { FundAttachment } from '@/lib/types'

function withPublicUrl(row: Omit<FundAttachment, 'url'>): FundAttachment {
  const proxyUrl = `/api/attachment?path=${encodeURIComponent(row.storage_path)}`
  return { ...row, url: proxyUrl }
}

export async function getAttachmentsByAllocationId(allocationId: number): Promise<FundAttachment[]> {
  const { data, error } = await supabase
    .from('fund_attachments')
    .select('*')
    .eq('funds_allocation_id', allocationId)
    .order('created_at')
  if (error || !data) return []
  return (data as Omit<FundAttachment, 'url'>[]).map(withPublicUrl)
}

export async function getAttachmentsByPaymentId(paymentId: number): Promise<FundAttachment[]> {
  const { data, error } = await supabase
    .from('fund_attachments')
    .select('*')
    .eq('funds_payment_id', paymentId)
    .order('created_at')
  if (error || !data) return []
  return (data as Omit<FundAttachment, 'url'>[]).map(withPublicUrl)
}

export async function saveAttachments(
  allocationId: number | null,
  paymentId: number | null,
  items: { slotLabel: string; fileName: string; storagePath: string; fileType: string; uploadedBy?: string }[],
  tempVoucherId?: number | null,
): Promise<{ error?: string }> {
  if (!items.length) return {}
  const rows = items.map(i => ({
    funds_allocation_id: allocationId,
    funds_payment_id: paymentId,
    temp_voucher_id: tempVoucherId ?? null,
    slot_label: i.slotLabel,
    file_name: i.fileName,
    storage_path: i.storagePath,
    file_type: i.fileType,
    uploaded_by: i.uploadedBy ?? null,
  }))
  const { error } = await supabase.from('fund_attachments').insert(rows)
  if (error) return { error: error.message }
  return {}
}

// 暫付款沖銷頁帶入的上游附件：母付款憑單自己的附件＋再往上一層資金分配申請單的附件
// （沖銷時要對照預支當時傳的所有單據，兩層都要看得到）
export async function getVoucherInheritedAttachments(
  paymentId: number
): Promise<{ fromAllocation: FundAttachment[]; fromPayment: FundAttachment[] }> {
  const { data: payment } = await supabase
    .from('funds_payment')
    .select('funds_allocation_id')
    .eq('id', paymentId)
    .single()
  const [fromPayment, fromAllocation] = await Promise.all([
    getAttachmentsByPaymentId(paymentId),
    payment?.funds_allocation_id ? getAttachmentsByAllocationId(payment.funds_allocation_id) : Promise.resolve([]),
  ])
  return { fromAllocation, fromPayment }
}

export async function getAttachmentsByTempVoucherId(tempVoucherId: number): Promise<FundAttachment[]> {
  const { data, error } = await supabase
    .from('fund_attachments')
    .select('*')
    .eq('temp_voucher_id', tempVoucherId)
    .order('created_at')
  if (error || !data) return []
  return (data as Omit<FundAttachment, 'url'>[]).map(withPublicUrl)
}

export async function deleteAttachmentRecord(id: number): Promise<{ error?: string }> {
  const { error } = await supabase.from('fund_attachments').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}
