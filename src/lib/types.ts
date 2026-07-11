import { FundsStatus, PaymentStatus } from './constants'

export type FundsPayment = {
  id: number
  funds_allocation_id: number
  name: string
  amount: number
  date: string
  institution: string | null
  payment_account: string | null
  expense_item: string | null
  category: string | null
  note: string | null
  apply_division: string | null
  apply_section: string | null
  applicant: string | null
  apply_role: string | null
  payment_method: string | null
  purchase_order_number: string | null
  extra_data: Record<string, string> | null
  created_by: string
  created_at: string
  status: PaymentStatus
  flow_template_id: number | null
  current_step: number | null
  updated_at: string | null
  // 舊欄位保留中（過渡期備份）
  step1_decision: StepDecision
  step1_comment: string | null
  step1_reviewer: string | null
  step1_at: string | null
  step2_decision: StepDecision
  step2_comment: string | null
  step2_reviewer: string | null
  step2_at: string | null
  step3_decision: StepDecision
  step3_comment: string | null
  step3_reviewer: string | null
  step3_at: string | null
  step4_decision: StepDecision
  step4_comment: string | null
  step4_reviewer: string | null
  step4_at: string | null
}

export type AppUser = {
  id: number
  email: string
  name: string
  avatar_url: string | null
  created_at: string
  updated_at: string | null
}

export type UserPosition = {
  id: number
  user_id: number
  org_unit_role_id: number
  is_primary: boolean
  created_at: string
}

export type OrgLevel = string
export type UnitType = 'division' | 'section' | null

export type OrgUnit = {
  id: number
  code: string | null
  name: string
  level: string
  parent_id: number | null
  sort_order: number
  default_expanded: boolean
  unit_type: UnitType
  created_at: string
}

export type OrgUnitMember = {
  id: number
  org_unit_id: number
  display_name: string
  user_id: number | null
  role_type_id: number | null
  sort_order: number
  created_at: string
}

export type RoleType = {
  id: number
  name: string
  level: string | null
  sort_order: number
  created_at: string
}

export type OrgUnitRole = {
  id: number
  org_unit_id: number
  role_type_id: number
  display_name: string | null
  sort_order: number
  created_at: string
}

export type OrgUnitRoleWithName = {
  id: number
  org_unit_id: number
  display_name: string | null
  sort_order: number
  role_types: { name: string }
}

export type StepDecision = 'approved' | 'rejected' | null

export type DropdownField = 'institution' | 'payment_account'

export type DropdownOption = {
  id: number
  field: DropdownField
  label: string
  sort_order: number
  created_at: string
}

export type Block =
  | { id: string; type: 'text'; content: string }
  | { id: string; type: 'image'; url: string }

export type IssueType = 'improvement' | 'feature' | 'bug' | 'performance'
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical'
export type IssueStatus = 'pending' | 'in_progress' | 'completed' | 'rejected' | 'on_hold'

export type DevTracker = {
  id: number
  type: IssueType
  title: string
  description: string | null
  priority: IssuePriority
  status: IssueStatus
  module: string | null
  workaround: string | null
  created_by: number | null
  assigned_to: number | null
  estimated_at: string | null
  completed_at: string | null
  before_description: string | null
  before_images: string[]
  after_description: string | null
  after_images: string[]
  before_blocks: Block[] | null
  after_blocks: Block[] | null
  created_at: string
  updated_at: string
}

export type SystemRole = {
  id: number
  name: string
  is_admin: boolean
  allowed_item_ids: string[]
  sort_order: number
  created_at: string
}

export type FundsAllocationTemplate = {
  id: number
  name: string
  is_shared: boolean
  created_by: number | null
  field_values: Record<string, string>
  // 共用範本的適用組織節點（org_units.id）；勾選節點本身或其子孫的成員才可見。空陣列＝未設定範圍，僅管理頁可見
  org_unit_ids: number[] | null
  created_at: string
  updated_at: string | null
}

export type FormFieldType = 'text' | 'date' | 'select' | 'number' | 'textarea' | 'readonly' | 'radio' | 'attachment'

export type TaxFormulaStep = {
  op: '+' | '-' | '*' | '/'
  value: number
}

export type TaxRateOption = {
  id: number
  label: string
  formula_steps: TaxFormulaStep[]
  sort_order: number
  created_at: string
}

export type FundAttachment = {
  id: number
  funds_allocation_id: number | null
  funds_payment_id: number | null
  slot_label: string
  file_name: string
  storage_path: string
  file_type: string
  uploaded_by: string | null
  created_at: string
  url?: string
}
export type FormColCount = 1 | 2 | 3
export type FormType = 'funds_allocation' | 'payment_voucher' | 'temp_voucher'
export type FormDataSourceDef = {
  id: number
  label: string
  source_key: string
  applicable_types: string[]
  is_static_options: boolean
  sort_order: number
}

export type FormSlot = {
  fieldId: string
  label: string
  required: boolean
  type: FormFieldType
  dataSource: string
  staticOptions?: string[]
  showWhen?: { fieldId: string; values: string[] }
  taxConfig?: { baseFieldId: string; totalFieldId: string; taxAmountFieldId?: string }
} | null

export type FormSchemaRow = {
  id: string
  cols: FormColCount
  slots: FormSlot[]
  repeatable?: boolean
  rowGroupStart?: boolean  // 從這列開始（含）以下整組可重複新增
}

export type FormBlock = {
  id: string
  title: string | null
  rows: FormSchemaRow[]
  showWhen?: { fieldId: string; value: string }
}


export type FundsAllocation = {
  id: number
  name: string
  amount: number
  date: string
  category: string | null
  note: string | null
  institution: string | null
  payment_account: string | null
  expense_item: string | null
  status: FundsStatus
  flow_template_id: number | null
  current_step: number | null
  created_by: string
  created_at: string
  updated_at: string
  applicant: string | null
  apply_division: string | null
  apply_section: string | null
  apply_division_id: number | null
  apply_section_id: number | null
  apply_role: string | null
  serial_number: string | null
  extra_data: Record<string, string> | null
  approved_amount: number | null
  // 舊欄位保留中（過渡期備份，確認無誤後可刪除）
  step1_decision: StepDecision
  step1_comment: string | null
  step1_reviewer: string | null
  step1_at: string | null
  step2_decision: StepDecision
  step2_comment: string | null
  step2_reviewer: string | null
  step2_at: string | null
  step3_decision: StepDecision
  step3_comment: string | null
  step3_reviewer: string | null
  step3_at: string | null
  step4_decision: StepDecision
  step4_comment: string | null
  step4_reviewer: string | null
  step4_at: string | null
  step5_decision: StepDecision
  step5_comment: string | null
  step5_reviewer: string | null
  step5_at: string | null
}

export type ReviewerType = 'org_role' | 'system_role' | 'approval_group'

export type ApprovalGroup = {
  id: number
  name: string
  sort_order: number
  created_at: string
}

export type ApprovalGroupMember = {
  id: number
  group_id: number
  user_id: number
  created_at: string
}

export type ApprovalFlowTemplate = {
  id: number
  name: string
  form_type: FormType
  is_active: boolean
  created_at: string
}

export type ApprovalFlowStep = {
  id: number
  template_id: number
  step_number: number
  step_name: string
  reviewer_type: ReviewerType
  role_type_id: number | null
  system_role_id: number | null
  approval_group_id: number | null
  created_at: string
}

export type ApprovalFlowStepWithRole = {
  id: number
  template_id: number
  step_number: number
  step_name: string
  reviewer_type: ReviewerType
  role_type_id: number | null
  org_unit_type: 'division' | 'section' | null
  system_role_id: number | null
  approval_group_id: number | null
  role_type_name: string | null
  system_role_name: string | null
  approval_group_name: string | null
}

export type ApprovalRecord = {
  id: number
  funds_allocation_id: number | null
  funds_payment_id: number | null
  temp_voucher_id: number | null
  step_number: number
  step_name: string
  decision: StepDecision
  comment: string | null
  approved_amount: number | null
  reviewer_id: string | null
  reviewed_at: string | null
  created_at: string
}

export type PayeeFieldType = 'text' | 'number' | 'dropdown' | 'date'

export type PayeeCategory = {
  id: number
  name: string
  sort_order: number
  created_at: string
}

export type PayeeCategoryField = {
  id: number
  category_id: number
  label: string
  field_type: PayeeFieldType
  options: string[] | null
  sort_order: number
  created_at: string
}

export type PayeeRecord = {
  id: number
  category_id: number
  field_values: Record<string, string>
  sort_order: number
  created_at: string
}

export type FeeCategory = {
  id: number
  name: string
  sort_order: number
  created_at: string
}

export type FeeSubcategory = {
  id: number
  category_id: number
  name: string
  sort_order: number
  created_at: string
}

export type FeeCategoryField = {
  id: number
  category_id: number
  label: string
  field_type: PayeeFieldType
  options: string[] | null
  sort_order: number
  created_at: string
}

export type FeeRecord = {
  id: number
  category_id: number
  subcategory_id: number | null
  field_values: Record<string, string>
  sort_order: number
  created_at: string
}
