'use server'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type UpdateState =
  | { errors?: { name?: string[]; email?: string[]; password?: string[] }; message?: string }
  | undefined

export async function updateAccount(userId: number, _state: UpdateState, formData: FormData): Promise<UpdateState> {
  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = (formData.get('password') as string) || ''

  if (!name || name.length < 2) {
    return { errors: { name: ['姓名至少需要 2 個字元'] } }
  }
  if (!email || !email.includes('@')) {
    return { errors: { email: ['請輸入有效的 Email'] } }
  }
  if (password && password.length < 6) {
    return { errors: { password: ['密碼至少需要 6 個字元'] } }
  }

  const { data: existing } = await supabase
    .from('app_users')
    .select('id')
    .eq('email', email)
    .neq('id', userId)
    .single()

  if (existing) {
    return { errors: { email: ['此 Email 已被其他帳號使用'] } }
  }

  const updates: Record<string, unknown> = { name, email, updated_at: new Date().toISOString() }
  if (password) {
    updates.password_hash = await bcrypt.hash(password, 10)
  }

  const { error } = await supabase
    .from('app_users')
    .update(updates)
    .eq('id', userId)

  if (error) {
    return { message: '儲存失敗，請稍後再試' }
  }

  redirect('/system-settings/account-management')
}

type CreateState =
  | { errors?: { name?: string[]; email?: string[]; password?: string[] }; message?: string }
  | undefined

export async function createAccount(_state: CreateState, formData: FormData): Promise<CreateState> {
  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string

  if (!name || name.length < 2) {
    return { errors: { name: ['姓名至少需要 2 個字元'] } }
  }
  if (!email || !email.includes('@')) {
    return { errors: { email: ['請輸入有效的 Email'] } }
  }
  if (!password || password.length < 6) {
    return { errors: { password: ['密碼至少需要 6 個字元'] } }
  }

  const { data: existing } = await supabase
    .from('app_users')
    .select('id')
    .eq('email', email)
    .single()

  if (existing) {
    return { errors: { email: ['此 Email 已被使用'] } }
  }

  const password_hash = await bcrypt.hash(password, 10)

  const { error } = await supabase
    .from('app_users')
    .insert({ name, email, password_hash })

  if (error) {
    return { message: '建立失敗，請稍後再試' }
  }

  redirect('/system-settings/account-management')
}
