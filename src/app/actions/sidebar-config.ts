'use server'

import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'
import { DEFAULT_SIDEBAR_CONFIG, type SidebarCategory } from '@/lib/sidebar-config'

export async function getSidebarConfig(): Promise<SidebarCategory[]> {
  const { data } = await supabase
    .from('sidebar_config')
    .select('config')
    .eq('id', 1)
    .single()

  if (data?.config) return data.config as SidebarCategory[]
  return DEFAULT_SIDEBAR_CONFIG
}

export async function saveSidebarConfig(config: SidebarCategory[]): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('sidebar_config')
    .upsert({ id: 1, config, updated_at: new Date().toISOString() })

  if (error) return { error: '儲存失敗，請稍後再試' }

  revalidatePath('/', 'layout')
  return {}
}

export async function resetSidebarConfig(): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('sidebar_config')
    .upsert({ id: 1, config: null, updated_at: new Date().toISOString() })

  if (error) return { error: '還原失敗，請稍後再試' }

  revalidatePath('/', 'layout')
  return {}
}
