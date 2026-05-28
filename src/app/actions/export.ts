'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { FundsAllocation, FundsPayment } from '@/lib/types'

export type FundsAllocationExportRow = FundsAllocation & {
  approval_flow_templates: { name: string; approval_flow_steps: Array<{ step_name: string; step_number: number }> } | null
}

export async function getFundsAllocationForExport(filters: {
  dateFrom?: string
  dateTo?: string
  applicant?: string
  status?: string
}): Promise<{ data: FundsAllocationExportRow[] | null; error: string | null }> {
  let query = supabase
    .from('funds_allocation')
    .select(`*, approval_flow_templates(name, approval_flow_steps(step_name, step_number))`)
    .order('created_at', { ascending: false })

  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom + 'T00:00:00')
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59')
  if (filters.applicant?.trim()) query = query.ilike('applicant', `%${filters.applicant.trim()}%`)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) return { data: null, error: error.message }
  return { data: data as FundsAllocationExportRow[], error: null }
}

export type PaymentExportRow = FundsPayment & {
  approval_flow_templates: { name: string; approval_flow_steps: Array<{ step_name: string; step_number: number }> } | null
}

export async function getPaymentForExport(filters: {
  dateFrom?: string
  dateTo?: string
  applicant?: string
  status?: string
}): Promise<{ data: PaymentExportRow[] | null; error: string | null }> {
  let query = supabase
    .from('funds_payment')
    .select(`*, approval_flow_templates(name, approval_flow_steps(step_name, step_number))`)
    .order('created_at', { ascending: false })

  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom + 'T00:00:00')
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59')
  if (filters.applicant?.trim()) query = query.ilike('applicant', `%${filters.applicant.trim()}%`)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) return { data: null, error: error.message }
  return { data: data as PaymentExportRow[], error: null }
}

export type TempVoucherExportRow = {
  id: number
  funds_payment_id: number
  date: string | null
  apply_section: string | null
  applicant: string | null
  amount: number | null
  status: string
  current_step: number | null
  created_at: string
  approval_flow_templates: { name: string; approval_flow_steps: Array<{ step_name: string; step_number: number }> } | null
}

export async function getTempVoucherForExport(filters: {
  dateFrom?: string
  dateTo?: string
  applicant?: string
  status?: string
}): Promise<{ data: TempVoucherExportRow[] | null; error: string | null }> {
  let query = supabase
    .from('temp_vouchers')
    .select(`*, approval_flow_templates(name, approval_flow_steps(step_name, step_number))`)
    .order('created_at', { ascending: false })

  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom + 'T00:00:00')
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59')
  if (filters.applicant?.trim()) query = query.ilike('applicant', `%${filters.applicant.trim()}%`)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) return { data: null, error: error.message }
  return { data: data as TempVoucherExportRow[], error: null }
}
