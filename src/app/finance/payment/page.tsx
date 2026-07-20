'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsPayment, FormSlot } from '@/lib/types'
import { getStatusLabelConfig } from '@/app/actions/status-labels'
import { confirmPayment } from '@/app/actions/payment'
import { getFormSchemas } from '@/app/actions/form-schema'
import { getLatestPaymentCategories } from '@/app/actions/approval-flow'
import { DEFAULT_STATUS_LABEL_CONFIG, type StatusLabelConfig } from '@/lib/status-label-config'
import StatusBadge from '@/app/_components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PageHeader from '@/app/_components/PageHeader'
import WeekFilterBar, { useWeekFilter } from '@/app/_components/WeekFilterBar'
import {
  PaymentListCells,
  PAYMENT_LIST_COLUMNS_AFTER_STATUS,
} from '@/app/funds-payment/_components/PaymentListCells'
import { canExportPaymentVoucher } from '@/lib/paymentPrintEligibility'

type PaymentRecord = FundsPayment & {
  approval_flow_templates: {
    name: string
    approval_flow_steps: Array<{ step_name: string; step_number: number; reviewer_type?: string | null }>
  } | null
  approval_records: Array<{ step_name: string; decision: string }>
}

export default function FinancePaymentPage() {
  const [records, setRecords] = useState<PaymentRecord[]>([])
  const [labelConfig, setLabelConfig] = useState<StatusLabelConfig>(DEFAULT_STATUS_LABEL_CONFIG)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<Set<number>>(new Set())
  // 對齊筑今欄位所需資料：受款人欄位名稱、付款分類（審核紀錄最新選值）
  const [payeeLabel, setPayeeLabel] = useState<string | null>(null)
  const [paymentCategoryMap, setPaymentCategoryMap] = useState<Record<number, string>>({})

  useEffect(() => {
    async function load() {
      const [{ data }, config, schemas] = await Promise.all([
        supabase
          .from('funds_payment')
          .select(`*, approval_flow_templates(name, approval_flow_steps(step_name, step_number, reviewer_type)), approval_records!funds_payment_id(step_name, decision)`)
          .order('created_at', { ascending: false }),
        getStatusLabelConfig(),
        getFormSchemas(),
      ])
      const rows = (data ?? []) as PaymentRecord[]
      setRecords(rows)
      setLabelConfig(config)
      setPayeeLabel(
        schemas.payment_voucher
          .flatMap(b => b.rows.flatMap(r => r.slots))
          .find((s): s is NonNullable<FormSlot> => s !== null && s.dataSource?.startsWith('payee_records:') === true)
          ?.label ?? null
      )
      const ids = rows.map(r => r.id)
      const categories = await getLatestPaymentCategories(ids)
      setPaymentCategoryMap(categories)
      setLoading(false)
    }
    load()
  }, [])

  function getStepName(r: PaymentRecord): string | null {
    if (r.status === 'pending') {
      return r.approval_flow_templates?.approval_flow_steps?.find(s => s.step_number === r.current_step)?.step_name ?? null
    }
    if (r.status === 'rejected') {
      return r.approval_records?.find(a => a.decision === 'rejected')?.step_name ?? null
    }
    if (r.status === 'approved') {
      const steps = r.approval_flow_templates?.approval_flow_steps ?? []
      if (steps.length === 0) return null
      return steps.reduce((max, s) => s.step_number > max.step_number ? s : max, steps[0])?.step_name ?? null
    }
    return null
  }

  async function handleConfirmPayment(id: number) {
    setConfirming(prev => new Set(prev).add(id))
    const result = await confirmPayment(id)
    if (!result.error) {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'paid' as FundsPayment['status'] } : r))
    }
    setConfirming(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  // 週次篩選：依憑單建單日期（date）過濾，與我的付款憑單／審核管理頁同一套元件
  const weekFilter = useWeekFilter()
  const filteredRecords = records.filter(r => weekFilter.matches(r.date, r.created_at))

  const groups = filteredRecords.reduce<Record<string, PaymentRecord[]>>((acc, r) => {
    const key = r.payment_account ?? '（未指定帳戶）'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  if (loading) return <p className="text-muted-foreground">載入中...</p>

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="付款憑單管理" />
      <WeekFilterBar filter={weekFilter} />
      {Object.keys(groups).length === 0 && (
        <p className="text-muted-foreground">{weekFilter.isFiltering ? '此週次尚無付款憑單' : '尚無付款憑單'}</p>
      )}

      {Object.entries(groups).map(([account, items]) => {
        const totalAmount = items
          .filter(r => r.status === 'approved' || r.status === 'paid')
          .reduce((sum, r) => sum + (r.amount ?? 0), 0)
        const paidAmount = items
          .filter(r => r.status === 'paid')
          .reduce((sum, r) => sum + (r.amount ?? 0), 0)

        return (
          <Card key={account} className="gap-0 overflow-hidden p-0">
            <CardHeader className="border-b border-border bg-card py-4">
              <div className="flex items-center justify-between">
                <CardTitle>{account}</CardTitle>
                <span className="text-sm text-muted-foreground">
                  實際付款總額：
                  <span className="font-semibold text-green-700 dark:text-green-400">{totalAmount.toLocaleString()}</span>
                  {' '}元，已執行：
                  <span className="font-semibold text-primary">{paidAmount.toLocaleString()}</span>
                  {' '}元
                </span>
              </div>
            </CardHeader>
            <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3">
              <TableHeader>
                <TableRow>
                  <TableHead>狀態</TableHead>
                  {PAYMENT_LIST_COLUMNS_AFTER_STATUS.map(col => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                  <TableHead>付款分類</TableHead>
                  <TableHead>付款執行</TableHead>
                  <TableHead>匯出</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <StatusBadge module="payment_voucher" status={r.status} stepName={getStepName(r)} labelConfig={labelConfig} />
                    </TableCell>
                    <PaymentListCells r={r} payeeLabel={payeeLabel} />
                    <TableCell className="whitespace-nowrap">{paymentCategoryMap[r.id] ?? '-'}</TableCell>
                    <TableCell>
                      {r.status === 'approved' ? (
                        <Button
                          size="sm"
                          onClick={() => handleConfirmPayment(r.id)}
                          disabled={confirming.has(r.id)}
                          className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                        >
                          {confirming.has(r.id) ? '處理中...' : '確認付款'}
                        </Button>
                      ) : r.status === 'paid' ? (
                        <Button size="sm" variant="secondary" disabled>已付款</Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {/* 財務代職員匯出列印版（筑今做不到的）；課處長關卡核准後即開放（2026-07-20 財務拍板） */}
                      {canExportPaymentVoucher(r.status, r.current_step, r.approval_flow_templates?.approval_flow_steps) ? (
                        <a
                          href={`/funds-payment/my-payment/${r.id}/print`}
                          target="_blank"
                          className="text-sm text-blue-600 whitespace-nowrap hover:underline"
                        >
                          匯出
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )
      })}
    </div>
  )
}
