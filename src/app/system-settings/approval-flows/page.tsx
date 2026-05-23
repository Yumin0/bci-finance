'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ApprovalFlowTemplate, ApprovalFlowStepWithRole, DropdownOption, RoleType, SystemRole } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

export default function ApprovalFlowsPage() {
  const [creatingForType, setCreatingForType] = useState<FormType>('funds_allocation')
  const [templates, setTemplates] = useState<ApprovalFlowTemplate[]>([])
  const [roleTypes, setRoleTypes] = useState<RoleType[]>([])
  const [systemRoles, setSystemRoles] = useState<SystemRole[]>([])
  const [paymentAccounts, setPaymentAccounts] = useState<DropdownOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 編輯狀態
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

  if (loading) return <p style={{ padding: 24 }}>載入中...</p>

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 600 }}>
      {/* 左側：範本列表 */}
      <div style={{ width: 280, borderRight: '1px solid var(--border-color)', padding: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>審核流程管理</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>設定各表單的審核流程範本</p>

        {/* 分區列表（不用 tab） */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {FORM_SECTIONS.map(({ type, label }) => {
            const sectionTemplates = templates.filter(t => t.form_type === type)
            return (
              <div key={type}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.05em' }}>
                  {label}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                  {sectionTemplates.length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--text-subtle)' }}>尚無範本</p>
                  )}
                  {sectionTemplates.map(t => (
                    <div
                      key={t.id}
                      style={{
                        border: `1px solid ${selectedTemplate?.id === t.id ? 'var(--accent)' : 'var(--border-color)'}`,
                        borderRadius: 8, padding: '10px 12px',
                        background: selectedTemplate?.id === t.id ? 'var(--bg-sidebar)' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</span>
                        <button onClick={() => handleDelete(t)} style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>
                          刪除
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                          <input type="checkbox" checked={t.is_active} onChange={() => handleToggleActive(t)} />
                          {t.is_active ? '啟用中' : '已停用'}
                        </label>
                        <button
                          onClick={() => openEdit(t)}
                          style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, border: '1px solid var(--btn-border)', background: 'none', cursor: 'pointer', color: 'var(--text-body)' }}
                        >
                          編輯
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => openNew(type)}
                  style={{ width: '100%', padding: '7px 0', borderRadius: 6, fontSize: 12, border: '1px dashed var(--btn-border)', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  ＋ 新增範本
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* 右側：編輯面板 */}
      {isPanelOpen ? (
        <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>
            {selectedTemplate
              ? `編輯範本：${selectedTemplate.name}`
              : `新增範本（${FORM_SECTIONS.find(s => s.type === creatingForType)?.label ?? ''}）`}
          </h2>

          {error && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 13 }}>{error}</p>}

          {/* 範本名稱 */}
          <section style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>範本名稱</label>
            <Input value={editName} onChange={e => setEditName(e.target.value)} style={{ maxWidth: 360 }} />
          </section>

          {/* 適用出款帳號（暫付款沖銷憑單不需綁定帳號） */}
          <section style={{ marginBottom: 28, display: (selectedTemplate?.form_type ?? creatingForType) === 'temp_voucher' ? 'none' : undefined }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
              適用出款帳號
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6, fontSize: 12 }}>
                （已被其他啟用範本使用的帳號無法選取）
              </span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paymentAccounts.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-subtle)' }}>尚無出款帳號選項，請先在支出欄位設定中新增</p>
              )}
              {paymentAccounts.map(pa => {
                const occupied = usedAccountIds.includes(pa.id)
                const checked = editPaymentAccountIds.includes(pa.id)
                return (
                  <label
                    key={pa.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: occupied ? 'not-allowed' : 'pointer', opacity: occupied ? 0.45 : 1 }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={occupied}
                      onChange={() => togglePaymentAccount(pa.id)}
                    />
                    {pa.label}
                    {occupied && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>（已被其他範本使用）</span>}
                  </label>
                )
              })}
            </div>
          </section>

          {/* 步驟設定 */}
          <section style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 12 }}>步驟設定</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {editSteps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 130px 1fr 70px',
                    gap: 8, alignItems: 'center',
                    padding: '10px 12px', borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-sidebar)',
                  }}
                >
                  {/* 上下移動 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                    <button
                      onClick={() => moveStep(i, -1)} disabled={i === 0}
                      style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', fontSize: 12, opacity: i === 0 ? 0.3 : 1 }}
                    >▲</button>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{i + 1}</span>
                    <button
                      onClick={() => moveStep(i, 1)} disabled={i === editSteps.length - 1}
                      style={{ background: 'none', border: 'none', cursor: i === editSteps.length - 1 ? 'default' : 'pointer', fontSize: 12, opacity: i === editSteps.length - 1 ? 0.3 : 1 }}
                    >▼</button>
                  </div>

                  {/* 步驟名稱 */}
                  <Input
                    placeholder="步驟名稱"
                    value={step.step_name}
                    onChange={e => updateStep(i, { step_name: e.target.value })}
                  />

                  {/* 審核人類型 */}
                  <select
                    value={step.reviewer_type}
                    onChange={e => updateStep(i, {
                      reviewer_type: e.target.value as 'org_role' | 'system_role',
                      role_type_id: null,
                      system_role_id: null,
                    })}
                    style={{
                      padding: '8px 10px', borderRadius: 6, fontSize: 14,
                      border: '1px solid var(--btn-border)', background: 'var(--bg-page)',
                      color: 'var(--text-body)', cursor: 'pointer',
                    }}
                  >
                    <option value="org_role">組織職位</option>
                    <option value="system_role">系統角色</option>
                  </select>

                  {/* 角色選擇 */}
                  {step.reviewer_type === 'org_role' ? (
                    <select
                      value={step.role_type_id ?? ''}
                      onChange={e => updateStep(i, { role_type_id: Number(e.target.value) || null })}
                      style={{
                        padding: '8px 10px', borderRadius: 6, fontSize: 14,
                        border: '1px solid var(--btn-border)', background: 'var(--bg-page)',
                        color: 'var(--text-body)', cursor: 'pointer',
                      }}
                    >
                      <option value="">選擇職位</option>
                      {roleTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                    </select>
                  ) : (
                    <select
                      value={step.system_role_id ?? ''}
                      onChange={e => updateStep(i, { system_role_id: Number(e.target.value) || null })}
                      style={{
                        padding: '8px 10px', borderRadius: 6, fontSize: 14,
                        border: '1px solid var(--btn-border)', background: 'var(--bg-page)',
                        color: 'var(--text-body)', cursor: 'pointer',
                      }}
                    >
                      <option value="">選擇角色</option>
                      {systemRoles.map(sr => <option key={sr.id} value={sr.id}>{sr.name}</option>)}
                    </select>
                  )}

                  {/* 刪除 */}
                  <button
                    onClick={() => removeStep(i)}
                    style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}
                  >
                    刪除
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addStep}
              style={{
                marginTop: 10, padding: '7px 16px', borderRadius: 6, fontSize: 13,
                border: '1px dashed var(--btn-border)', background: 'none',
                cursor: 'pointer', color: 'var(--text-muted)',
              }}
            >
              ＋ 新增步驟
            </button>
          </section>

          {/* 儲存 / 取消 */}
          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '儲存中...' : '儲存'}
            </Button>
            <Button variant="outline" onClick={() => { setSelectedTemplate(null); setIsPanelOpen(false); setEditName(''); setEditSteps([]); setEditPaymentAccountIds([]) }}>
              取消
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          選擇一個範本進行編輯，或點「新增範本」
        </div>
      )}
    </div>
  )
}
