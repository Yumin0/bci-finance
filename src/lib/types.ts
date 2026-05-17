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
  created_by: string
  created_at: string
  status: PaymentStatus
  updated_at: string | null
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

export type OrgLevel = '部門' | '處' | '課' | '科'
export type RoleLevel = '處' | '課' | '科'

export type OrgUnit = {
  id: number
  code: string | null
  name: string
  level: OrgLevel
  parent_id: number | null
  sort_order: number
  created_at: string
}

export type RoleType = {
  id: number
  name: string
  level: RoleLevel
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

export type FormFieldType = 'text' | 'date' | 'select' | 'number' | 'textarea' | 'readonly' | 'radio'
export type FormColCount = 1 | 2 | 3
export type FormType = 'funds_allocation' | 'payment_voucher'
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
} | null

export type FormSchemaRow = {
  id: string
  cols: FormColCount
  slots: FormSlot[]
}

export type ExpenseItem = {
  id: number
  label: string
  sort_order: number
  created_at: string
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
  created_by: string
  created_at: string
  updated_at: string
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
  applicant: string | null
  apply_division: string | null
  apply_section: string | null
  apply_role: string | null
}
