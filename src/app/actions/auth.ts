'use server'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { createSession, deleteSession, getSession } from '@/lib/session'
import { safeReturnUrl } from '@/lib/returnUrl'

export async function getMySession() {
  const session = await getSession()
  return { userId: session?.userId ?? null, name: session?.name ?? null, email: session?.email ?? null }
}

export async function getUserReviewPermissions(userId: number): Promise<{ isAdmin: boolean; allowedItemIds: string[] }> {
  const { data: user } = await supabase
    .from('app_users')
    .select('system_role_id')
    .eq('id', userId)
    .single()
  if (!user?.system_role_id) return { isAdmin: false, allowedItemIds: [] }
  const { data: role } = await supabase
    .from('system_roles')
    .select('is_admin, allowed_item_ids')
    .eq('id', user.system_role_id)
    .single()
  if (!role) return { isAdmin: false, allowedItemIds: [] }
  return {
    isAdmin: role.is_admin as boolean,
    allowedItemIds: (role.allowed_item_ids as string[]) ?? [],
  }
}

export type LoginState =
  | { error?: string }
  | undefined

export async function login(state: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: '請填寫帳號與密碼' }
  }

  const { data: user, error } = await supabase
    .from('app_users')
    .select('id, name, email, password_hash')
    .eq('email', email)
    .single()

  if (error || !user) {
    return { error: '帳號或密碼錯誤' }
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return { error: '帳號或密碼錯誤' }
  }

  await createSession(user.id, user.name, user.email)
  // 從分享連結被導來登入時跳回原頁（登入頁 hidden input 帶入，僅接受站內路徑）
  redirect(safeReturnUrl(formData.get('returnUrl') as string | null) ?? '/')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}

export type RegisterState =
  | { errors?: { email?: string[]; password?: string[]; name?: string[] }; message?: string }
  | undefined

export async function register(state: RegisterState, formData: FormData): Promise<RegisterState> {
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

  const { data: user, error } = await supabase
    .from('app_users')
    .insert({ name, email, password_hash })
    .select('id, name')
    .single()

  if (error || !user) {
    return { message: '建立帳號失敗，請稍後再試' }
  }

  await createSession(user.id, user.name, email)
  redirect('/')
}
