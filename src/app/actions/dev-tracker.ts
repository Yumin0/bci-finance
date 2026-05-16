'use server'

import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/session'

export type IssueFormState = { error?: string; success?: boolean } | undefined

export async function submitIssue(
  _prev: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  const type = formData.get('type') as string
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const priority = formData.get('priority') as string
  const module = (formData.get('module') as string)?.trim() || null

  if (!type || !['bug', 'feature'].includes(type)) return { error: '請選擇問題類型' }
  if (!title) return { error: '請填寫標題' }

  const { error } = await supabase.from('dev_tracker').insert({
    type,
    title,
    description,
    priority,
    module,
    created_by: session.userId,
    status: 'pending',
  })

  if (error) return { error: '提交失敗，請稍後再試' }

  revalidatePath('/report-issue')
  return { success: true }
}

export async function updateIssueStatus(id: number, status: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('dev_tracker')
    .update({ status, updated_at: new Date().toISOString() })
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
