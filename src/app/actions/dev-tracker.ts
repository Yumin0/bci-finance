'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { Block } from '@/lib/types'

export type IssueFormState = { error?: string; success?: boolean } | undefined

export async function submitIssue(
  _prev: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  const type = formData.get('type') as string
  const title = (formData.get('title') as string)?.trim()
  const priority = formData.get('priority') as string
  const module = (formData.get('module') as string)?.trim() || null
  const beforeDescription = (formData.get('before_description') as string)?.trim() || null

  if (!type || !['improvement', 'feature', 'bug', 'performance'].includes(type)) return { error: '請選擇問題類型' }
  if (!title) return { error: '請填寫標題' }

  // Strip HTML tags to generate plain-text preview for the list view
  const plainText = beforeDescription
    ? beforeDescription.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null
    : null

  const { error } = await supabase
    .from('dev_tracker')
    .insert({
      type,
      title,
      description: plainText,
      before_description: beforeDescription,
      priority,
      module,
      created_by: session.userId,
      status: 'pending',
    })

  if (error) return { error: '提交失敗，請稍後再試' }

  revalidatePath('/report-issue')
  return { success: true }
}

export async function updateIssueType(id: number, type: string): Promise<{ error?: string }> {
  if (!['improvement', 'feature', 'bug', 'performance'].includes(type)) return { error: '無效類型' }
  const { error } = await supabase
    .from('dev_tracker')
    .update({ type, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: '更新失敗' }
  revalidatePath(`/report-issue/${id}`)
  revalidatePath('/report-issue')
  return {}
}

export async function updateIssueStatus(id: number, status: string): Promise<{ error?: string }> {
  const completed_at = status === 'completed' ? new Date().toISOString() : null
  const { error } = await supabase
    .from('dev_tracker')
    .update({ status, completed_at, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: '更新失敗' }

  revalidatePath('/report-issue')
  return {}
}

export async function assignIssue(id: number, assignedTo: number | null): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('dev_tracker')
    .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: '更新失敗' }

  revalidatePath('/report-issue')
  return {}
}

export async function saveHtml(
  id: number,
  side: 'before' | 'after',
  html: string,
): Promise<{ error?: string }> {
  const patch = side === 'before'
    ? { before_description: html }
    : { after_description: html }

  const { error } = await supabase
    .from('dev_tracker')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: '儲存失敗' }

  revalidatePath(`/report-issue/${id}`)
  revalidatePath('/report-issue')
  return {}
}

export async function saveBlocks(
  id: number,
  side: 'before' | 'after',
  blocks: Block[],
): Promise<{ error?: string }> {
  const patch = side === 'before' ? { before_blocks: blocks } : { after_blocks: blocks }

  const { error } = await supabase
    .from('dev_tracker')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: '儲存失敗，請稍後再試' }

  revalidatePath(`/report-issue/${id}`)
  revalidatePath('/report-issue')
  return {}
}

export async function updateBeforeAfter(
  id: number,
  side: 'before' | 'after',
  description: string | null,
  images: string[],
): Promise<{ error?: string }> {
  const patch =
    side === 'before'
      ? { before_description: description, before_images: images }
      : { after_description: description, after_images: images }

  const completedPatch =
    side === 'after' ? { completed_at: description ? new Date().toISOString() : null } : {}

  const { error } = await supabase
    .from('dev_tracker')
    .update({ ...patch, ...completedPatch, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: '儲存失敗，請稍後再試' }

  revalidatePath(`/report-issue/${id}`)
  revalidatePath('/report-issue')
  return {}
}
