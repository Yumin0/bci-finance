# 欄位對照表：中文標籤 ↔ 資料庫欄位

> 整理目的：確認每個模組在頁面上顯示的中文標籤，對應到 Supabase 中實際儲存的欄位名稱。
> 最後更新：2026-05-24

---

## 一、資金分配申請（資料表：`funds_allocation`）

**標籤來源說明**
- 新增表單（`/funds-allocation/my-funds/add`）：動態 schema，標籤來自 Supabase `form_slots`，可在「表單設定」頁修改
- 詳細頁（`/funds-allocation/my-funds/[id]`、審核頁）：硬編碼於 `FundsAllocationDetail.tsx`，標籤改動需修改程式碼

| 新增表單中文標籤 | 詳細頁中文標籤 | 資料庫欄位 | 類型 | 備註 |
|--------------|------------|-----------|------|------|
| 資金分配申請單號 | （不顯示）| `serial_number` | text | 送出後自動產生（格式：YYYYMMDDXXX）|
| 申請日期 | 日期 | `date` | text（YYYY-MM-DD）| 必填 |
| 申請處別 | 申請處別 | `apply_division` | text | 選組織單位（處）|
| 申請課別 | 申請課別 | `apply_section` | text | 依處別連動 |
| 申請人 | 申請人 | `applicant` | text | 自動帶入登入者姓名（唯讀）|
| 職稱 | 職稱 | `apply_role` | text | 依課別連動顯示可選職位 |
| 類型 | 類別 | `category` | text | 新增表單顯示為 radio（一般 / 預支）|
| 機構 | 機構 | `institution` | text | 下拉選單，選項來自 `dropdown_options`（見下方 ①）|
| 出款帳戶 | 出款帳戶 | `payment_account` | text | 下拉選單，選項來自 `dropdown_options`（見下方 ①），選取後自動帶入對應審核流程 |
| 費用項目 | 費用項目 | `expense_item` | text | 下拉選單，選項來自 `expense_items`（見下方 ①）|
| 項目 | 項目 | `name` | text | 必填，申請事由 / 項目名稱 |
| 金額 | 金額 | `amount` | number | 必填 |
| 摘要／用途說明 | 備註 | `note` | text | textarea，可空白 |
| `custom_` 前綴的欄位 | （不顯示）| `extra_data` | jsonb | 動態自訂欄位，key 為欄位的 label 文字 |

> ⚠ **「是否為國外費用？」等非標準欄位**：若 form_slots 中的 fieldId 以 `custom_` 開頭，值會存入 `extra_data` jsonb，而非固定欄位。若 fieldId 不以 `custom_` 開頭也不對應上表任何欄位，資料會被忽略（不寫入 DB）。

**系統欄位（不顯示在表單）**

| 資料庫欄位 | 說明 |
|-----------|------|
| `id` | 主鍵（自動遞增）|
| `status` | `draft` / `pending` / `approved` / `rejected` |
| `flow_template_id` | 套用的審核流程範本 ID（對應 `approval_flow_templates`）|
| `current_step` | 當前待審步驟號（draft 時為 null）|
| `created_by` | 建立者（UUID）|
| `created_at` | 建立時間（timestamptz）|
| `updated_at` | 最後更新時間（timestamptz）|

---

## 二、付款憑單（資料表：`funds_payment`）

**標籤來源說明**
- 新增與詳細頁均使用動態 schema，標籤來自 Supabase `form_slots`（form_type = `payment_voucher`）
- ⚠ 下表中文標籤為推測值，實際以 Supabase 表單設定為準

| 推測中文標籤 | 資料庫欄位 | 來源 | 備註 |
|------------|-----------|------|------|
| 採購單號 | `purchase_order_number` | 建立時自動填入：分配申請 `serial_number + "001"` | |
| 申請日期 | `date` | 從資金分配申請複製 | |
| 申請處別 | `apply_division` | 從資金分配申請複製 | |
| 申請課別 | `apply_section` | 從資金分配申請複製 | |
| 申請人 | `applicant` | 從資金分配申請複製 | |
| 職稱 | `apply_role` | 從資金分配申請複製 | |
| 機構 | `institution` | 從資金分配申請複製 | |
| 出款帳戶 | `payment_account` | 從資金分配申請複製 | |
| 費用項目 | `expense_item` | 從資金分配申請複製 | |
| 項目 | `name` | 從資金分配申請複製 | |
| 金額 | `amount` | 從資金分配申請複製 | |
| 類別 | `category` | 從資金分配申請複製 | |
| 備註 | `note` | 從資金分配申請複製 | |
| 付款方式 | `payment_method` | 建立時由使用者填寫 | 固定選項：匯款 / 支票 / 現金 / 其他 |

**系統欄位（不顯示在表單）**

| 資料庫欄位 | 說明 |
|-----------|------|
| `id` | 主鍵（自動遞增）|
| `funds_allocation_id` | 關聯的資金分配申請 ID |
| `status` | `draft` / `pending` / `approved` / `rejected` / `paid` |
| `flow_template_id` | 套用的審核流程範本 ID |
| `current_step` | 當前待審步驟號（draft 時為 null）|
| `created_by` | 建立者（userId）|
| `created_at` | 建立時間（timestamptz）|
| `updated_at` | 最後更新時間（timestamptz）|

---

## 三、暫付款沖銷憑單（資料表：`temp_vouchers`）

**標籤來源說明**
- 新增與詳細頁均使用動態 schema，標籤來自 Supabase `form_slots`（form_type = `temp_voucher`）
- ⚠ 下表中文標籤為推測值，實際以 Supabase 表單設定為準

| 推測中文標籤 | 資料庫欄位 | 來源 | 備註 |
|------------|-----------|------|------|
| 日期 | `date` | 建立時由使用者填寫 | |
| 申請處別 | `apply_division` | 從付款憑單帶入，唯讀 | |
| 申請課別 | `apply_section` | 從付款憑單帶入，唯讀 | |
| 申請人 | `applicant` | 從付款憑單帶入，唯讀 | |
| 職稱 | `apply_role` | 從付款憑單帶入，唯讀 | |
| 金額 | `amount` | 從付款憑單帶入，可修改 | |
| 備註 | `note` | 建立時由使用者填寫 | |

**系統欄位（不顯示在表單）**

| 資料庫欄位 | 說明 |
|-----------|------|
| `id` | 主鍵（自動遞增）|
| `funds_payment_id` | 關聯的付款憑單 ID |
| `status` | `draft` / `pending` / `approved` / `rejected` |
| `flow_template_id` | 套用的審核流程範本（自動抓唯一啟用中的 temp_voucher 範本）|
| `current_step` | 當前待審步驟號（draft 時為 null）|
| `created_by` | 建立者（bigint，對應 `app_users.id`）|
| `created_at` | 建立時間（timestamptz）|
| `updated_at` | 最後更新時間（timestamptz）|

---

## 四、設定頁與主模組的關聯

### ① `/system-settings/expense-fields`（支出欄位設定）

管理資金分配申請單與付款憑單中三個下拉欄位的選項內容。

| 頁面區塊 | 資料表 | 提供給哪個欄位 |
|---------|-------|-------------|
| 機構 選項管理 | `dropdown_options`（`field = 'institution'`）| `funds_allocation.institution`、`funds_payment.institution` |
| 出款帳戶 選項管理 | `dropdown_options`（`field = 'payment_account'`）| `funds_allocation.payment_account`、`funds_payment.payment_account`；同時透過 `template_payment_accounts` 對應審核流程 |
| 費用項目 管理 | `expense_items` | `funds_allocation.expense_item`、`funds_payment.expense_item` |

---

### ② `/system-settings/form-settings`（表單設定）

管理三個模組新增/詳細頁的**欄位佈局與標籤文字**。
這裡的設定決定了頁面上顯示哪些欄位、中文標籤叫什麼、排列幾欄。

| 設定內容 | 資料表 | 說明 |
|---------|-------|------|
| 表單區塊（Block）| `form_schema_rows` | 每個卡片區塊，包含欄數與排列 |
| 欄位定義（Slot）| `form_slots` | 每個欄位：`fieldId`（對應 DB 欄位）、`label`（中文標籤）、類型、資料來源 |

`form_type` 對應關係：
- `funds_allocation` → 資金分配申請
- `payment_voucher` → 付款憑單
- `temp_voucher` → 暫付款沖銷憑單

**fieldId 與 DB 欄位的對應規則：**
- fieldId 與上方各表欄位名稱相同 → 直接寫入對應 DB 欄位
- fieldId 以 `custom_` 開頭 → 存入 `funds_allocation.extra_data`（jsonb），key 為該欄位的 label 文字

---

### ③ `/system-settings/payee-settings`（付款對象設定）

管理付款對象的資料庫，用於記錄各類付款對象（廠商、個人等）的基本資料。

| 資料表 | 說明 |
|-------|------|
| `payee_categories` | 付款對象類別（例如：廠商、個人）|
| `payee_category_fields` | 各類別的自訂欄位定義（欄位名稱、類型：文字/數字/下拉/日期）|
| `payee_records` | 實際付款對象資料（`field_values` jsonb 儲存各欄位值）|

> ⚠ **目前尚未與三個主模組直接串接**。`payee_records` 是獨立的付款對象資料庫，目前不直接影響 `funds_allocation`、`funds_payment`、`temp_vouchers` 的任何欄位。

---

### ④ `/settings/fee`（費用類型設定）

管理費用類別與費用項目資料庫，用於記錄各類費用的詳細資料。

| 資料表 | 說明 |
|-------|------|
| `fee_categories` | 費用類別（Tab 式切換）|
| `fee_subcategories` | 費用子類別 |
| `fee_category_fields` | 各類別的自訂欄位定義（欄位名稱、類型：文字/數字/下拉/日期）|
| `fee_records` | 實際費用項目資料（`field_values` jsonb 儲存各欄位值）|

> ⚠ **目前尚未與三個主模組直接串接**。`fee_records` 是獨立的費用資料庫，與 `funds_allocation.expense_item`（來自 `expense_items` 資料表）是兩個分開的系統。

---

## 備註

- **資金分配申請的詳細頁標籤是硬編碼**（`FundsAllocationDetail.tsx`），`serial_number` 在詳細頁中完全不顯示；付款憑單與暫付款沖銷憑單的詳細頁標籤則是動態的。
- `step1~5_*` 系列欄位仍存在於 TypeScript type 定義中，但已被 `approval_records` 資料表取代，目前不再寫入，屬於待清除的舊欄位。
