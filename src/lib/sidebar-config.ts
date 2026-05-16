export type SidebarItem = {
  kind: 'item'
  id: string
  label: string
  href: string
}

export type SidebarGroup = {
  kind: 'group'
  id: string
  label: string
  items: SidebarItem[]
}

export type SidebarEntry = SidebarItem | SidebarGroup

export type SidebarCategory = {
  id: string
  label: string
  entries: SidebarEntry[]
}

export const DEFAULT_SIDEBAR_CONFIG: SidebarCategory[] = [
  {
    id: 'funds-allocation',
    label: '資金分配申請',
    entries: [
      { kind: 'item', id: 'my-funds', label: '我的申請紀錄', href: '/funds-allocation/my-funds' },
      { kind: 'item', id: 'fa-step1', label: '課級單據管理', href: '/funds-allocation/step1' },
      { kind: 'item', id: 'fa-step2', label: '處級單據管理', href: '/funds-allocation/step2' },
      { kind: 'item', id: 'fa-step3', label: '諮詢議會', href: '/funds-allocation/step3' },
      { kind: 'item', id: 'fa-step4', label: '主管議會', href: '/funds-allocation/step4' },
      { kind: 'item', id: 'fa-step5', label: '財務長', href: '/funds-allocation/step5' },
    ],
  },
  {
    id: 'funds-payment',
    label: '付款憑單',
    entries: [
      { kind: 'item', id: 'my-payment', label: '我的付款憑單', href: '/funds-payment/my-payment' },
      { kind: 'item', id: 'fp-step1', label: '課級單據管理', href: '/funds-payment/step1' },
      { kind: 'item', id: 'fp-step2', label: '處級單據管理', href: '/funds-payment/step2' },
      { kind: 'item', id: 'fp-step3', label: '第三處支出課', href: '/funds-payment/step3' },
      { kind: 'item', id: 'fp-step4', label: '第三處 處長', href: '/funds-payment/step4' },
    ],
  },
  {
    id: 'finance',
    label: '財務管理',
    entries: [
      { kind: 'item', id: 'finance-funds', label: '資金管理', href: '/finance/funds' },
      { kind: 'item', id: 'finance-payment', label: '付款憑單管理', href: '/finance/payment' },
    ],
  },
  {
    id: 'system-settings',
    label: '系統設定',
    entries: [
      {
        kind: 'group',
        id: 'admin-permissions',
        label: '管理權限設定',
        items: [
          { kind: 'item', id: 'account-management', label: '帳號管理', href: '/system-settings/account-management' },
          { kind: 'item', id: 'org-structure', label: '組織架構與職位設定', href: '/system-settings/org-structure' },
        ],
      },
      { kind: 'item', id: 'expense-fields', label: '支出欄位設定', href: '/system-settings/expense-fields' },
      { kind: 'item', id: 'sidebar-customization', label: '側邊欄自定義設定', href: '/system-settings/sidebar-customization' },
      { kind: 'item', id: 'role-permissions', label: '角色功能權限設定', href: '/system-settings/role-permissions' },
    ],
  },
  {
    id: 'report-issue',
    label: '回報問題',
    entries: [
      { kind: 'item', id: 'report-issue', label: '提交問題回報', href: '/report-issue' },
    ],
  },
]

export const SIDEBAR_STORAGE_KEY = 'bci_sidebar_config'
