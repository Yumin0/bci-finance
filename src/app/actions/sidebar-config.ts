'use server'

import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'
import { DEFAULT_SIDEBAR_CONFIG, type SidebarCategory, type SidebarEntry } from '@/lib/sidebar-config'

function mergeWithDefaults(saved: SidebarCategory[]): SidebarCategory[] {
  const result = saved.map(savedCat => {
    const defaultCat = DEFAULT_SIDEBAR_CONFIG.find(d => d.id === savedCat.id)
    if (!defaultCat) return savedCat

    const savedIds = new Set(
      savedCat.entries.flatMap(e =>
        e.kind === 'item' ? [e.id] : [e.id, ...e.items.map(i => i.id)]
      )
    )

    const missingEntries = defaultCat.entries.filter(e =>
      e.kind === 'item'
        ? !savedIds.has(e.id)
        : !savedIds.has(e.id) && e.items.every(i => !savedIds.has(i.id))
    )

    return missingEntries.length > 0
      ? { ...savedCat, entries: [...savedCat.entries, ...missingEntries] }
      : savedCat
  })

  const savedCatIds = new Set(saved.map(c => c.id))
  const missingCats = DEFAULT_SIDEBAR_CONFIG.filter(c => !savedCatIds.has(c.id))

  return [...result, ...missingCats]
}

export async function getSidebarConfig(): Promise<SidebarCategory[]> {
  const { data } = await supabase
    .from('sidebar_config')
    .select('config')
    .eq('id', 1)
    .single()

  if (data?.config) return mergeWithDefaults(data.config as SidebarCategory[])
  return DEFAULT_SIDEBAR_CONFIG
}

async function getUserAllowedItemIds(userId: number): Promise<string[] | 'all'> {
  const { data: user } = await supabase
    .from('app_users')
    .select('system_role_id')
    .eq('id', userId)
    .single()

  if (user?.system_role_id) {
    const { data: role } = await supabase
      .from('system_roles')
      .select('is_admin, allowed_item_ids')
      .eq('id', user.system_role_id)
      .single()
    if (role?.is_admin) return 'all'
    if (role) return role.allowed_item_ids as string[]
  }

  const { data: positions } = await supabase
    .from('user_positions')
    .select('org_unit_role_id')
    .eq('user_id', userId)

  if (!positions?.length) return []

  const orgUnitRoleIds = positions.map((p: { org_unit_role_id: number }) => p.org_unit_role_id)
  const { data: orgUnitRoles } = await supabase
    .from('org_unit_roles')
    .select('role_type_id')
    .in('id', orgUnitRoleIds)

  if (!orgUnitRoles?.length) return []

  const roleTypeIds = orgUnitRoles.map((r: { role_type_id: number }) => r.role_type_id)
  const { data: srrt } = await supabase
    .from('system_role_role_types')
    .select('system_role_id')
    .in('role_type_id', roleTypeIds)

  if (!srrt?.length) return []

  const systemRoleIds = [...new Set(srrt.map((r: { system_role_id: number }) => r.system_role_id))]
  const { data: systemRoles } = await supabase
    .from('system_roles')
    .select('is_admin, allowed_item_ids')
    .in('id', systemRoleIds)

  if (systemRoles?.some((r: { is_admin: boolean }) => r.is_admin)) return 'all'

  const allAllowed = systemRoles?.flatMap((r: { allowed_item_ids: string[] }) => r.allowed_item_ids) ?? []
  return [...new Set(allAllowed)] as string[]
}

function filterSidebarConfig(config: SidebarCategory[], allowedIds: string[]): SidebarCategory[] {
  const allowed = new Set(allowedIds)
  return config
    .map(category => ({
      ...category,
      entries: category.entries
        .map((entry: SidebarEntry) => {
          if (entry.kind === 'item') return allowed.has(entry.id) ? entry : null
          const filteredItems = entry.items.filter(item => allowed.has(item.id))
          return filteredItems.length > 0 ? { ...entry, items: filteredItems } : null
        })
        .filter((e): e is SidebarEntry => e !== null),
    }))
    .filter(cat => cat.entries.length > 0)
}

export async function getSidebarConfigForUser(userId: number): Promise<SidebarCategory[]> {
  const [config, allowedIds] = await Promise.all([
    getSidebarConfig(),
    getUserAllowedItemIds(userId),
  ])
  if (allowedIds === 'all') return config
  return filterSidebarConfig(config, allowedIds)
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
