'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { FundAttachment } from '@/lib/types'

function withPublicUrl(row: Omit<FundAttachment, 'url'>): FundAttachment {
  const { data: { publicUrl } } = supabase.storage
    .from('fund-attachments')
    .getPublicUrl(row.storage_path)
  return { ...row, url: publicUrl }
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
  items: { slotLabel: string; fileName: string; storagePath: string; fileType: string; uploadedBy?: string }[]
): Promise<{ error?: string }> {
  if (!items.length) return {}
  const rows = items.map(i => ({
    funds_allocation_id: allocationId,
    funds_payment_id: paymentId,
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

export async function deleteAttachmentRecord(id: number): Promise<{ error?: string }> {
  const { error } = await supabase.from('fund_attachments').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}
