'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ApprovalFlowTemplate, ApprovalFlowStepWithRole, DropdownOption, RoleType, SystemRole } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/app/_components/PageHeader'
import {
  createTemplate, updateTemplateName, toggleTemplateActive, deleteTemplate,
  saveTemplateSteps, saveTemplatePaymentAccounts, getUsedPaymentAccountIds,
} from '@/app/actions/approval-flow'

type FormType = 'funds_allocation' | 'payment_voucher' | 'temp_voucher'

type StepDraft = {
  step_number: number
  step_name: string
  reviewer_type: 'org_role' | 'system_role'
  role_type_id: number | null
  system_role_id: number | null
}

const FORM_SECTIONS: { type: FormType; label: string }[] = [
  { type: 'funds_allocation', label: '資金分配申請' },
  { type: 'payment_voucher', label: '付款憑單' },
  { type: 'temp_voucher', label: '暫付款沖銷憑單' },
]

const selectClass = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus:border-ring dark:bg-input/30'

export default function ApprovalFlowsPage() {
  const [creatingForType, setCreatingForType] = useState<FormType>('funds_allocation')
  const [templates, setTemplates] = useState<ApprovalFlowTemplate[]>([])
  const [roleTypes, setRoleTypes] = useState<RoleType[]>([])
  const [systemRoles, setSystemRoles] = useState<SystemRole[]>([])
  const [paymentAccounts, setPaymentAccounts] = useState<DropdownOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedTemplate, setSelectedTemplate] = useState<ApprovalFlowTemplate | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSteps, setEditSteps] = useState<StepDraft[]>([])
  const [editPaymentAccountIds, setEditPaymentAccountIds] = useState<number[]>([])
  const [usedAccountIds, setUsedAccountIds] = useState<number[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [tmplRes, rtRes, srRes, paRes] = await Promise.all([
      supabase.from('approval_flow_templates').select('*').order('created_at', { ascending: true }),
      supabase.from('role_types').select('*').order('sort_order'),
      supabase.from('system_roles').select('*').order('sort_order'),
      supabase.from('dropdown_options').select('*').eq('field', 'payment_account').order('sort_order'),
    ])
    setTemplates((tmplRes.data as ApprovalFlowTemplate[]) ?? [])
    setRoleTypes((rtRes.data as RoleType[]) ?? [])
    setSystemRoles((srRes.data as SystemRole[]) ?? [])
    setPaymentAccounts((paRes.data as DropdownOption[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function openEdit(template: ApprovalFlowTemplate) {
    setError(null)
    setSelectedTemplate(template)
    setIsPanelOpen(true)
    setEditName(template.name)
    const [stepsRes, usedIds] = await Promise.all([
      supabase
        .from('approval_flow_steps')
        .select('*, role_types(name), system_roles(name)')
        .eq('template_id', template.id)
        .order('step_number'),
      getUsedPaymentAccountIds(template.form_type as FormType, template.id),
    ])
    const paRes = await supabase
      .from('template_payment_accounts')
      .select('payment_account_option_id')
      .eq('template_id', template.id)

    const steps: StepDraft[] = ((stepsRes.data ?? []) as ApprovalFlowStepWithRole[]).map((s) => ({
      step_number: s.step_number,
      step_name: s.step_name,
      reviewer_type: s.reviewer_type,
      role_type_id: s.role_type_id,
      system_role_id: s.system_role_id,
    }))
    setEditSteps(steps)
    setUsedAccountIds(usedIds)
    setEditPaymentAccountIds(
      (paRes.data ?? []).map((r: { payment_account_option_id: number }) => r.payment_account_option_id)
    )
  }

  async function openNew(formType: FormType) {
    setError(null)
    setSelectedTemplate(null)
    setCreatingForType(formType)
    setIsPanelOpen(true)
    setEditName('')
    setEditSteps([])
    setEditPaymentAccountIds([])
    const usedIds = await getUsedPaymentAccountIds(formType)
    setUsedAccountIds(usedIds)
  }

  async function handleSave() {
    if (!editName.trim()) { setError('請填寫範本名稱'); return }
    if (editSteps.length === 0) { setError('至少需要一個步驟'); return }
    const currentType = selectedTemplate?.form_type ?? creatingForType
    if (currentType !== 'temp_voucher' && editPaymentAccountIds.length === 0) { setError('請選擇至少一個出款帳號'); return }
    for (const s of editSteps) {
      if (!s.step_name.trim()) { setError('步驟名稱不能空白'); return }
      if (s.reviewer_type === 'org_role' && !s.role_type_id) { setError('請選擇組織職位'); return }
      if (s.reviewer_type === 'system_role' && !s.system_role_id) { setError('請選擇系統角色'); return }
    }
    setSaving(true)
    setError(null)
    try {
      let templateId = selectedTemplate?.id
      if (!templateId) {
        const created = await createTemplate(editName.trim(), selectedTemplate?.form_type ?? creatingForType)
        templateId = created.id
      } else {
        await updateTemplateName(templateId, editName.trim())
      }
      const numbered = editSteps.map((s, i) => ({ ...s, step_number: i + 1 }))
      await Promise.all([
        saveTemplateSteps(templateId, numbered),
        saveTemplatePaymentAccounts(templateId, editPaymentAccountIds),
      ])
      await loadData()
      setSelectedTemplate(null)
      setIsPanelOpen(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(template: ApprovalFlowTemplate) {
    await toggleTemplateActive(template.id, !template.is_active)
    await loadData()
  }

  async function handleDelete(template: ApprovalFlowTemplate) {
    if (!confirm(`確定要刪除「${template.name}」嗎？此操作無法復原。`)) return
    await deleteTemplate(template.id)
    if (selectedTemplate?.id === template.id) setSelectedTemplate(null)
    await loadData()
  }

  function addStep() {
    setEditSteps(prev => [
      ...prev,
      { step_number: prev.length + 1, step_name: '', reviewer_type: 'org_role', role_type_id: null, system_role_id: null },
    ])
  }

  function removeStep(index: number) {
    setEditSteps(prev => prev.filter((_, i) => i !== index))
  }

  function moveStep(index: number, dir: -1 | 1) {
    setEditSteps(prev => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setEditSteps(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  function togglePaymentAccount(optionId: number) {
    setEditPaymentAccountIds(prev =>
      prev.includes(optionId) ? prev.filter(id => id !== optionId) : [...prev, optionId]
    )
  }

  if (loading) return <p className="text-muted-foreground">載入中...</p>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader title="審核流程管理" />
        <p className="mt-1 text-sm text-muted-foreground">設定各表單的審核流程範本</p>
      </div>

      <div className="flex items-start gap-6">
        {/* 左側：範本列表 */}
        <div className="flex w-72 shrink-0 flex-col gap-5">
          {FORM_SECTIONS.map(({ type, label }) => {
            const sectionTemplates = templates.filter(t => t.form_type === type)
            return (
              <div key={type} className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                {sectionTemplates.length === 0 && (
                  <p className="text-sm text-muted-foreground">尚無範本</p>
                )}
                {sectionTemplates.map(t => (
                  <div
                    key={t.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      selectedTemplate?.id === t.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <span className="text-sm font-medium text-foreground">{t.name}</span>
                      <button
                        onClick={() => handleDelete(t)}
                        className="text-xs text-destructive hover:underline"
                      >
                        刪除
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                        <input type="checkbox" checked={t.is_active} onChange={() => handleToggleActive(t)} />
                        {t.is_active ? '啟用中' : '已停用'}
                      </label>
                      <button
                        onClick={() => openEdit(t)}
                        className="rounded border border-border px-2.5 py-0.5 text-xs text-foreground transition-colors hover:bg-muted"
                      >
                        編輯
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => openNew(type)}
                  className="w-full rounded-lg border border-dashed border-border py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
                >
                  ＋ 新增範本
                </button>
              </div>
            )
          })}
        </div>

        {/* 右側：編輯面板 */}
        <Card className="min-h-48 flex-1">
          {isPanelOpen ? (
            <CardContent>
              <CardHeader className="px-0 pt-0">
                <CardTitle>
                  {selectedTemplate
                    ? `編輯範本：${selectedTemplate.name}`
                    : `新增範本（${FORM_SECTIONS.find(s => s.type === creatingForType)?.label ?? ''}）`}
                </CardTitle>
              </CardHeader>

              {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

              <div className="flex flex-col gap-6">
                {/* 範本名稱 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">範本名稱</label>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="max-w-sm" />
                </div>

                {/* 適用出款帳號 */}
                {(selectedTemplate?.form_type ?? creatingForType) !== 'temp_voucher' && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      適用出款帳號
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        （已被其他啟用範本使用的帳號無法選取）
                      </span>
                    </label>
                    <div className="flex flex-col gap-2">
                      {paymentAccounts.length === 0 && (
                        <p className="text-sm text-muted-foreground">尚無出款帳號選項，請先在支出欄位設定中新增</p>
                      )}
                      {paymentAccounts.map(pa => {
                        const occupied = usedAccountIds.includes(pa.id)
                        const checked = editPaymentAccountIds.includes(pa.id)
                        return (
                          <label
                            key={pa.id}
                            className={`flex items-center gap-2 text-sm ${occupied ? 'cursor-not-allowed opacity-45' : 'cursor-pointer text-foreground'}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={occupied}
                              onChange={() => togglePaymentAccount(pa.id)}
                            />
                            {pa.label}
                            {occupied && <span className="text-xs text-muted-foreground">（已被其他範本使用）</span>}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 步驟設定 */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-foreground">步驟設定</label>
                  <div className="flex flex-col gap-2.5">
                    {editSteps.map((step, i) => (
                      <div
                        key={i}
                        className="grid items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5"
                        style={{ gridTemplateColumns: '40px 1fr 130px 1fr 70px' }}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            onClick={() => moveStep(i, -1)} disabled={i === 0}
                            className={`text-xs ${i === 0 ? 'cursor-default opacity-30' : 'cursor-pointer'}`}
                          >▲</button>
                          <span className="text-xs text-muted-foreground">{i + 1}</span>
                          <button
                            onClick={() => moveStep(i, 1)} disabled={i === editSteps.length - 1}
                            className={`text-xs ${i === editSteps.length - 1 ? 'cursor-default opacity-30' : 'cursor-pointer'}`}
                          >▼</button>
                        </div>
                        <Input
                          placeholder="步驟名稱"
                          value={step.step_name}
                          onChange={e => updateStep(i, { step_name: e.target.value })}
                        />
                        <select
                          value={step.reviewer_type}
                          onChange={e => updateStep(i, {
                            reviewer_type: e.target.value as 'org_role' | 'system_role',
                            role_type_id: null,
                            system_role_id: null,
                          })}
                          className={selectClass}
                        >
                          <option value="org_role">組織職位</option>
                          <option value="system_role">系統角色</option>
                        </select>
                        {step.reviewer_type === 'org_role' ? (
                          <select
                            value={step.role_type_id ?? ''}
                            onChange={e => updateStep(i, { role_type_id: Number(e.target.value) || null })}
                            className={selectClass}
                          >
                            <option value="">選擇職位</option>
                            {roleTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                          </select>
                        ) : (
                          <select
                            value={step.system_role_id ?? ''}
                            onChange={e => updateStep(i, { system_role_id: Number(e.target.value) || null })}
                            className={selectClass}
                          >
                            <option value="">選擇角色</option>
                            {systemRoles.map(sr => <option key={sr.id} value={sr.id}>{sr.name}</option>)}
                          </select>
                        )}
                        <button
                          onClick={() => removeStep(i)}
                          className="text-sm text-destructive hover:underline"
                        >
                          刪除
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addStep}
                    className="mt-2.5 rounded-lg border border-dashed border-border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
                  >
                    ＋ 新增步驟
                  </button>
                </div>

                <div className="flex gap-2.5">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? '儲存中...' : '儲存'}
                  </Button>
                  <Button variant="outline" onClick={() => { setSelectedTemplate(null); setIsPanelOpen(false); setEditName(''); setEditSteps([]); setEditPaymentAccountIds([]) }}>
                    取消
                  </Button>
                </div>
              </div>
            </CardContent>
          ) : (
            <CardContent className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">選擇一個範本進行編輯，或點「新增範本」</p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
