export type SidebarItem = {
  kind: 'item'
  id: string
  label: string
  href: string
  navHidden?: boolean
  permissionParent?: string
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
      { kind: 'item', id: 'my-funds',            label: '我的申請紀錄', href: '/funds-allocation/my-funds' },
      { kind: 'item', id: 'fa-review',           label: '審核管理',     href: '/funds-allocation/review' },
      { kind: 'item', id: 'fa-review-div',       label: '課、處長審核', href: '', navHidden: true, permissionParent: 'fa-review' },
      { kind: 'item', id: 'fa-review-advisory',  label: '諮詢議會',     href: '', navHidden: true, permissionParent: 'fa-review' },
      { kind: 'item', id: 'fa-review-executive', label: '主管議會',     href: '', navHidden: true, permissionParent: 'fa-review' },
      { kind: 'item', id: 'fa-review-cfo',       label: '財務長',       href: '', navHidden: true, permissionParent: 'fa-review' },
      { kind: 'item', id: 'fa-all',              label: '全部申請紀錄', href: '/funds-allocation/all' },
      { kind: 'item', id: 'fa-all-export',       label: '匯出 CSV',     href: '', navHidden: true },
    ],
  },
  {
    id: 'funds-payment',
    label: '付款憑單',
    entries: [
      { kind: 'item', id: 'my-payment',      label: '我的付款憑單', href: '/funds-payment/my-payment' },
      { kind: 'item', id: 'fp-review',       label: '審核管理',     href: '/funds-payment/review' },
      { kind: 'item', id: 'fp-review-div',   label: '課、處長審核', href: '', navHidden: true, permissionParent: 'fp-review' },
      { kind: 'item', id: 'fp-review-group', label: '議會/群組審核', href: '', navHidden: true, permissionParent: 'fp-review' },
      { kind: 'item', id: 'fp-all',          label: '全部付款紀錄', href: '/funds-payment/all' },
    ],
  },
  {
    id: 'funds-voucher',
    label: '暫付款沖銷憑單',
    entries: [
      { kind: 'item', id: 'fv-my-voucher', label: '我的暫付款沖銷憑單', href: '/funds-voucher/my-voucher' },
      { kind: 'item', id: 'fv-review',     label: '審核管理',           href: '/funds-voucher/review' },
      { kind: 'item', id: 'fv-all',        label: '全部暫付款沖銷憑單', href: '/funds-voucher/all' },
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
          { kind: 'item', id: 'org-structure', label: '組織架構與審核管理', href: '/system-settings/org-structure' },
        ],
      },
      {
        kind: 'group',
        id: 'finance-settings',
        label: '財務自定義設定',
        items: [
          { kind: 'item', id: 'form-settings',   label: '表單設定',     href: '/system-settings/form-settings' },
          { kind: 'item', id: 'status-labels',   label: '狀態標籤設定', href: '/system-settings/status-labels' },
          { kind: 'item', id: 'expense-fields',  label: '支出欄位設定', href: '/system-settings/expense-fields' },
          { kind: 'item', id: 'payee-settings',  label: '付款對象設定', href: '/system-settings/payee-settings' },
          { kind: 'item', id: 'fee-settings',    label: '費用類型設定', href: '/settings/fee' },
        ],
      },
      { kind: 'item', id: 'sidebar-customization', label: '側邊欄自定義設定', href: '/system-settings/sidebar-customization' },
    ],
  },
  {
    id: 'report-issue',
    label: '回報問題',
    entries: [
      { kind: 'item', id: 'report-issue', label: '提交問題回報', href: '/report-issue' },
      { kind: 'item', id: 'issue-module-settings', label: '影響模組自定義', href: '/report-issue/module-settings' },
    ],
  },
]

export const SIDEBAR_STORAGE_KEY = 'bci_sidebar_config'
