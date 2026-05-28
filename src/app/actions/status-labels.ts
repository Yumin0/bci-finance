'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import {
  DEFAULT_STATUS_LABEL_CONFIG,
  mergeStatusLabelConfig,
  type StatusLabelConfig,
} from '@/lib/status-label-config'

export async function getStatusLabelConfig(): Promise<StatusLabelConfig> {
  const { data } = await supabase
    .from('status_label_config')
    .select('config')
    .eq('id', 1)
    .single()

  if (data?.config) return mergeStatusLabelConfig(data.config as Partial<StatusLabelConfig>)
  return DEFAULT_STATUS_LABEL_CONFIG
}

export async function saveStatusLabelConfig(
  config: StatusLabelConfig,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('status_label_config')
    .upsert({ id: 1, config, updated_at: new Date().toISOString() })

  if (error) return { error: '儲存失敗，請稍後再試' }

  revalidatePath('/', 'layout')
  return {}
}
