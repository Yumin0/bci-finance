@AGENTS.md

# 系統背景

## 技術棧
- **Next.js** (App Router) + **React 19** + **TypeScript**（strict mode）
- **Tailwind CSS 4.x** 樣式
- **shadcn/ui**（組件產生器，`style: base-nova`）+ **Base UI**（`@base-ui/react`，headless primitive）+ **class-variance-authority**（cva，樣式變體）；已安裝組件：button、input、select、tabs、textarea、badge、card、table、searchable-select
- **Supabase**（PostgreSQL 資料庫 + Storage 圖片儲存）
- **JWT Session**（HTTP-only Secure Cookie，7 天有效期，jose 套件）
- **路由保護**：`src/proxy.ts` 攔截未登入請求，重導向 `/login`
- **Server Actions**：所有資料庫操作在 Server Actions 執行，不直接暴露 API
- **exceljs**：解析上傳的 Excel (.xlsx) 檔案（組織架構匯入，server-side）

## 已完成功能模組

| 模組 | 路徑 | 說明 |
|------|------|------|
| 資金分配申請 | `/funds-allocation` | 申請、編輯、動態審核流程（範本驅動）、審核管理頁、全部申請紀錄；預選範本（共用範本 Admin 管理、個人範本另存）；附件上傳（PDF/JPG/PNG，表單設定驅動，支援 Modal 預覽） |
| 付款憑單 | `/funds-payment` | 新增、動態審核流程（共用同一套範本架構）、審核管理頁、全部付款紀錄；繼承申請單附件（唯讀）＋可補傳本憑單附件 |
| 暫付款沖銷憑單 | `/funds-voucher` | 從付款憑單（已付款+預支）建立、我的列表、詳細頁（送出審核）、審核管理頁、全部紀錄 |
| 財務管理 | `/finance` | 資金管理與付款憑單總覽 |
| 系統設定 | `/system-settings` | 帳號管理、組織架構、支出欄位、側邊欄自定義、角色權限、表單設定、狀態標籤設定、付款對象設定 |
| 費用類型設定 | `/settings/fee` | 自訂費用類別（Tab 式切換）、各類別自訂欄位（文字/數字/下拉/日期）、費用項目資料管理 |
| 問題回報 | `/report-issue` | Rich Text + 圖片上傳、狀態追蹤、影響模組標籤 |
| 登入 | `/login` | Email + Password；Google OAuth（保留 Email 登入，同 email 自動合併帳號）|
| 首頁 | `/` | 顯示我的申請紀錄與付款憑單 |

## 主要資料模型（Supabase 資料表）

- `funds_allocation`：資金分配申請，含 `flow_template_id`、`current_step`、`status`（draft/pending/approved/rejected）；`apply_division_id` / `apply_section_id` 關聯 `org_units(id)`，驅動審核人判斷（依對應節點的 `org_unit_members` 找負責人）；舊 `step1~5_*` 欄位保留備份
- `funds_payment`：付款憑單，關聯 `funds_allocation_id`，套用同一套彈性審核架構；`status`（draft/pending/approved/rejected/paid）；`extra_data jsonb` 儲存動態表單自訂欄位值（key 為 slot.label）
- `temp_vouchers`：暫付款沖銷憑單，關聯 `funds_payment_id`（限已付款+預支），`status`（draft/pending/approved/rejected）；`created_by bigint` 關聯 `app_users(id)`
- `status_label_config`：狀態標籤自訂設定（單列 JSON，含各模組 status 的標籤名稱、顏色 hex、是否顯示步驟名）
- `approval_flow_templates`：審核流程範本（`form_type`: funds_allocation | payment_voucher | temp_voucher）
- `approval_flow_steps`：步驟定義（`reviewer_type`: org_role | system_role | approval_group，`approval_group_id` 關聯 `approval_groups`）；`org_unit_type`（'division' | 'section' | null）當 `reviewer_type = org_role` 時指定層級，搭配申請單的 `apply_division_id`/`apply_section_id` 動態解析審核人
- `approval_groups`：審核群組（名稱、sort_order）；讓審核步驟可以指定「需要哪個群組的人來審」，例如諮詢議會、主管議會
- `approval_group_members`：審核群組成員（`group_id` 關聯 `approval_groups`、`user_id` 關聯 `app_users`）；一人可屬於多個群組
- `approval_records`：每筆審核動作記錄（取代舊 step1~5_* 欄位）
- `template_payment_accounts`：範本與出款帳號的對應（多對多）
- `app_users`：系統使用者，含 `system_role_id`、`google_id TEXT`（Google OAuth sub，nullable）；`password_hash` nullable（Google 用戶無密碼）；`sort_order INTEGER` nullable，帳號管理頁「編號」依此排序顯示（空值排最後），可先建立尚未登入帳號（僅 name + email），待使用者首次 Google 登入時依 email 自動比對補上 `google_id`
- `user_positions`：使用者職位，關聯 `org_unit_role_id`，`is_primary` 標記主職位
- `org_units`：組織單位，樹狀結構（單一樹根，深度不限，由 `parent_id` 決定階層），`level` 為自由文字標籤（純顯示用，例如「L2 主幹」「處」「課」）；`unit_type`（'division' | 'section' | null）標記該節點是否為「處別」/「課別」，由組織架構頁手動標記，驅動資金分配申請「申請處別/課別」推算（見 `lib/orgPositions.ts`）；支援拖曳調整同層順序與跨層級重新掛載；`default_expanded boolean`（預設 true）控制主畫面初始展開/收合狀態，可在「排列組織架構」Modal 中調整並按「儲存收合設定」批次套用
- `org_unit_members`：組織單位成員（負責人），`org_unit_id` 關聯 `org_units`、`display_name` 姓名（依使用者 email 自動產生英文名，或 Excel 匯入的暫定人員）、`user_id` 可選關聯 `app_users(id)`；組織架構頁「+新增負責人」改為搜尋系統使用者直接綁定，既有未綁定的文字標籤可透過「重新比對帳號」依 email 英文名批次回填 `user_id`
- `role_types`：職位類型
- `org_unit_roles`：組織單位職位（`org_unit_id` + `role_type_id` 組合）
- `system_roles`：系統角色，`is_admin` 標記管理員，`allowed_item_ids` 功能菜單權限
- `dropdown_options`：下拉選項（institution / payment_account 欄位）
- `expense_items`：費用項目
- `dev_tracker`：問題回報（type: bug/feature/improvement/performance）
- `fund_attachments`：資金申請/付款憑單附件（`funds_allocation_id`、`funds_payment_id`、`slot_label`、`storage_path`、`file_type`）；對應 Storage Bucket `fund-attachments`
- `form_schema_rows` / `form_slots`：動態表單配置
- `payee_categories`：付款對象類別（名稱、sort_order）
- `payee_category_fields`：各類別欄位定義（label、field_type: text|number|dropdown|date、options jsonb）
- `payee_records`：實際付款對象資料（field_values jsonb 動態存欄位值，key 為 field id）
- `fee_categories`：費用類別（名稱、sort_order）
- `fee_category_fields`：各費用類別欄位定義（label、field_type: text|number|dropdown|date、options jsonb）
- `fee_records`：實際費用項目資料（field_values jsonb 動態存欄位值，key 為 field id）
- `funds_allocation_templates`：資金分配申請預選範本；`is_shared` 區分共用/個人，`created_by bigint` 關聯 `app_users(id)` 儲存建立者（個人範本隔離），`field_values jsonb` 儲存欄位預設值（apply_division/apply_section 存 org_unit id 字串，其餘存 label 字串）
- `application_cycle_config`：申請週期設定（單列），`allowed_weekdays int[]`（0=日～6=六）、`weeks_ahead int`（預設 3）；空陣列代表不限制，僅套用於資金分配申請的申請日期欄位
- `tax_rate_options`：稅額選項設定，`label` 名稱、`formula_steps jsonb`（步驟陣列，每步含 `op: +/-/*/\/` 與 `value: number`）、`sort_order`；搭配表單欄位 `dataSource: 'tax_rates'` 使用，支援多步驟連乘除計算
- **Storage Bucket** `issue-images`：問題回報圖片（路徑：`{issueId}/{timestamp}.{ext}`）

## 目錄結構

```
src/
├── app/
│   ├── _components/       # 全局共享組件（SidebarLayout、ThemeProvider、HomeTabView、StatusBadge 等）
│   ├── actions/           # Server Actions（auth、payment、temp-voucher、account、sidebar-config、dev-tracker、form-schema、status-labels、payee、fee、fund-templates、application-cycle）
│   ├── api/               # API Routes（upload-image）
│   ├── funds-allocation/
│   │   ├── my-funds/      # 我的申請列表（含「選取範本」Modal、TemplateModal）
│   │   │   └── add/       # 新增申請（支援 ?templateId= 帶入預設值）
│   │   ├── review/        # 審核管理（待我審核 / 我的審核紀錄）
│   │   │   └── check/[id] # 動態審核頁
│   │   └── all/           # 全部申請紀錄（管理員/財務長）
│   ├── funds-payment/
│   │   ├── review/        # 審核管理
│   │   └── all/           # 全部付款紀錄
│   ├── funds-voucher/
│   │   ├── my-voucher/    # 我的暫付款沖銷憑單列表
│   │   │   ├── [id]/      # 詳細頁（含送出審核）
│   │   │   └── add/[id]/  # 建立頁（由付款憑單 id 帶入）
│   │   ├── review/        # 審核管理
│   │   │   └── check/[id] # 審核操作頁
│   │   └── all/           # 全部暫付款沖銷憑單紀錄
│   ├── finance/           # 財務管理
│   ├── system-settings/
│   │   ├── approval-flows/ # 審核流程範本管理
│   │   └── status-labels/  # 狀態標籤自訂設定
│   ├── settings/
│   │   └── fee/           # 費用類型設定
│   ├── report-issue/      # 問題回報
│   └── login/
├── components/
│   └── ui/                # shadcn/ui 組件（button、input、select、tabs、textarea、badge）
├── lib/
│   ├── types.ts                # 所有 TypeScript 型別定義
│   ├── constants.ts            # 狀態常數
│   ├── supabase.ts             # Supabase 客戶端
│   ├── session.ts              # JWT Session 管理
│   ├── sidebar-config.ts       # 側邊欄預設配置
│   ├── status-label-config.ts  # 狀態標籤預設設定與型別（含 hexToRgba）
│   ├── dateUtils.ts            # 日期格式化（Asia/Taipei）
│   ├── orgPositions.ts         # 依使用者指派節點推算（處別,課別）組合
│   └── userNames.ts            # email ↔ 英文名轉換、去姓氏/括號職稱清理
└── proxy.ts               # 路由保護中間件
```

## 架構注意事項

- **權限三層**：SystemRole（功能菜單）→ UserPosition（組織職位）→ SidebarConfig（動態側邊欄）
- **動態表單**：三層結構 FormBlock → FormSchemaRow → FormSlot，支援多區塊卡片排版；資料來源 12+ 種，可在 Supabase 管理不需部署
- **主題**：CSS Variables 定義顏色，偏好存 localStorage（`bci-theme`），有防 hydration 閃爍 script
- **MOCK_USER_ID**：`'00000000-0000-0000-0000-000000000001'`，待整合真正 Supabase Auth 後替換

---

# 協作工作流程規則

本專案由 **Yumin** 與 **Riku** 兩人共同開發，使用 GitHub 同步進度。

## 分支命名規範

- 格式：`feature/{負責人}-{功能簡稱}`，例如 `feature/yumin-csv-export`、`feature/riku-report`
- 兩人同時有開發任務時，**一律開分支**，不直接在 main 上改動
- 只有一人在改且另一人沒有進行中任務時，才可直接在 main 上進行

## 每次對話開始時，依序確認以下事項：

1. **確認說話者身份**：如果無法從上下文判斷是 Yumin 還是 Riku，先詢問：「請問你是 Yumin 還是 Riku？」後續的 BACKLOG 記錄與分支命名都需要這個資訊。

2. **詢問使用者是否已拉取最新版本**：如果使用者一開始就描述需求（跳過準備步驟），先暫停並提醒：
   「開始之前，請問你有沒有先拉取最新版本？如果還沒，我可以幫你執行。」
   確認後再繼續。

3. **開啟 BACKLOG.md 確認衝突並登記任務**：如果使用者提出新開發需求，必須先開啟 BACKLOG.md，檢查「進行中」區塊是否已有人在做同一件事。確認無衝突後，把此任務加入「進行中」，格式：

   ```
   **任務名稱**（負責人）
   分支：`feature/{負責人}-{功能簡稱}`
   開始：YYYY-MM-DD
   ```

   完成後才開始寫程式。

4. **詢問是否需要建立新分支**：依照分支命名規範，提醒使用者是否要開分支，或確認目前可直接在 main 上進行。

完成程式碼改動並確認 localhost:3000 測試沒問題後：

5. **commit 前：架構同步檢查**：每次 commit 前，先逐一確認以下四項，有異動就必須在同一個 commit 裡更新 CLAUDE.md 對應區段，不得分開：

   | 本次改動內容 | 需更新 CLAUDE.md 的哪個區段 |
   |---|---|
   | 新增或修改資料表 | 主要資料模型 |
   | 新增路由或頁面 | 已完成功能模組、目錄結構 |
   | 安裝新套件 | 技術棧 |
   | 完成 BACKLOG 功能 | 已完成功能模組（更新描述）|

6. **更新 BACKLOG.md 並一起 commit**：把對應任務從「進行中」移至「已完成」表格，與程式碼和 CLAUDE.md 放入同一個 commit，讓對方 pull 後立即看到最新狀態。

7. **主動提示上傳**：改動完成後，根據本次對話的需求內容自己擬好 commit 說明，主動告知使用者接下來要做什麼，請使用者確認後直接執行。例如：
   「改動完成了。我會幫你 commit 並 push 到 GitHub，說明寫『新增報表功能』，確認後我就執行。」
   使用者回覆確認（如「好」、「ok」）即直接執行，不需要使用者再補充任何資訊。

8. **文件改動也要推 GitHub**：如果本次對話中有修改任何文件檔（包含 CLAUDE.md、AGENTS.md、BACKLOG.md、協作 SOP 文件），完成後也要主動提示 commit 並 push，說明：「文件有更新，協作者需要拉取才看得到，我幫你一起推上去。」這類改動不需要通過 localhost:3000 測試，確認即可直接執行。

9. **merge 回 main**：push 到 feature 分支後，必須**主動**引導執行以下步驟，不等使用者自己發現：
   ```
   git checkout main && git pull && git merge feature/{分支名} && git push
   ```
   完成後告知：「已合併到 main，Riku 現在可以 git pull 拿到最新版。」
   **不得只推 feature 分支就結束**，協作者 pull 的是 main，feature 分支不 merge 對方看不到。

# 橫切關注點完成確認規則

當功能屬於「改變全站共用顯示方式或資料讀取方式」時（例如：新增共用元件、改狀態顯示邏輯、改查詢欄位），完成前必須執行以下流程，**不得只驗收功能本身**：

1. **grep 確認影響範圍**：在 commit 前用 grep 找出所有相關的使用點，逐一確認沒有遺漏。

   常用指令範例：
   ```bash
   # 找所有顯示 status 的地方（確認都有套用 StatusBadge）
   grep -rn "\.status" --include="*.tsx" src/app/

   # 找所有用 MOCK_USER_ID 的地方（確認查詢使用者一致）
   grep -rn "MOCK_USER_ID" --include="*.tsx" src/

   # 找所有直接讀取某欄位的地方
   grep -rn "r\.amount\|r\.name" --include="*.tsx" src/app/
   ```

2. **BACKLOG 任務加「影響範圍」欄位**：凡是橫切關注點類型的任務，登記時必須列出所有會受影響的頁面，完成時逐項打勾後才能移到已完成：

   ```
   **自定義狀態標籤名稱**（Yumin）
   分支：`feature/yumin-status-labels`
   開始：2026-05-XX
   影響範圍確認：
   - [x] /funds-allocation/my-funds
   - [x] /funds-allocation/all
   - [x] /funds-payment/my-payment
   - [x] /funds-payment/all
   - [x] /funds-voucher
   - [x] / (首頁)
   ```

3. **判斷是否為橫切關注點**：符合以下任一條件即屬此類，需執行上述流程：
   - 新增或修改「全站共用元件」（如 StatusBadge、DatePicker）
   - 修改「全站共用的查詢條件或欄位」（如 created_by、session 使用方式）
   - 新增「需要各頁面同步套用的顯示邏輯」（如步驟名稱、金額格式）

# 方案確認規則

遇到以下情況時，**先用 2–3 句話說明打算怎麼做，等使用者確認後才執行**：

- 需求描述有多種實作方式可選
- 涉及 UI/UX 互動設計（例如：加什麼控件、點擊行為、視覺呈現）
- 實作方式會影響使用者操作流程

確認格式範例：
> 「我打算在圖片點擊時出現浮動選單，提供小 / 中 / 大 / 全寬四個選項，點選後直接調整寬度。這樣可以嗎？」

使用者確認（如「好」、「對」）後才開始寫程式。
若使用者說「不對」或提出不同做法，先理解需求再重新確認一次，確認後才執行。

# 操作說明規則

當引導使用者執行任何非程式碼的手動操作步驟（例如：Supabase 設定、GitHub 設定、第三方服務配置等）時，**每個步驟都必須附上「為什麼」**，格式如下：

- 操作指示寫清楚（去哪裡、點什麼、填什麼）
- 緊接著用一句話說明這個步驟的用途或原因

例如：
> 3. 進入 bucket → Policies 分頁 → 點「New policy」→ 選「For full customization」
>    *為什麼：Supabase 預設會擋住所有外部上傳，Policy 是用來設定「誰可以對這個儲存空間做什麼操作」的規則。選 Full customization 是因為我們要自己指定條件，而不是用預設模板。*

目標是讓沒有工程背景的使用者在執行操作的同時，能理解背後的邏輯，而不只是照步驟點。

## SQL 說明規則

當請使用者在 Supabase SQL Editor（或其他地方）執行 SQL 指令時，**必須在 SQL 區塊之前先用一到兩句白話說明這段 SQL 的整體目的**（執行完會讓系統產生什麼變化）。不需要逐段拆解，使用者若有疑問會自行追問。

# UI 改動確認規則

改動任何 UI 元素（按鈕大小、下拉選單樣式、輸入框外觀、間距、顏色等）之前，**必須先執行以下流程，確認後才動程式碼**：

1. **找出所有使用相同組件的地方**（例如：全站哪些頁面用了相同的 `<Button>`、`<Input>`、`<Select>`）
2. **明確告知使用者影響範圍**（列出會受影響的頁面）
3. **詢問確認**：是要**全局修改**（改 `src/components/ui/` 裡的組件定義），還是**單獨修改**（只改某個頁面的那個元素）
4. **確認後才執行**

> 範例：「你想調整按鈕大小，這個 Button 組件目前用在 15 個頁面。請問你是要全部一起調整，還是只改這一頁的按鈕？」

**原因**：避免誤改導致非預期的全站樣式變動，讓協作者都清楚改動影響範圍。

# 時區規範

日期時間一律以 UTC 儲存，前端顯示統一轉換為 Asia/Taipei（GMT+8）。
格式化工具統一使用 `src/lib/dateUtils.ts` 的 `formatDate` / `formatDateTime`，禁止直接用 `.slice(0, 10)` 截字串。
