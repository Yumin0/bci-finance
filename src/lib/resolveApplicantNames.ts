import 'server-only'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { emailToEnglishName } from '@/lib/userNames'

export async function resolveApplicantNames<T extends { created_by: string; applicant?: string | null }>(
  records: T[]
): Promise<T[]> {
  const ids = [
    ...new Set(
      records.map(r => parseInt(r.created_by, 10)).filter(id => !isNaN(id))
    ),
  ]
  if (!ids.length) return records

  const { data: users } = await supabaseAdmin
    .from('app_users')
    .select('id, email')
    .in('id', ids)

  const emailMap = new Map<number, string>(
    (users ?? []).map(u => [u.id as number, u.email as string])
  )

  return records.map(r => {
    const id = parseInt(r.created_by, 10)
    const email = !isNaN(id) ? emailMap.get(id) : undefined
    return {
      ...r,
      applicant: email ? emailToEnglishName(email) : (r.applicant ?? r.created_by),
    }
  })
}
