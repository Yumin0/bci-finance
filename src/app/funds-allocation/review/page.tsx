import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getMySession, getUserReviewPermissions } from '@/app/actions/auth'
import {
  getPendingAllocationsForOrgRole,
  getPendingAllocationsByApprovalGroup,
  getApprovalHistoryForReviewer,
} from '@/app/actions/approval-flow'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { getWeeklyBudgetSummary, getGroupReachedTotals } from '@/app/actions/fund-budget'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getCurrentWeekStart, toDateStr } from '@/lib/weekUtils'
import ReviewPageClient, { type ReviewTab, type AllocationItem, type HistoryItem } from './ReviewPageClient'

const TAB_PERMISSION_IDS: Partial<Record<ReviewTab, string>> = {
  div: 'fa-review-div',
  advisory: 'fa-review-advisory',
  executive: 'fa-review-executive',
  cfo: 'fa-review-cfo',
}

const GROUP_NAMES: Partial<Record<ReviewTab, string>> = {
  advisory: '諮詢議會',
  executive: '主管議會',
  cfo: '財務長',
}

const GROUP_TABS = ['advisory', 'executive', 'cfo'] as const

const getCachedApprovalGroups = unstable_cache(
  async () => {
    const { data } = await supabase.from('approval_groups').select('id, name').order('sort_order')
    return (data ?? []) as { id: number; name: string }[]
  },
  ['approval-groups'],
  { revalidate: 300 }
)

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

export default async function ReviewPage() {
  const session = await getMySession()
  const uid = session?.userId
  if (!uid) redirect('/login')

  const currentWeekStart = toDateStr(getCurrentWeekStart())

  const [permRes, groups, paymentAccounts, labelConfig, historyItems, budgetSummary] = await Promise.all([
    getUserReviewPermissions(uid),
    getCachedApprovalGroups(),
    getCachedPaymentAccounts(),
    getCachedStatusLabelConfig(),
    getApprovalHistoryForReviewer(uid),
    getWeeklyBudgetSummary(currentWeekStart),
  ])

  const { isAdmin, allowedItemIds } = permRes
  const permSet = new Set(allowedItemIds)
  const canSee = (id: string) => isAdmin || permSet.has(id)

  const visibleTabs: ReviewTab[] = []
  const tabGroupIds: Partial<Record<ReviewTab, number>> = {}

  if (canSee('fa-review-div')) visibleTabs.push('div')

  for (const tab of GROUP_TABS) {
    if (canSee(TAB_PERMISSION_IDS[tab]!)) {
      const group = groups.find(g => g.name === GROUP_NAMES[tab])
      if (group) {
        visibleTabs.push(tab)
        tabGroupIds[tab] = group.id
      }
    }
  }
  visibleTabs.push('history')

  const activeTabs = visibleTabs.filter((t): t is Exclude<ReviewTab, 'history'> => t !== 'history')

  const [tabItemResults, ...groupTotalResults] = await Promise.all([
    Promise.all(
      activeTabs.map(tab =>
        tab === 'div'
          ? getPendingAllocationsForOrgRole(uid)
          : getPendingAllocationsByApprovalGroup(tabGroupIds[tab]!)
      )
    ),
    ...GROUP_TABS.map(tab => {
      const gid = tabGroupIds[tab]
      return gid ? getGroupReachedTotals(currentWeekStart, gid) : Promise.resolve({} as Record<string, number>)
    }),
  ])

  const tabItems = Object.fromEntries(
    activeTabs.map((tab, i) => [tab, tabItemResults[i]])
  ) as Partial<Record<ReviewTab, AllocationItem[]>>

  const tabApprovedTotals = Object.fromEntries(
    GROUP_TABS.map((tab, i) => [tab, groupTotalResults[i]])
  ) as Partial<Record<ReviewTab, Record<string, number>>>

  return (
    <ReviewPageClient
      userId={uid}
      visibleTabs={visibleTabs}
      tabItems={tabItems}
      historyItems={historyItems as unknown as HistoryItem[]}
      paymentAccounts={paymentAccounts}
      labelConfig={labelConfig}
      budgets={budgetSummary.budgets}
      tabApprovedTotals={tabApprovedTotals}
    />
  )
}
