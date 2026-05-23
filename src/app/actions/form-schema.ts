'use server'

import { supabase } from '@/lib/supabase'
import { FormBlock, FormSchemaRow, FormType, FormDataSourceDef } from '@/lib/types'

const FALLBACK_DATA_SOURCES: FormDataSourceDef[] = [
  { id: 1,  label: '無（手動輸入）',       source_key: 'none',                          applicable_types: ['text','number','date'],          is_static_options: false, sort_order: 0 },
  { id: 2,  label: '目前使用者姓名',       source_key: 'current_user_name',             applicable_types: ['text','number','date','readonly'], is_static_options: false, sort_order: 10 },
  { id: 3,  label: '目前使用者 ID',        source_key: 'current_user_id',               applicable_types: ['text','number'],                 is_static_options: false, sort_order: 20 },
  { id: 4,  label: '目前使用者 Email',     source_key: 'current_user_email',            applicable_types: ['text'],                          is_static_options: false, sort_order: 30 },
  { id: 5,  label: '目前使用者職稱',       source_key: 'current_user_role',             applicable_types: ['text','readonly'],               is_static_options: false, sort_order: 40 },
  { id: 6,  label: '今天日期（自動帶入）', source_key: 'today_date',                    applicable_types: ['date'],                          is_static_options: false, sort_order: 50 },
  { id: 7,  label: '系統自動流水號',       source_key: 'auto_number',                   applicable_types: ['text','number'],                 is_static_options: false, sort_order: 60 },
  { id: 8,  label: '自訂選項（手動輸入）', source_key: 'static',                        applicable_types: ['select','radio'],                is_static_options: true,  sort_order: 70 },
  { id: 9,  label: '費用項目清單',         source_key: 'expense_items',                 applicable_types: ['select'],                        is_static_options: false, sort_order: 80 },
  { id: 10, label: '機構清單',             source_key: 'dropdown_options:institution',  applicable_types: ['select'],                        is_static_options: false, sort_order: 90 },
  { id: 11, label: '出款帳戶清單',         source_key: 'dropdown_options:payment_account', applicable_types: ['select'],                     is_static_options: false, sort_order: 100 },
  { id: 12, label: '組織單位（處）',       source_key: 'org_units:division',            applicable_types: ['select'],                        is_static_options: false, sort_order: 110 },
  { id: 13, label: '組織單位（課）',       source_key: 'org_units:section',             applicable_types: ['select'],                        is_static_options: false, sort_order: 120 },
  { id: 14, label: '組織職稱清單',         source_key: 'org_unit_roles',                applicable_types: ['select'],                        is_static_options: false, sort_order: 130 },
]

export async function getFormDataSources(): Promise<FormDataSourceDef[]> {
  try {
    const { data, error } = await supabase
      .from('form_data_sources')
      .select('*')
      .order('sort_order')
    if (error || !data?.length) return FALLBACK_DATA_SOURCES
    return data as FormDataSourceDef[]
  } catch {
    return FALLBACK_DATA_SOURCES
  }
}

const DEFAULT_FUNDS_BLOCKS: FormBlock[] = [
  {
    id: 'block_funds_1', title: null, rows: [
      { id: 'r1', cols: 2, slots: [
        { fieldId: 'date', label: '申請日期', required: true, type: 'date', dataSource: 'none' },
        { fieldId: 'apply_division', label: '申請處別', required: false, type: 'select', dataSource: 'org_units:division' },
      ]},
      { id: 'r2', cols: 2, slots: [
        { fieldId: 'apply_section', label: '申請課別', required: false, type: 'select', dataSource: 'org_units:section' },
        { fieldId: 'applicant', label: '申請人', required: false, type: 'readonly', dataSource: 'current_user_name' },
      ]},
      { id: 'r3', cols: 2, slots: [
        { fieldId: 'apply_role', label: '職稱', required: false, type: 'select', dataSource: 'org_unit_roles' },
        { fieldId: 'category', label: '類型', required: false, type: 'radio', dataSource: 'static', staticOptions: ['一般', '預支'] },
      ]},
    ],
  },
  {
    id: 'block_funds_2', title: null, rows: [
      { id: 'r4', cols: 2, slots: [
        { fieldId: 'institution', label: '機構', required: false, type: 'select', dataSource: 'dropdown_options:institution' },
        { fieldId: 'payment_account', label: '出款帳戶', required: false, type: 'select', dataSource: 'dropdown_options:payment_account' },
      ]},
      { id: 'r5', cols: 2, slots: [
        { fieldId: 'expense_item', label: '費用項目', required: false, type: 'select', dataSource: 'expense_items' },
        { fieldId: 'name', label: '項目', required: true, type: 'text', dataSource: 'none' },
      ]},
      { id: 'r6', cols: 2, slots: [
        { fieldId: 'amount', label: '金額', required: true, type: 'number', dataSource: 'none' },
        null,
      ]},
    ],
  },
  {
    id: 'block_funds_3', title: null, rows: [
      { id: 'r7', cols: 1, slots: [
        { fieldId: 'note', label: '備註', required: false, type: 'textarea', dataSource: 'none' },
      ]},
    ],
  },
]

const DEFAULT_PAYMENT_BLOCKS: FormBlock[] = [
  {
    id: 'block_pay_1', title: null, rows: [
      { id: 'r1', cols: 2, slots: [
        { fieldId: 'date', label: '日期', required: false, type: 'date', dataSource: 'none' },
        { fieldId: 'apply_division', label: '申請處別', required: false, type: 'select', dataSource: 'org_units:division' },
      ]},
      { id: 'r2', cols: 2, slots: [
        { fieldId: 'apply_section', label: '申請課別', required: false, type: 'select', dataSource: 'org_units:section' },
        { fieldId: 'applicant', label: '申請人', required: false, type: 'readonly', dataSource: 'current_user_name' },
      ]},
      { id: 'r3', cols: 2, slots: [
        { fieldId: 'apply_role', label: '職稱', required: false, type: 'select', dataSource: 'org_unit_roles' },
        null,
      ]},
    ],
  },
  {
    id: 'block_pay_2', title: null, rows: [
      { id: 'r4', cols: 2, slots: [
        { fieldId: 'institution', label: '機構', required: false, type: 'select', dataSource: 'dropdown_options:institution' },
        { fieldId: 'payment_account', label: '出款帳戶', required: false, type: 'select', dataSource: 'dropdown_options:payment_account' },
      ]},
      { id: 'r5', cols: 2, slots: [
        { fieldId: 'expense_item', label: '費用項目', required: false, type: 'select', dataSource: 'expense_items' },
        { fieldId: 'name', label: '項目', required: false, type: 'text', dataSource: 'none' },
      ]},
      { id: 'r6', cols: 2, slots: [
        { fieldId: 'amount', label: '金額', required: false, type: 'number', dataSource: 'none' },
        { fieldId: 'payment_method', label: '付款方式', required: false, type: 'select', dataSource: 'static', staticOptions: ['匯款', '支票', '現金', '其他'] },
      ]},
    ],
  },
  {
    id: 'block_pay_3', title: null, rows: [
      { id: 'r7', cols: 1, slots: [
        { fieldId: 'note', label: '備註', required: false, type: 'textarea', dataSource: 'none' },
      ]},
    ],
  },
]

const DEFAULT_TEMP_VOUCHER_BLOCKS: FormBlock[] = [
  {
    id: 'block_tv_1', title: null, rows: [
      { id: 'r1', cols: 2, slots: [
        { fieldId: 'date', label: '申請日期', required: false, type: 'date', dataSource: 'none' },
        { fieldId: 'applicant', label: '申請人', required: false, type: 'readonly', dataSource: 'current_user_name' },
      ]},
    ],
  },
]

const DEFAULT_BLOCKS: Record<FormType, FormBlock[]> = {
  funds_allocation: DEFAULT_FUNDS_BLOCKS,
  payment_voucher: DEFAULT_PAYMENT_BLOCKS,
  temp_voucher: DEFAULT_TEMP_VOUCHER_BLOCKS,
}

// 偵測是否為舊格式（FormSchemaRow[]），舊格式的元素有 slots 屬性
function isOldRowsFormat(data: unknown): data is FormSchemaRow[] {
  if (!Array.isArray(data) || data.length === 0) return false
  return 'slots' in (data[0] as object)
}

// 偵測是否為「一個大區塊」的遷移暫存格式（isOldRowsFormat 已處理過一次，但尚未重新儲存）
function isSingleMigratedBlock(data: unknown): data is FormBlock[] {
  if (!Array.isArray(data) || data.length !== 1) return false
  const block = data[0] as FormBlock
  return typeof block.id === 'string' && block.id.startsWith('block_migrated_') && Array.isArray(block.rows)
}

function splitFundsAllocationRows(rows: FormSchemaRow[]): FormBlock[] {
  const groups = [
    rows.slice(0, 4),
    rows.slice(4, 6),
    rows.slice(6, 7),
    rows.slice(7),
  ].filter(g => g.length > 0)
  return groups.map((g, i) => ({
    id: `block_funds_split_${i + 1}`,
    title: null,
    rows: g,
  }))
}

export async function getFormSchemas(): Promise<Record<FormType, FormBlock[]>> {
  try {
    const { data, error } = await supabase.from('form_schemas').select('form_type, rows')
    if (error || !data) return { ...DEFAULT_BLOCKS }

    const resolve = (formType: FormType): FormBlock[] => {
      const raw = data.find(d => d.form_type === formType)?.rows
      if (!raw) return DEFAULT_BLOCKS[formType]
      // 舊格式（flat FormSchemaRow[]）：按表單類型分組遷移
      if (isOldRowsFormat(raw)) {
        if (formType === 'funds_allocation') return splitFundsAllocationRows(raw)
        return [{ id: `block_migrated_${formType}`, title: null, rows: raw }]
      }
      // 遷移暫存格式（一個大區塊）：funds_allocation 重新按指定分組拆分
      if (formType === 'funds_allocation' && isSingleMigratedBlock(raw)) {
        return splitFundsAllocationRows((raw as FormBlock[])[0].rows)
      }
      return raw as FormBlock[]
    }

    return {
      funds_allocation: resolve('funds_allocation'),
      payment_voucher: resolve('payment_voucher'),
      temp_voucher: resolve('temp_voucher'),
    }
  } catch {
    return { ...DEFAULT_BLOCKS }
  }
}

export async function saveFormSchema(
  formType: FormType,
  blocks: FormBlock[]
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('form_schemas')
    .upsert({ form_type: formType, rows: blocks, updated_at: new Date().toISOString() }, { onConflict: 'form_type' })
  if (error) return { error: `儲存失敗：${error.message}` }
  return {}
}
