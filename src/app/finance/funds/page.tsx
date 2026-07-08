'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { saveFundWeeklyBudget } from '@/app/actions/fund-budget'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PageHeader from '@/app/_components/PageHeader'
import { YearDropdown, WeekDropdown } from '@/app/_components/WeekPicker'
import {
  getWeeksForYear,
  getCurrentWeekStart,
  toDateStr,
} from '@/lib/weekUtils'

type AccountRow = {
  account: string
  budget: number | null
}

export default function FundsPage() {
  const nowWeekStart = getCurrentWeekStart()

  const [selectedYear, setSelectedYear] = useState(nowWeekStart.getFullYear())
  const [selectedWeekStart, setSelectedWeekStart] = useState(toDateStr(nowWeekStart))

  const [rows, setRows] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalAccount, setModalAccount] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)

  function handleYearChange(year: number) {
    setSelectedYear(year)
    const weeks = getWeeksForYear(year)
    const currentStr = toDateStr(nowWeekStart)
    const matchCurrent = weeks.find(wk => toDateStr(wk) === currentStr)
    setSelectedWeekStart(matchCurrent ? currentStr : toDateStr(weeks[weeks.length - 1] ?? weeks[0]))
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const [optRes, budgetRes] = await Promise.all([
      supabase.from('dropdown_options').select('label').eq('field', 'payment_account').order('sort_order'),
      supabase.from('fund_weekly_budgets').select('payment_account, budget').eq('week_start', selectedWeekStart),
    ])
    if (optRes.error) { setError(optRes.error.message); setLoading(false); return }

    const budgetMap: Record<string, number> = {}
    for (const b of budgetRes.data ?? []) budgetMap[b.payment_account] = b.budget

    setRows((optRes.data ?? []).map(o => ({ account: o.label, budget: budgetMap[o.label] ?? null })))
    setLoading(false)
  }, [selectedWeekStart])

  useEffect(() => { loadData() }, [loadData])

  function openModal(account: string) {
    const current = rows.find(r => r.account === account)
    setInputValue(current?.budget != null ? String(current.budget) : '')
    setModalAccount(account)
  }

  function closeModal() { setModalAccount(null); setInputValue('') }

  async function handleConfirm() {
    if (!modalAccount) return
    const num = Number(inputValue)
    if (isNaN(num) || inputValue.trim() === '') return
    setSaving(true)
    const { error: e } = await saveFundWeeklyBudget(selectedWeekStart, modalAccount, num)
    setSaving(false)
    if (e) { setError(e); return }
    setRows(prev => prev.map(r => r.account === modalAccount ? { ...r, budget: num } : r))
    closeModal()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="資金管理" />

      <div className="flex items-center gap-2">
        <YearDropdown selectedYear={selectedYear} onChange={handleYearChange} />
        <WeekDropdown
          selectedYear={selectedYear}
          selectedWeekStart={selectedWeekStart}
          onChange={setSelectedWeekStart}
        />
      </div>

      {error && <p className="text-sm text-destructive">錯誤：{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">載入中...</p>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3">
            <TableHeader>
              <TableRow>
                {['項次', '出款帳戶', '可分配總額', ''].map((col, i) => (
                  <TableHead key={i}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    尚無出款帳戶，請先至「支出欄位設定」新增。
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row, idx) => (
                <TableRow key={row.account}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium">{row.account}</TableCell>
                  <TableCell>
                    {row.budget != null
                      ? <span className="font-medium text-foreground">{row.budget.toLocaleString()} 元</span>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => openModal(row.account)}>
                      輸入金額
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {modalAccount && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="w-[480px] max-w-[90vw] overflow-hidden rounded-xl bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <span className="text-base font-semibold text-foreground">
                設定預算
              </span>
              <button onClick={closeModal} className="text-xl leading-none text-muted-foreground hover:text-foreground">×</button>
            </div>
            <div className="px-6 py-5">
              <p className="mb-3 text-sm text-muted-foreground">帳戶：{modalAccount}</p>
              <Input
                type="number"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
                placeholder="20000"
                autoFocus
              />
            </div>
            <div className="flex justify-end border-t border-border px-6 py-4">
              <Button onClick={handleConfirm} disabled={saving}>
                {saving ? '儲存中...' : '確認'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
