'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { FundsAllocation, FormBlock, FormSlot, DropdownOption } from '@/lib/types'
import { createPayment } from '@/app/actions/payment'
import { getFormSchemas } from '@/app/actions/form-schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'


function getAllocFieldValue(fieldId: string, record: FundsAllocation): string {
  const map: Record<string, unknown> = {
    purchase_order_number: record.serial_number ? `${record.serial_number}001` : '-',
    date: record.date,
    apply_division: record.apply_division,
    apply_section: record.apply_section,
    applicant: record.applicant,
    apply_role: record.apply_role,
    institution: record.institution,
    payment_account: record.payment_account,
    expense_item: record.expense_item,
    name: record.name,
    amount: record.amount,
    note: record.note,
  }
  const val = map[fieldId]
  if (val == null || val === '') return '-'
  return String(val)
}

export default function AddPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [record, setRecord] = useState<FundsAllocation | null>(null)
  const [allocationId, setAllocationId] = useState<number | null>(null)
  const [schema, setSchema] = useState<FormBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, DropdownOption[]>>({})
  const [dynamicSelectOptions, setDynamicSelectOptions] = useState<Record<string, { value: string; label: string }[]>>({})
  const [payeeFullRecords, setPayeeFullRecords] = useState<Record<string, Array<{ label: string; searchKey: string; fieldValuesByLabel: Record<string, string> }>>>({})
  const [payeeSearch, setPayeeSearch] = useState<Record<string, string>>({})
  const [openPayeeId, setOpenPayeeId] = useState<string | null>(null)

  const setField = useCallback((id: string, val: string) => {
    setFieldValues(prev => ({ ...prev, [id]: val }))
  }, [])

  useEffect(() => {
    async function load() {
      const { id } = await params
      const numId = Number(id)
      setAllocationId(numId)

      const [{ data, error: fetchError }, schemas] = await Promise.all([
        supabase.from('funds_allocation').select('*').eq('id', numId).single(),
        getFormSchemas(),
      ])
      if (fetchError) { setError(fetchError.message); setLoading(false); return }
      setRecord(data as FundsAllocation)

      const paymentSchema = schemas.payment_voucher
      setSchema(paymentSchema)

      const allSlots: NonNullable<FormSlot>[] = paymentSchema.flatMap(b =>
        b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null))
      )
      const neededSources = new Set(allSlots.map(s => s.dataSource))

      const fetches: Promise<void>[] = []

      const dropdownFields: string[] = []
      if (neededSources.has('dropdown_options:institution')) dropdownFields.push('institution')
      if (neededSources.has('dropdown_options:payment_account')) dropdownFields.push('payment_account')
      if (dropdownFields.length) {
        fetches.push(
          (async () => {
            const { data: opts } = await supabase.from('dropdown_options').select('*').in('field', dropdownFields).order('sort_order')
            if (opts) {
              const grouped: Record<string, DropdownOption[]> = {}
              for (const opt of opts as DropdownOption[]) {
                if (!grouped[opt.field]) grouped[opt.field] = []
                grouped[opt.field].push(opt)
              }
              setDropdownOptions(grouped)
            }
          })()
        )
      }

      for (const src of neededSources) {
        if (src.startsWith('fee_records:') || src.startsWith('payee_records:')) {
          fetches.push(
            (async () => {
              const isPayee = src.startsWith('payee_records:')
              const [table, idStr] = isPayee
                ? ['payee_records', src.replace('payee_records:', '')] as const
                : ['fee_records', src.replace('fee_records:', '')] as const
              const fieldsTable = isPayee ? 'payee_category_fields' : 'fee_category_fields'
              const categoryId = Number(idStr)
              const [fieldsRes, recordsRes] = await Promise.all([
                supabase.from(fieldsTable).select('id, label, sort_order').eq('category_id', categoryId).order('sort_order'),
                supabase.from(table).select('field_values').eq('category_id', categoryId).order('sort_order'),
              ])
              const fields = (fieldsRes.data ?? []) as { id: number; label: string }[]
              const fieldIds = fields.map(f => String(f.id))
              const options: { value: string; label: string }[] = []
              const fullRecords: Array<{ label: string; searchKey: string; fieldValuesByLabel: Record<string, string> }> = []
              for (const r of recordsRes.data ?? []) {
                const fv = r.field_values as Record<string, string>
                const vals = fieldIds.map(fId => fv[fId]).filter(Boolean)
                const searchKey = vals.join(' ')
                const label = fv[fieldIds[0]] ?? vals[0] ?? ''
                if (!label) continue
                options.push({ value: label, label })
                if (isPayee) {
                  const fieldValuesByLabel: Record<string, string> = {}
                  for (const f of fields) {
                    const v = fv[String(f.id)]
                    if (v) fieldValuesByLabel[f.label] = v
                  }
                  fullRecords.push({ label, searchKey, fieldValuesByLabel })
                }
              }
              setDynamicSelectOptions(prev => ({ ...prev, [src]: options }))
              if (isPayee) setPayeeFullRecords(prev => ({ ...prev, [src]: fullRecords }))
            })()
          )
        }
      }

      await Promise.all(fetches)
      setLoading(false)
    }
    load()
  }, [params])

  function handlePayeeSelect(fieldId: string, src: string, chosen: { label: string; fieldValuesByLabel: Record<string, string> }) {
    setField(fieldId, chosen.label)
    setPayeeSearch(prev => ({ ...prev, [fieldId]: chosen.label }))
    setOpenPayeeId(null)
    const allSlots: NonNullable<FormSlot>[] = schema.flatMap(b =>
      b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null))
    )
    for (const slot of allSlots) {
      if (slot.fieldId === fieldId) continue
      const val = chosen.fieldValuesByLabel[slot.label]
      if (val !== undefined) setField(slot.fieldId, val)
    }
  }

  function renderPayeeCombobox(slot: NonNullable<FormSlot>, src: string) {
    const records = payeeFullRecords[src] ?? []
    const searchText = payeeSearch[slot.fieldId] ?? fieldValues[slot.fieldId] ?? ''
    const filtered = records.filter(r => r.searchKey.toLowerCase().includes(searchText.toLowerCase()))
    const isOpen = openPayeeId === slot.fieldId
    return (
      <div style={{ position: 'relative' }}>
        <Input
          value={searchText}
          onChange={e => {
            setPayeeSearch(prev => ({ ...prev, [slot.fieldId]: e.target.value }))
            setField(slot.fieldId, e.target.value)
            setOpenPayeeId(slot.fieldId)
          }}
          onFocus={() => setOpenPayeeId(slot.fieldId)}
          onBlur={() => setTimeout(() => setOpenPayeeId(null), 150)}
          placeholder="輸入姓名搜尋..."
          required={slot.required}
        />
        {isOpen && filtered.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: 'white', border: '1px solid var(--border-color)',
            borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            zIndex: 50, maxHeight: 200, overflowY: 'auto',
          }}>
            {filtered.map((r, i) => (
              <div
                key={i}
                onMouseDown={() => handlePayeeSelect(slot.fieldId, src, r)}
                style={{ padding: '8px 12px', fontSize: 14, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-sidebar)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                {r.label}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderField(slot: NonNullable<FormSlot>, rec: FundsAllocation) {
    const { fieldId, type, dataSource, staticOptions, required } = slot

    // Only readonly type → auto-filled from allocation record
    if (type === 'readonly') {
      return <Input value={getAllocFieldValue(fieldId, rec)} readOnly className="bg-[var(--bg-page)] cursor-not-allowed" />
    }

    if (type === 'radio') {
      return (
        <div style={{ display: 'flex', gap: 20, padding: '8px 0' }}>
          {(staticOptions ?? []).map(opt => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
              <input
                type="radio"
                name={fieldId}
                value={opt}
                checked={fieldValues[fieldId] === opt}
                onChange={e => setField(fieldId, e.target.value)}
                required={required && !fieldValues[fieldId]}
              />
              {opt}
            </label>
          ))}
        </div>
      )
    }

    if (type === 'select') {
      if (dataSource.startsWith('payee_records:') && payeeFullRecords[dataSource]) {
        return renderPayeeCombobox(slot, dataSource)
      }
      let options: { value: string; label: string }[] = []
      if (dataSource === 'static') {
        options = (staticOptions ?? []).map(o => ({ value: o, label: o }))
      } else if (dataSource.startsWith('dropdown_options:')) {
        const field = dataSource.replace('dropdown_options:', '')
        options = (dropdownOptions[field] ?? []).map(o => ({ value: o.label, label: o.label }))
      } else if (dataSource.startsWith('fee_records:') || dataSource.startsWith('payee_records:')) {
        options = dynamicSelectOptions[dataSource] ?? []
      }
      return (
        <select
          value={fieldValues[fieldId] ?? ''}
          onChange={e => setField(fieldId, e.target.value)}
          required={required}
          style={selectStyle}
        >
          <option value="">請選擇</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }

    if (type === 'textarea') {
      return (
        <Textarea
          value={fieldValues[fieldId] ?? ''}
          onChange={e => setField(fieldId, e.target.value)}
          required={required}
          rows={4}
        />
      )
    }

    const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'
    return (
      <Input
        type={inputType}
        value={fieldValues[fieldId] ?? ''}
        onChange={e => setField(fieldId, e.target.value)}
        required={required}
      />
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allocationId || !record) return
    setSubmitting(true)
    setError(null)

    const allSlots: NonNullable<FormSlot>[] = schema.flatMap(b =>
      b.rows.flatMap(r => r.slots.filter((s): s is NonNullable<FormSlot> => s !== null))
    )
    const extraData: Record<string, string> = {}
    for (const slot of allSlots) {
      if (slot.type === 'readonly') continue
      if (slot.fieldId === 'payment_method') continue
      extraData[slot.label] = fieldValues[slot.fieldId] ?? ''
    }

    const { error: insertError } = await createPayment(
      allocationId,
      fieldValues['payment_method'] ?? '',
      extraData,
    )
    if (insertError) { setError(insertError); setSubmitting(false); return }
    router.push('/funds-payment/my-payment')
  }

  if (loading) return <p>載入中...</p>
  if (!record) return <p style={{ color: 'red' }}>找不到資金分配申請單</p>

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>建立付款憑單</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>資金分配申請單 #{record.id}</p>

      {error && <p style={errorStyle}>錯誤：{error}</p>}

      <form onSubmit={handleSubmit}>
        {schema.map(block => {
          if (block.showWhen && fieldValues[block.showWhen.fieldId] !== block.showWhen.value) return null
          return (
            <div key={block.id} style={{
              marginBottom: 16,
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              overflow: 'hidden',
              background: 'var(--bg-card)',
            }}>
              {block.title && (
                <div style={{
                  padding: '10px 20px',
                  background: 'var(--bg-sidebar)',
                  borderBottom: '1px solid var(--border-color)',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>{block.title}</span>
                </div>
              )}
              <div style={{ padding: '20px 20px 4px' }}>
                {block.rows.map(row => (
                  <div key={row.id} style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${row.cols}, 1fr)`,
                    gap: 20,
                    marginBottom: 20,
                  }}>
                    {row.slots.map((slot, idx) => {
                      if (slot && slot.showWhen && !slot.showWhen.values.includes(fieldValues[slot.showWhen.fieldId] ?? '')) {
                        return <div key={idx} />
                      }
                      return slot ? (
                        <div key={idx}>
                          <label style={labelStyle}>
                            {slot.label}
                            {slot.required && slot.type !== 'readonly' && (
                              <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>
                            )}
                          </label>
                          {renderField(slot, record)}
                        </div>
                      ) : <div key={idx} />
                    })}
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? '建立中...' : '建立付款憑單'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
        </div>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-body)', marginBottom: 6 }
const selectStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--btn-border)', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', background: 'white', cursor: 'pointer' }
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginBottom: 8 }
