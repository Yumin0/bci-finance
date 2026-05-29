'use server'

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export type ApplicationCycleConfig = {
  allowed_weekdays: number[]  // 0=日, 1=一, 2=二, 3=三, 4=四, 5=五, 6=六
  weeks_ahead: number
}

export async function getApplicationCycleConfig(): Promise<ApplicationCycleConfig> {
  try {
    const { data, error } = await supabase
      .from('application_cycle_config')
      .select('allowed_weekdays, weeks_ahead')
      .eq('id', 1)
      .single()
    if (error || !data) return { allowed_weekdays: [], weeks_ahead: 3 }
    return data as ApplicationCycleConfig
  } catch {
    return { allowed_weekdays: [], weeks_ahead: 3 }
  }
}

export async function saveApplicationCycleConfig(
  config: ApplicationCycleConfig
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('application_cycle_config')
    .update({ allowed_weekdays: config.allowed_weekdays, weeks_ahead: config.weeks_ahead })
    .eq('id', 1)
  if (error) return { error: `儲存失敗：${error.message}` }
  return {}
}
