'use client'

import { useEffect, useState } from 'react'
import { FundsAllocation, ApprovalRecord } from '@/lib/types'
import {
  getPendingAllocationsForOrgRole,
  getPendingAllocationsByApprovalGroup,
  getApprovalHistoryForReviewer,
  submitApprovalDecision,
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
import { Textarea } from '@/components/ui/textarea'
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

const QUICK_ACTION_TABS = new Set<ReviewTab>(['advisory', 'executive'])
const BATCH_ACTION_TABS = new Set<ReviewTab>(['cfo'])

type AllocationItem = FundsAllocation & { step_name: string; total_steps?: number }

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
  const [userId, setUserId] = useState<number | null>(null)
  const [tabGroupIds, setTabGroupIds] = useState<Partial<Record<ReviewTab, number>>>({})

  useEffect(() => { setQuery('') }, [activeTab])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const session = await getMySession()
      const uid = session.userId
      if (!uid) { setLoading(false); return }
      setUserId(uid)

      const [permRes, groupsRes, payAccRes, configRes, histRes, budgetSummary] = await Promise.all([
        getUserReviewPermissions(uid),
        supabase.from('approval_groups').select('id, name').order('sort_order'),
        supabase.from('dropdown_options').select('label').eq('field', 'payment_account').order('sort_order'),
        getStatusLabelConfig(),
        getApprovalHistoryForReviewer(uid),
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
      const groupIdMap: Partial<Record<ReviewTab, number>> = {}

      if (canSee('fa-review-div')) {
        tabs.push('div')
        fetchMap.div = getPendingAllocationsForOrgRole(uid) as unknown as Promise<AllocationItem[]>
      }

      for (const tab of (['advisory', 'executive', 'cfo'] as const)) {
        if (canSee(TAB_PERMISSION_IDS[tab]!)) {
          const group = groups.find(g => g.name === GROUP_NAMES[tab])
          if (group) {
            tabs.push(tab)
            groupIdMap[tab] = group.id
            fetchMap[tab] = getPendingAllocationsByApprovalGroup(group.id) as unknown as Promise<AllocationItem[]>
          }
        }
      }

      tabs.push('history')
      setVisibleTabs(tabs)
      setActiveTab(tabs[0] ?? 'history')
      setTabGroupIds(groupIdMap)

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

  async function refreshGroupTabs() {
    const GROUP_TABS = (['advisory', 'executive', 'cfo'] as const)
    const [itemEntries, ...totalResults] = await Promise.all([
      Promise.all(
        GROUP_TABS
          .filter(tab => tabGroupIds[tab] != null)
          .map(async tab => {
            const items = await getPendingAllocationsByApprovalGroup(tabGroupIds[tab]!) as unknown as AllocationItem[]
            return [tab, items] as [ReviewTab, AllocationItem[]]
          })
      ),
      ...GROUP_TABS.map(tab => {
        const gid = tabGroupIds[tab]
        return gid ? getGroupReachedTotals(currentWeekStart, gid) : Promise.resolve({})
      }),
    ])
    setTabItems(prev => ({ ...prev, ...Object.fromEntries(itemEntries) }))
    setTabApprovedTotals(Object.fromEntries(GROUP_TABS.map((tab, i) => [tab, totalResults[i]])))
  }

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
          showQuickActions={QUICK_ACTION_TABS.has(activeTab)}
          showBatchActions={BATCH_ACTION_TABS.has(activeTab)}
          userId={userId}
          onActionCompleted={refreshGroupTabs}
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
  showQuickActions,
  showBatchActions,
  userId,
  onActionCompleted,
}: {
  items: AllocationItem[]
  paymentAccounts: string[]
  labelConfig: StatusLabelConfig
  showBudget: boolean
  budgets: Record<string, number>
  approvedTotals: Record<string, number>
  showQuickActions: boolean
  showBatchActions: boolean
  userId: number | null
  onActionCompleted: () => Promise<void>
}) {
  // individual quick-action state
  const [actioningId, setActioningId] = useState<number | null>(null)
  const [rejectTarget, setRejectTarget] = useState<AllocationItem | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)

  // batch action state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [batchRejectItems, setBatchRejectItems] = useState<AllocationItem[]>([])
  const [batchComment, setBatchComment] = useState('')
  const [batchLoading, setBatchLoading] = useState(false)

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function isAllGroupSelected(groupItems: AllocationItem[]) {
    return groupItems.length > 0 && groupItems.every(r => selectedIds.has(r.id))
  }

  function toggleSelectAll(groupItems: AllocationItem[]) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (isAllGroupSelected(groupItems)) {
        groupItems.forEach(r => next.delete(r.id))
      } else {
        groupItems.forEach(r => next.add(r.id))
      }
      return next
    })
  }

  function getGroupSelected(groupItems: AllocationItem[]) {
    return groupItems.filter(r => selectedIds.has(r.id))
  }

  async function handleApprove(item: AllocationItem) {
    if (!userId || actioningId) return
    setActioningId(item.id)
    try {
      await submitApprovalDecision({
        fundsAllocationId: item.id,
        stepNumber: item.current_step ?? 1,
        stepName: item.step_name,
        decision: 'approved',
        comment: '',
        reviewerId: String(userId),
        totalSteps: item.total_steps ?? 1,
      })
      await onActionCompleted()
    } catch {
      alert('核准失敗，請重試')
    } finally {
      setActioningId(null)
    }
  }

  async function handleConfirmReject() {
    if (!userId || !rejectTarget || rejectLoading) return
    setRejectLoading(true)
    try {
      await submitApprovalDecision({
        fundsAllocationId: rejectTarget.id,
        stepNumber: rejectTarget.current_step ?? 1,
        stepName: rejectTarget.step_name,
        decision: 'rejected',
        comment: rejectComment,
        reviewerId: String(userId),
        totalSteps: rejectTarget.total_steps ?? 1,
      })
      setRejectTarget(null)
      setRejectComment('')
      await onActionCompleted()
    } catch {
      alert('退回失敗，請重試')
    } finally {
      setRejectLoading(false)
    }
  }

  async function handleBatchApprove(groupItems: AllocationItem[]) {
    if (!userId || batchLoading) return
    const targets = getGroupSelected(groupItems)
    if (targets.length === 0) return
    setBatchLoading(true)
    try {
      await Promise.all(targets.map(item => submitApprovalDecision({
        fundsAllocationId: item.id,
        stepNumber: item.current_step ?? 1,
        stepName: item.step_name,
        decision: 'approved',
        comment: '',
        reviewerId: String(userId),
        totalSteps: item.total_steps ?? 1,
      })))
      setSelectedIds(prev => {
        const next = new Set(prev)
        targets.forEach(r => next.delete(r.id))
        return next
      })
      await onActionCompleted()
    } catch {
      alert('批次核准失敗，請重試')
    } finally {
      setBatchLoading(false)
    }
  }

  async function handleConfirmBatchReject() {
    if (!userId || batchLoading || batchRejectItems.length === 0) return
    setBatchLoading(true)
    try {
      await Promise.all(batchRejectItems.map(item => submitApprovalDecision({
        fundsAllocationId: item.id,
        stepNumber: item.current_step ?? 1,
        stepName: item.step_name,
        decision: 'rejected',
        comment: batchComment,
        reviewerId: String(userId),
        totalSteps: item.total_steps ?? 1,
      })))
      setSelectedIds(prev => {
        const next = new Set(prev)
        batchRejectItems.forEach(r => next.delete(r.id))
        return next
      })
      setBatchRejectItems([])
      setBatchComment('')
      await onActionCompleted()
    } catch {
      alert('批次不核准失敗，請重試')
    } finally {
      setBatchLoading(false)
    }
  }

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
    <>
      <div className="flex flex-col gap-6">
        {orderedKeys.map(account => {
          const budget = budgets[account] ?? null
          const approved = approvedTotals[account] ?? 0
          const remaining = budget != null ? budget - approved : null
          const groupItems = groupMap[account]
          const groupSelected = getGroupSelected(groupItems)
          const hasSelection = groupSelected.length > 0

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
                      {showBatchActions && (
                        <div className="flex items-center gap-2 border-l border-border pl-3">
                          <button
                            onClick={() => { setBatchRejectItems(groupSelected); setBatchComment('') }}
                            disabled={!hasSelection || batchLoading}
                            className="rounded-md border border-destructive px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            批次不核准{hasSelection ? `（${groupSelected.length}）` : ''}
                          </button>
                          <button
                            onClick={() => handleBatchApprove(groupItems)}
                            disabled={!hasSelection || batchLoading}
                            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {batchLoading ? '處理中…' : `批次核准${hasSelection ? `（${groupSelected.length}）` : ''}`}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>狀態</TableHead>
                      <TableHead>單號</TableHead>
                      <TableHead>申請處別</TableHead>
                      <TableHead>申請課別</TableHead>
                      <TableHead>申請人</TableHead>
                      <TableHead>職稱</TableHead>
                      <TableHead>金額</TableHead>
                      <TableHead>費用項目</TableHead>
                      <TableHead>項目</TableHead>
                      {showQuickActions && <TableHead>快速審核</TableHead>}
                      {showBatchActions && (
                        <TableHead className="w-12 text-center">
                          <label className="flex cursor-pointer items-center justify-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={isAllGroupSelected(groupItems)}
                              onChange={() => toggleSelectAll(groupItems)}
                              className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                            />
                            全選
                          </label>
                        </TableHead>
                      )}
                      {!showQuickActions && !showBatchActions && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupItems.map(r => (
                      <TableRow key={r.id} className={showBatchActions && selectedIds.has(r.id) ? 'bg-primary/5' : ''}>
                        <TableCell><StatusBadge module="funds_allocation" status="pending" stepName={r.step_name} labelConfig={labelConfig} /></TableCell>
                        <TableCell><Link href={`/funds-allocation/review/check/${r.id}`} className="text-sm text-primary underline underline-offset-4">{r.serial_number ?? '-'}</Link></TableCell>
                        <TableCell>{r.apply_division ?? '-'}</TableCell>
                        <TableCell>{r.apply_section ?? '-'}</TableCell>
                        <TableCell>{r.applicant ?? r.created_by}</TableCell>
                        <TableCell>{r.apply_role ?? '-'}</TableCell>
                        <TableCell>{r.amount.toLocaleString()}</TableCell>
                        <TableCell>{r.expense_item ?? '-'}</TableCell>
                        <TableCell>{r.name}</TableCell>
                        {showQuickActions && (
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleApprove(r)}
                                disabled={actioningId === r.id}
                                className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {actioningId === r.id ? '處理中…' : '核准'}
                              </button>
                              <button
                                onClick={() => { setRejectTarget(r); setRejectComment('') }}
                                disabled={actioningId === r.id}
                                className="rounded-md border border-destructive px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                              >
                                不核准
                              </button>
                            </div>
                          </TableCell>
                        )}
                        {showBatchActions && (
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(r.id)}
                              onChange={() => toggleSelect(r.id)}
                              className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                            />
                          </TableCell>
                        )}
                        {!showQuickActions && !showBatchActions && (
                          <TableCell>
                            <Link href={`/funds-allocation/review/check/${r.id}`} className={buttonVariants({ variant: 'default', size: 'sm' })}>審核</Link>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )
        })}
      </div>

      {/* 個別退回 Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-96 rounded-lg bg-background p-6 shadow-xl">
            <h2 className="mb-1 text-base font-semibold">退回申請</h2>
            <p className="mb-4 text-sm text-muted-foreground">單號：{rejectTarget.serial_number}</p>
            <Textarea
              placeholder="退回原因（選填）"
              value={rejectComment}
              onChange={e => setRejectComment(e.target.value)}
              rows={3}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setRejectTarget(null); setRejectComment('') }}
                disabled={rejectLoading}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={rejectLoading}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
              >
                {rejectLoading ? '處理中…' : '確認退回'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批次不核准 Modal */}
      {batchRejectItems.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[28rem] rounded-lg bg-background p-6 shadow-xl">
            <h2 className="mb-1 text-base font-semibold">批次不核准</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              共 {batchRejectItems.length} 筆申請將被退回：
              {batchRejectItems.map(r => r.serial_number).join('、')}
            </p>
            <Textarea
              placeholder="退回原因（選填，套用至所有選取項目）"
              value={batchComment}
              onChange={e => setBatchComment(e.target.value)}
              rows={3}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setBatchRejectItems([]); setBatchComment('') }}
                disabled={batchLoading}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmBatchReject}
                disabled={batchLoading}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
              >
                {batchLoading ? '處理中…' : `確認退回（${batchRejectItems.length} 筆）`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
