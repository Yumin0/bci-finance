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

// 一次撈多張付款憑單的附件，回傳「付款憑單 id → 附件陣列」對照表（列表頁用）
export async function getAttachmentsByPaymentIds(
  paymentIds: number[]
): Promise<Record<number, FundAttachment[]>> {
  if (paymentIds.length === 0) return {}
  const { data, error } = await supabase
    .from('fund_attachments')
    .select('*')
    .in('funds_payment_id', paymentIds)
    .order('created_at')
  if (error || !data) return {}
  const map: Record<number, FundAttachment[]> = {}
  for (const row of data as Omit<FundAttachment, 'url'>[]) {
    const withUrl = withPublicUrl(row)
    if (withUrl.funds_payment_id == null) continue
    ;(map[withUrl.funds_payment_id] ??= []).push(withUrl)
  }
  return map
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
