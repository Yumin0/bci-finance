import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getMySession, getUserReviewPermissions } from '@/app/actions/auth'
import {
  getVouchersForOrgRoleByWeek,
  getVouchersForApprovalGroupByWeek,
  getTempVoucherReviewGroups,
} from '@/app/actions/approval-flow'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { getFormSchemas } from '@/app/actions/form-schema'
import { getAttachmentsByTempVoucherIds } from '@/app/actions/attachments'
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
import VoucherReviewClient, { type TabDef, type VoucherItem, type HistoryItem, type VoucherAttachmentMap } from './VoucherReviewClient'

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

// 沖銷憑單自己沒有描述欄，一律回溯母付款憑單；歷史紀錄同樣攤平母付款憑單資訊供 9 欄顯示
async function getVoucherHistoryForReviewer(userId: number): Promise<HistoryItem[]> {
  const { data } = await supabase
    .from('approval_records')
    .select(`*, temp_voucher:temp_voucher_id(id, serial_number, amount, status, funds_payment:funds_payment_id(payment_account, name, expense_item, payment_method, approved_amount, extra_data))`)
    .eq('reviewer_id', String(userId))
    .not('decision', 'is', null)
    .not('temp_voucher_id', 'is', null)
    .order('reviewed_at', { ascending: false })
    .limit(500)

  // 同一張沖銷憑單只留最高步驟的紀錄
  const seen = new Map<number, HistoryItem>()
  for (const r of (data ?? []) as unknown as HistoryItem[]) {
    const vid = r.temp_voucher_id ?? 0
    const existing = seen.get(vid)
    if (!existing || r.step_number > existing.step_number) seen.set(vid, r)
  }
  return Array.from(seen.values()).sort(
    (a, b) => new Date(b.reviewed_at ?? '').getTime() - new Date(a.reviewed_at ?? '').getTime()
  )
}

export default async function VoucherReviewPage({
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
    getTempVoucherReviewGroups(),
    getCachedPaymentAccounts(),
    getCachedStatusLabelConfig(),
    getFormSchemas(),
    getVoucherHistoryForReviewer(uid),
  ])

  // 沖銷憑單的「付款對象」實際存於母付款憑單 extra_data，以付款憑單表單的受款人欄位 label 取值
  const payeeLabel = schemas.payment_voucher
    .flatMap(b => b.rows.flatMap(r => r.slots))
    .find((s): s is NonNullable<FormSlot> => s !== null && s.dataSource?.startsWith('payee_records:') === true)
    ?.label ?? null

  const { isAdmin, allowedItemIds } = permRes
  const permSet = new Set(allowedItemIds)
  const canSee = (id: string) => isAdmin || permSet.has(id)

  const visibleTabs: TabDef[] = []
  if (canSee('fv-review-div')) visibleTabs.push({ key: 'div', label: '課、處長審核' })
  if (canSee('fv-review-group')) {
    for (const g of reviewGroups) visibleTabs.push({ key: `group-${g.id}`, label: g.name })
  }
  visibleTabs.push({ key: 'history', label: '我的審核紀錄' })

  const activeTabs = visibleTabs.filter(t => t.key !== 'history')

  const tabItemResults = await Promise.all(
    activeTabs.map(tab =>
      tab.key === 'div'
        ? getVouchersForOrgRoleByWeek(uid, selectedWeekStart, selectedWeekEnd)
        : getVouchersForApprovalGroupByWeek(uid, Number(tab.key.replace('group-', '')), selectedWeekStart, selectedWeekEnd)
    )
  )

  const tabItems = Object.fromEntries(
    activeTabs.map((tab, i) => [tab.key, tabItemResults[i] as unknown as VoucherItem[]])
  ) as Record<string, VoucherItem[]>

  // 「發票憑證」欄：一次撈所有列到的沖銷憑單附件
  const attachmentVoucherIds = Array.from(new Set([
    ...Object.values(tabItems).flatMap(items => items.map(r => r.id)),
    ...historyItems.map(h => h.temp_voucher?.id).filter((id): id is number => id != null),
  ]))
  const attachmentsMap = (await getAttachmentsByTempVoucherIds(attachmentVoucherIds)) as unknown as VoucherAttachmentMap

  return (
    <VoucherReviewClient
      visibleTabs={visibleTabs}
      tabItems={tabItems}
      historyItems={historyItems}
      paymentAccounts={paymentAccounts}
      labelConfig={labelConfig}
      payeeLabel={payeeLabel}
      attachmentsMap={attachmentsMap}
      selectedYear={validYear}
      selectedWeekStart={selectedWeekStart}
    />
  )
}
