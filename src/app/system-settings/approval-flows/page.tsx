'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ApprovalFlowTemplate, ApprovalFlowStepWithRole, DropdownOption, RoleType, SystemRole, ApprovalGroup } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/app/_components/PageHeader'
import OrgApprovalTabNav from '@/app/_components/OrgApprovalTabNav'
import {
  createTemplate, updateTemplateName, toggleTemplateActive, deleteTemplate,
  saveTemplateSteps, saveTemplatePaymentAccounts, getUsedPaymentAccountIds,
} from '@/app/actions/approval-flow'
import {
  getApprovalGroups, createApprovalGroup, updateApprovalGroup, deleteApprovalGroup,
  getGroupMembers, addGroupMember, removeGroupMember,
} from '@/app/actions/approval-groups'

type PageTab = 'templates' | 'groups'
type FormType = 'funds_allocation' | 'payment_voucher' | 'temp_voucher'

type StepDraft = {
  step_number: number
  step_name: string
  reviewer_type: 'org_role' | 'system_role' | 'approval_group'
  role_type_id: number | null
  system_role_id: number | null
  approval_group_id: number | null
}

const FORM_SECTIONS: { type: FormType; label: string }[] = [
  { type: 'funds_allocation', label: '資金分配申請' },
  { type: 'payment_voucher', label: '付款憑單' },
  { type: 'temp_voucher', label: '暫付款沖銷憑單' },
]

const selectClass = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus:border-ring dark:bg-input/30'

// ── 審核群組管理 Tab ──────────────────────────────────────────────────────────

type GroupMember = {
  id: number
  group_id: number
  user_id: number
  created_at: string
  app_users: { id: number; name: string; email: string } | null
}

type AccountOption = { id: number; name: string; email: string }

function GroupsTab() {
  const [groups, setGroups] = useState<ApprovalGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<ApprovalGroup | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newGroupName, setNewGroupName] = useState('')
  const [addingGroup, setAddingGroup] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')

  const [memberSearch, setMemberSearch] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  async function loadGroups() {
    const data = await getApprovalGroups()
    setGroups(data)
    setLoading(false)
  }

  async function loadAccounts() {
    const { data } = await supabase.from('app_users').select('id, name, email').order('sort_order', { ascending: true, nullsFirst: false }).order('id')
    setAccounts((data ?? []) as AccountOption[])
  }

  useEffect(() => {
    loadGroups()
    loadAccounts()
  }, [])

  async function loadMembers(groupId: number) {
    setMembersLoading(true)
    const data = await getGroupMembers(groupId)
    setMembers(data)
    setMembersLoading(false)
  }

  function selectGroup(group: ApprovalGroup) {
    setSelectedGroup(group)
    setEditingGroupId(null)
    setMemberSearch('')
    loadMembers(group.id)
  }

  async function handleAddGroup() {
    if (!newGroupName.trim()) return
    setAddingGroup(true)
    setError(null)
    try {
      await createApprovalGroup(newGroupName.trim())
      setNewGroupName('')
      await loadGroups()
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增失敗')
    } finally {
      setAddingGroup(false)
    }
  }

  async function handleSaveGroupName(group: ApprovalGroup) {
    if (!editingGroupName.trim()) return
    setError(null)
    try {
      await updateApprovalGroup(group.id, editingGroupName.trim())
      setEditingGroupId(null)
      await loadGroups()
      if (selectedGroup?.id === group.id) {
        setSelectedGroup({ ...group, name: editingGroupName.trim() })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗')
    }
  }

  async function handleDeleteGroup(group: ApprovalGroup) {
    if (!confirm(`確定刪除群組「${group.name}」？已使用此群組的審核步驟將失效。`)) return
    setError(null)
    try {
      await deleteApprovalGroup(group.id)
      if (selectedGroup?.id === group.id) { setSelectedGroup(null); setMembers([]) }
      await loadGroups()
    } catch (e) {
      setError(e instanceof Error ? e.message : '刪除失敗')
    }
  }

  async function handleAddMember(account: AccountOption) {
    if (!selectedGroup) return
    const alreadyIn = members.some(m => m.user_id === account.id)
    if (alreadyIn) return
    setAddingMember(true)
    setError(null)
    try {
      await addGroupMember(selectedGroup.id, account.id)
      setMemberSearch('')
      await loadMembers(selectedGroup.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增成員失敗')
    } finally {
      setAddingMember(false)
    }
  }

  async function handleRemoveMember(memberId: number) {
    if (!selectedGroup) return
    setError(null)
    try {
      await removeGroupMember(memberId)
      await loadMembers(selectedGroup.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : '移除失敗')
    }
  }

  const memberIds = new Set(members.map(m => m.user_id))
  const searchResults = memberSearch.trim()
    ? accounts.filter(a =>
        !memberIds.has(a.id) &&
        (a.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
          a.email.toLowerCase().includes(memberSearch.toLowerCase()))
      ).slice(0, 8)
    : []

  if (loading) return <p className="text-sm text-muted-foreground">載入中...</p>

  return (
    <div className="flex items-start gap-6">
      {/* 左側：群組列表 */}
      <div className="w-56 shrink-0">
        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
        <Card className="gap-0 overflow-hidden p-0">
          {groups.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">尚無群組</p>}
          {groups.map((g, i) => (
            <div
              key={g.id}
              className={`flex cursor-pointer items-center justify-between px-3.5 py-2.5 transition-colors ${i > 0 ? 'border-t border-border' : ''} ${selectedGroup?.id === g.id ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
              onClick={() => selectGroup(g)}
            >
              {editingGroupId === g.id ? (
                <div className="flex flex-1 items-center gap-1" onClick={e => e.stopPropagation()}>
                  <Input
                    value={editingGroupName}
                    onChange={e => setEditingGroupName(e.target.value)}
                    className="h-6 flex-1 px-1.5 text-xs"
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveGroupName(g) }}
                    autoFocus
                  />
                  <button onClick={() => handleSaveGroupName(g)} className="text-xs text-primary hover:underline">儲存</button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium text-foreground">{g.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); setEditingGroupId(g.id); setEditingGroupName(g.name) }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >改名</button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteGroup(g) }}
                      className="text-xs text-destructive hover:underline"
                    >刪除</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </Card>

        <div className="mt-2.5 flex gap-1.5">
          <Input
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            placeholder="新群組名稱"
            className="h-8 text-sm"
            onKeyDown={e => { if (e.key === 'Enter') handleAddGroup() }}
          />
          <Button size="sm" onClick={handleAddGroup} disabled={addingGroup || !newGroupName.trim()}>
            新增
          </Button>
        </div>
      </div>

      {/* 右側：群組成員 */}
      <Card className="min-h-48 flex-1">
        <CardContent>
          {!selectedGroup ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">← 點選左側群組來管理成員</p>
            </div>
          ) : (
            <>
              <CardHeader className="px-0 pt-0">
                <CardTitle>群組成員：{selectedGroup.name}</CardTitle>
              </CardHeader>

              {/* 搜尋新增成員 */}
              <div className="relative mb-4">
                <Input
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  placeholder="搜尋帳號姓名或 Email 來新增成員..."
                  className="bg-background"
                  disabled={addingMember}
                />
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
                    {searchResults.map(a => (
                      <button
                        key={a.id}
                        onClick={() => handleAddMember(a)}
                        className="flex w-full items-center justify-between px-3.5 py-2 text-left hover:bg-muted"
                      >
                        <span className="text-sm font-medium text-foreground">{a.name}</span>
                        <span className="text-xs text-muted-foreground">{a.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {memberSearch.trim() && searchResults.length === 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-border bg-popover px-3.5 py-2.5 text-sm text-muted-foreground shadow-md">
                    找不到符合的帳號（已在群組中的不顯示）
                  </div>
                )}
              </div>

              {/* 成員列表 */}
              {membersLoading ? (
                <p className="text-sm text-muted-foreground">載入中...</p>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground">此群組尚無成員，搜尋帳號來新增</p>
              ) : (
                <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center justify-between px-3.5 py-2.5">
                      <div>
                        <span className="text-sm font-medium text-foreground">{m.app_users?.name ?? `用戶 #${m.user_id}`}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{m.app_users?.email}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(m.id)}
                        className="text-xs text-destructive hover:underline"
                      >移除</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── 審核流程範本 Tab ──────────────────────────────────────────────────────────

function TemplatesTab() {
  const [creatingForType, setCreatingForType] = useState<FormType>('funds_allocation')
  const [templates, setTemplates] = useState<ApprovalFlowTemplate[]>([])
  const [roleTypes, setRoleTypes] = useState<{ id: number; name: string }[]>([])
  const [systemRoles, setSystemRoles] = useState<SystemRole[]>([])
  const [approvalGroups, setApprovalGroups] = useState<ApprovalGroup[]>([])
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
    const [tmplRes, rtRes, srRes, paRes, grpData] = await Promise.all([
      supabase.from('approval_flow_templates').select('*').order('created_at', { ascending: true }),
      supabase.from('role_types').select('*').order('sort_order'),
      supabase.from('system_roles').select('*').order('sort_order'),
      supabase.from('dropdown_options').select('*').eq('field', 'payment_account').order('sort_order'),
      getApprovalGroups(),
    ])
    setTemplates((tmplRes.data as ApprovalFlowTemplate[]) ?? [])
    setRoleTypes((rtRes.data as { id: number; name: string }[]) ?? [])
    setSystemRoles((srRes.data as SystemRole[]) ?? [])
    setPaymentAccounts((paRes.data as DropdownOption[]) ?? [])
    setApprovalGroups(grpData)
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
      approval_group_id: s.approval_group_id,
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
      if (s.reviewer_type === 'approval_group' && !s.approval_group_id) { setError('請選擇審核群組'); return }
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
      { step_number: prev.length + 1, step_name: '', reviewer_type: 'org_role', role_type_id: null, system_role_id: null, approval_group_id: null },
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
                      style={{ gridTemplateColumns: '40px 1fr 140px 1fr 70px' }}
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
                        value={step.reviewer_type === 'system_role' ? 'approval_group' : step.reviewer_type}
                        onChange={e => updateStep(i, {
                          reviewer_type: e.target.value as 'org_role' | 'approval_group',
                          role_type_id: null,
                          system_role_id: null,
                          approval_group_id: null,
                        })}
                        className={selectClass}
                      >
                        <option value="org_role">組織職位</option>
                        <option value="approval_group">審核群組</option>
                      </select>
                      {step.reviewer_type === 'org_role' && (
                        <select
                          value={step.role_type_id ?? ''}
                          onChange={e => updateStep(i, { role_type_id: Number(e.target.value) || null })}
                          className={selectClass}
                        >
                          <option value="">選擇職位</option>
                          {roleTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                        </select>
                      )}
                      {step.reviewer_type === 'system_role' && (
                        <select
                          value={step.system_role_id ?? ''}
                          onChange={e => updateStep(i, { system_role_id: Number(e.target.value) || null })}
                          className={selectClass}
                        >
                          <option value="">選擇角色</option>
                          {systemRoles.map(sr => <option key={sr.id} value={sr.id}>{sr.name}</option>)}
                        </select>
                      )}
                      {step.reviewer_type === 'approval_group' && (
                        <select
                          value={step.approval_group_id ?? ''}
                          onChange={e => updateStep(i, { approval_group_id: Number(e.target.value) || null })}
                          className={selectClass}
                        >
                          <option value="">選擇審核群組</option>
                          {approvalGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
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
  )
}

// ── 主頁面 ────────────────────────────────────────────────────────────────────

export default function ApprovalFlowsPage() {
  const [tab, setTab] = useState<PageTab>('templates')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader title="組織架構與審核管理" />
        <p className="mt-1 text-sm text-muted-foreground">設定各表單的審核流程範本與審核群組</p>
      </div>

      <OrgApprovalTabNav />

      <div className="flex border-b border-border">
        {([
          { key: 'templates', label: '流程範本' },
          { key: 'groups', label: '審核群組' },
        ] as { key: PageTab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-5 py-2 text-sm font-medium transition-colors ${tab === t.key ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'templates' ? <TemplatesTab /> : <GroupsTab />}
    </div>
  )
}
