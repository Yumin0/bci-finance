'use client'

import { useEffect, useState } from 'react'
import { FundsAllocation, ApprovalRecord } from '@/lib/types'
import {
  getPendingAllocationsForOrgRole,
  getPendingAllocationsByApprovalGroup,
  getApprovalHistoryForReviewer,
} from '@/app/actions/approval-flow'
import { getMySession, getUserReviewPermissions } from '@/app/actions/auth'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { getWeeklyBudgetSummary, getGroupReachedTotals } from '@/app/actions/fund-budget'
import { DEFAULT_STATUS_LABEL_CONFIG, type StatusLabelConfig } from '@/lib/status-label-config'
import { supabase } from '@/lib/supabase'
import { getCurrentWeekStart, toDateStr } from '@/lib/weekUtils'
import Link from 'next/link'
import StatusBadge from '@/app/_components/StatusBadge'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buttonVariants } from '@/components/ui/button'
import PageHeader from '@/app/_components/PageHeader'

type ReviewTab = 'div' | 'advisory' | 'executive' | 'cfo' | 'history'

const TAB_LABELS: Record<ReviewTab, string> = {
  div: '課、處長審核',
  advisory: '諮詢議會',
  executive: '主管議會',
  cfo: '財務長',
  history: '我的審核紀錄',
}

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

type AllocationItem = FundsAllocation & { step_name: string }

type HistoryItem = ApprovalRecord & {
  funds_allocation: Pick<FundsAllocation, 'id' | 'name' | 'amount' | 'status' | 'serial_number' | 'apply_division' | 'apply_section' | 'applicant' | 'apply_role' | 'payment_account' | 'expense_item'> | null
}

const ALLOC_SEARCH: Array<(r: AllocationItem) => string | null | undefined> = [
  (r) => r.serial_number,
  (r) => r.apply_division,
  (r) => r.apply_section,
  (r) => r.applicant,
  (r) => r.expense_item,
  (r) => r.name,
]
const HISTORY_SEARCH: Array<(r: HistoryItem) => string | null | undefined> = [
  (r) => r.funds_allocation?.serial_number,
  (r) => r.funds_allocation?.apply_division,
  (r) => r.funds_allocation?.apply_section,
  (r) => r.funds_allocation?.applicant,
  (r) => r.funds_allocation?.expense_item,
  (r) => r.funds_allocation?.name,
]

export default function ReviewPage() {
  const currentWeekStart = toDateStr(getCurrentWeekStart())

  const [activeTab, setActiveTab] = useState<ReviewTab>('div')
  const [visibleTabs, setVisibleTabs] = useState<ReviewTab[]>(['history'])
  const [tabItems, setTabItems] = useState<Partial<Record<ReviewTab, AllocationItem[]>>>({})
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [paymentAccounts, setPaymentAccounts] = useState<string[]>([])
  const [labelConfig, setLabelConfig] = useState<StatusLabelConfig>(DEFAULT_STATUS_LABEL_CONFIG)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [budgets, setBudgets] = useState<Record<string, number>>({})
  const [tabApprovedTotals, setTabApprovedTotals] = useState<Partial<Record<ReviewTab, Record<string, number>>>>({})

  useEffect(() => { setQuery('') }, [activeTab])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const session = await getMySession()
      const userId = session.userId
      if (!userId) { setLoading(false); return }

      const [permRes, groupsRes, payAccRes, configRes, histRes, budgetSummary] = await Promise.all([
        getUserReviewPermissions(userId),
        supabase.from('approval_groups').select('id, name').order('sort_order'),
        supabase.from('dropdown_options').select('label').eq('field', 'payment_account').order('sort_order'),
        getStatusLabelConfig(),
        getApprovalHistoryForReviewer(userId),
        getWeeklyBudgetSummary(currentWeekStart),
      ])
      const groups = (groupsRes.data ?? []) as { id: number; name: string }[]

      setLabelConfig(configRes)
      setHistoryItems(histRes as unknown as HistoryItem[])
      setPaymentAccounts((payAccRes.data ?? []).map((r: { label: string }) => r.label))
      setBudgets(budgetSummary.budgets)
      const { isAdmin, allowedItemIds } = permRes
      const permSet = new Set(allowedItemIds)
      const canSee = (id: string) => isAdmin || permSet.has(id)

      const tabs: ReviewTab[] = []
      const fetchMap: Partial<Record<ReviewTab, Promise<AllocationItem[]>>> = {}

      if (canSee('fa-review-div')) {
        tabs.push('div')
        fetchMap.div = getPendingAllocationsForOrgRole(userId) as unknown as Promise<AllocationItem[]>
      }

      for (const tab of (['advisory', 'executive', 'cfo'] as const)) {
        if (canSee(TAB_PERMISSION_IDS[tab]!)) {
          const group = groups.find(g => g.name === GROUP_NAMES[tab])
          if (group) {
            tabs.push(tab)
            fetchMap[tab] = getPendingAllocationsByApprovalGroup(group.id) as unknown as Promise<AllocationItem[]>
          }
        }
      }

      tabs.push('history')
      setVisibleTabs(tabs)
      setActiveTab(tabs[0] ?? 'history')

      const GROUP_TABS = (['advisory', 'executive', 'cfo'] as const)
      const [tabItemEntries, ...groupTotalResults] = await Promise.all([
        Promise.all(
          (Object.entries(fetchMap) as [ReviewTab, Promise<AllocationItem[]>][]).map(
            async ([t, p]) => [t, await p] as [ReviewTab, AllocationItem[]]
          )
        ),
        ...GROUP_TABS.map(tab => {
          const group = groups.find(g => g.name === GROUP_NAMES[tab])
          return group ? getGroupReachedTotals(currentWeekStart, group.id) : Promise.resolve({})
        }),
      ])

      setTabItems(Object.fromEntries(tabItemEntries))
      setTabApprovedTotals(
        Object.fromEntries(GROUP_TABS.map((tab, i) => [tab, groupTotalResults[i]]))
      )
      setLoading(false)
    }
    load()
  }, [])

  function filterItems(items: AllocationItem[]) {
    if (!query.trim()) return items
    return items.filter(r => ALLOC_SEARCH.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
  }

  function filterHistory(items: HistoryItem[]) {
    if (!query.trim()) return items
    return items.filter(r => HISTORY_SEARCH.some(fn => fn(r)?.toLowerCase().includes(query.toLowerCase())))
  }

  const pendingCount = (tab: ReviewTab) => (tabItems[tab] ?? []).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader
          title="審核管理"
          action={
            <Input
              placeholder="搜尋單號、申請處別、課別、申請人…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-64 bg-background"
            />
          }
        />
        <p className="mt-1 text-sm text-muted-foreground">資金分配申請的審核任務與歷史記錄</p>
      </div>

      <div className="flex border-b border-border">
        {visibleTabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`-mb-px whitespace-nowrap border-b-2 px-5 py-2 text-sm font-medium transition-colors ${activeTab === tab ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {TAB_LABELS[tab]}
            {tab !== 'history' && pendingCount(tab) > 0 && (
              <span className="ml-1.5 inline-block rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-white">
                {pendingCount(tab)}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">載入中...</p>
      ) : activeTab === 'history' ? (
        <HistoryList items={filterHistory(historyItems)} labelConfig={labelConfig} />
      ) : (
        <AccountGroupedList
          items={filterItems(tabItems[activeTab] ?? [])}
          paymentAccounts={paymentAccounts}
          labelConfig={labelConfig}
          showBudget={activeTab !== 'div'}
          budgets={budgets}
          approvedTotals={tabApprovedTotals[activeTab] ?? {}}
        />
      )}
    </div>
  )
}

function AccountGroupedList({
  items,
  paymentAccounts,
  labelConfig,
  showBudget,
  budgets,
  approvedTotals,
}: {
  items: AllocationItem[]
  paymentAccounts: string[]
  labelConfig: StatusLabelConfig
  showBudget: boolean
  budgets: Record<string, number>
  approvedTotals: Record<string, number>
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">目前沒有待審核的申請</p>

  const groupMap = items.reduce<Record<string, AllocationItem[]>>((acc, r) => {
    const key = r.payment_account ?? '（未指定帳戶）'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  const orderedKeys = [
    ...paymentAccounts.filter(k => groupMap[k]),
    ...Object.keys(groupMap).filter(k => !paymentAccounts.includes(k)),
  ]

  return (
    <div className="flex flex-col gap-6">
      {orderedKeys.map(account => {
        const budget = budgets[account] ?? null
        const approved = approvedTotals[account] ?? 0
        const remaining = budget != null ? budget - approved : null
        return (
        <div key={account}>
          <Card className="overflow-hidden p-0">
            <CardHeader className="border-b border-border px-4 py-3">
              <CardTitle className="text-base">{account}</CardTitle>
              {showBudget && (
                <div className="ml-auto flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    已核准總額：<span className="font-medium text-foreground">{approved.toLocaleString()} 元</span>
                  </span>
                  {remaining != null && (
                    <span className="text-muted-foreground">
                      剩餘可分配金額：
                      <span className={`font-medium ${remaining < 0 ? 'text-destructive' : 'text-primary'}`}>
                        {remaining.toLocaleString()} 元
                      </span>
                    </span>
                  )}
                </div>
              )}
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  {['狀態', '單號', '申請處別', '申請課別', '申請人', '職稱', '金額', '費用項目', '項目', ''].map((col, i) => (
                    <TableHead key={i}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupMap[account].map(r => (
                  <TableRow key={r.id}>
                    <TableCell><StatusBadge module="funds_allocation" status="pending" stepName={r.step_name} labelConfig={labelConfig} /></TableCell>
                    <TableCell><Link href={`/funds-allocation/review/check/${r.id}`} className="text-sm text-primary underline underline-offset-4">{r.serial_number ?? '-'}</Link></TableCell>
                    <TableCell>{r.apply_division ?? '-'}</TableCell>
                    <TableCell>{r.apply_section ?? '-'}</TableCell>
                    <TableCell>{r.applicant ?? r.created_by}</TableCell>
                    <TableCell>{r.apply_role ?? '-'}</TableCell>
                    <TableCell>{r.amount.toLocaleString()}</TableCell>
                    <TableCell>{r.expense_item ?? '-'}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell><Link href={`/funds-allocation/review/check/${r.id}`} className={buttonVariants({ variant: 'default', size: 'sm' })}>審核</Link></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
        )
      })}
    </div>
  )
}

function HistoryList({ items, labelConfig }: { items: HistoryItem[]; labelConfig: StatusLabelConfig }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">尚無審核紀錄</p>
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            {['狀態', '單號', '申請處別', '申請課別', '申請人', '職稱', '金額', '出款帳戶', '費用項目', '項目', ''].map((col, i) => (
              <TableHead key={i}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(r => (
            <TableRow key={r.id}>
              <TableCell>
                <StatusBadge module="funds_allocation" status={r.funds_allocation?.status ?? (r.decision === 'approved' ? 'approved' : 'rejected')} stepName={r.step_name} labelConfig={labelConfig} />
              </TableCell>
              <TableCell>
                {r.funds_allocation_id
                  ? <Link href={`/funds-allocation/review/check/${r.funds_allocation_id}`} className="text-sm text-primary underline underline-offset-4">{r.funds_allocation?.serial_number ?? '-'}</Link>
                  : (r.funds_allocation?.serial_number ?? '-')}
              </TableCell>
              <TableCell>{r.funds_allocation?.apply_division ?? '-'}</TableCell>
              <TableCell>{r.funds_allocation?.apply_section ?? '-'}</TableCell>
              <TableCell>{r.funds_allocation?.applicant ?? '-'}</TableCell>
              <TableCell>{r.funds_allocation?.apply_role ?? '-'}</TableCell>
              <TableCell>{r.funds_allocation?.amount?.toLocaleString() ?? '-'}</TableCell>
              <TableCell>{r.funds_allocation?.payment_account ?? '-'}</TableCell>
              <TableCell>{r.funds_allocation?.expense_item ?? '-'}</TableCell>
              <TableCell>{r.funds_allocation?.name ?? '-'}</TableCell>
              <TableCell>
                {r.funds_allocation_id && <Link href={`/funds-allocation/review/check/${r.funds_allocation_id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>查閱</Link>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
