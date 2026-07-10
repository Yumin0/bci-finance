import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getMySession, getUserReviewPermissions } from '@/app/actions/auth'
import {
  getPaymentsForOrgRoleByWeek,
  getPaymentsForApprovalGroupByWeek,
  getPaymentVoucherReviewGroups,
} from '@/app/actions/approval-flow'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { getFormSchemas } from '@/app/actions/form-schema'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { FormSlot } from '@/lib/types'
import {
  getCurrentWeekStart,
  toDateStr,
  getWeekEnd,
  fromDateStr,
  getWeeksForYear,
  getAvailableYears,
} from '@/lib/weekUtils'
import PaymentReviewClient, { type TabDef, type PaymentItem, type HistoryItem } from './PaymentReviewClient'

const getCachedPaymentAccounts = unstable_cache(
  async () => {
    const { data } = await supabase.from('dropdown_options').select('label').eq('field', 'payment_account').order('sort_order')
    return (data ?? []).map((r: { label: string }) => r.label)
  },
  ['payment-accounts'],
  { revalidate: 300 }
)

const getCachedStatusLabelConfig = unstable_cache(
  async () => getStatusLabelConfig(),
  ['status-label-config'],
  { revalidate: 300 }
)

async function getPaymentHistoryForReviewer(userId: number): Promise<HistoryItem[]> {
  const { data } = await supabase
    .from('approval_records')
    .select(`*, funds_payment:funds_payment_id(id, name, amount, status, purchase_order_number, payment_method, extra_data)`)
    .eq('reviewer_id', String(userId))
    .not('decision', 'is', null)
    .not('funds_payment_id', 'is', null)
    .order('reviewed_at', { ascending: false })
    .limit(500)

  // 同一張憑單只留最高步驟的紀錄
  const seen = new Map<number, HistoryItem>()
  for (const r of (data ?? []) as HistoryItem[]) {
    const pid = r.funds_payment_id ?? 0
    const existing = seen.get(pid)
    if (!existing || r.step_number > existing.step_number) seen.set(pid, r)
  }
  return Array.from(seen.values()).sort(
    (a, b) => new Date(b.reviewed_at ?? '').getTime() - new Date(a.reviewed_at ?? '').getTime()
  )
}

export default async function PaymentReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; weekStart?: string }>
}) {
  const session = await getMySession()
  const uid = session?.userId
  if (!uid) redirect('/login')

  const { year: yearParam, weekStart: weekStartParam } = await searchParams

  const nowWeekStart = getCurrentWeekStart()
  const defaultYear = nowWeekStart.getFullYear()
  const defaultWeekStart = toDateStr(nowWeekStart)

  const selectedYear = yearParam ? Number(yearParam) : defaultYear
  const availableYears = getAvailableYears()
  const validYear = availableYears.includes(selectedYear) ? selectedYear : defaultYear

  const weeksForYear = getWeeksForYear(validYear)
  const validWeekStarts = new Set(weeksForYear.map(toDateStr))

  let selectedWeekStart = weekStartParam ?? defaultWeekStart
  if (!validWeekStarts.has(selectedWeekStart)) {
    selectedWeekStart = toDateStr(weeksForYear[weeksForYear.length - 1] ?? weeksForYear[0])
  }

  const selectedWeekEnd = toDateStr(getWeekEnd(fromDateStr(selectedWeekStart)))

  const [permRes, reviewGroups, paymentAccounts, labelConfig, schemas, historyItems] = await Promise.all([
    getUserReviewPermissions(uid),
    getPaymentVoucherReviewGroups(),
    getCachedPaymentAccounts(),
    getCachedStatusLabelConfig(),
    getFormSchemas(),
    getPaymentHistoryForReviewer(uid),
  ])

  const payeeLabel = schemas.payment_voucher
    .flatMap(b => b.rows.flatMap(r => r.slots))
    .find((s): s is NonNullable<FormSlot> => s !== null && s.dataSource?.startsWith('payee_records:') === true)
    ?.label ?? null

  const { isAdmin, allowedItemIds } = permRes
  const permSet = new Set(allowedItemIds)
  const canSee = (id: string) => isAdmin || permSet.has(id)

  const visibleTabs: TabDef[] = []
  if (canSee('fp-review-div')) visibleTabs.push({ key: 'div', label: '課、處長審核' })
  if (canSee('fp-review-group')) {
    for (const g of reviewGroups) visibleTabs.push({ key: `group-${g.id}`, label: g.name })
  }
  visibleTabs.push({ key: 'history', label: '我的審核紀錄' })

  const activeTabs = visibleTabs.filter(t => t.key !== 'history')

  const tabItemResults = await Promise.all(
    activeTabs.map(tab =>
      tab.key === 'div'
        ? getPaymentsForOrgRoleByWeek(uid, selectedWeekStart, selectedWeekEnd)
        : getPaymentsForApprovalGroupByWeek(Number(tab.key.replace('group-', '')), selectedWeekStart, selectedWeekEnd)
    )
  )

  const tabItems = Object.fromEntries(
    activeTabs.map((tab, i) => [tab.key, tabItemResults[i] as unknown as PaymentItem[]])
  ) as Record<string, PaymentItem[]>

  return (
    <PaymentReviewClient
      visibleTabs={visibleTabs}
      tabItems={tabItems}
      historyItems={historyItems}
      paymentAccounts={paymentAccounts}
      labelConfig={labelConfig}
      payeeLabel={payeeLabel}
      selectedYear={validYear}
      selectedWeekStart={selectedWeekStart}
    />
  )
}
