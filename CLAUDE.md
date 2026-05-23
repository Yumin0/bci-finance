@AGENTS.md

# 系統背景

## 技術棧
- **Next.js** (App Router) + **React 19** + **TypeScript**（strict mode）
- **Tailwind CSS 4.x** 樣式
- **shadcn/ui**（組件產生器）+ **Base UI**（`@base-ui/react`，headless primitive）+ **class-variance-authority**（cva，樣式變體）
- **Supabase**（PostgreSQL 資料庫 + Storage 圖片儲存）
- **JWT Session**（HTTP-only Secure Cookie，7 天有效期，jose 套件）
- **路由保護**：`src/proxy.ts` 攔截未登入請求，重導向 `/login`
- **Server Actions**：所有資料庫操作在 Server Actions 執行，不直接暴露 API

## 已完成功能模組

| 模組 | 路徑 | 說明 |
|------|------|------|
| 資金分配申請 | `/funds-allocation` | 申請、編輯、動態審核流程（範本驅動）、審核管理頁、全部申請紀錄 |
| 付款憑單 | `/funds-payment` | 新增、動態審核流程（共用同一套範本架構）、審核管理頁、全部付款紀錄 |
| 暫付款沖銷憑單 | `/funds-voucher` | 從付款憑單（已付款+預支）建立、我的列表、詳細頁（送出審核）、審核管理頁、全部紀錄 |
| 財務管理 | `/finance` | 資金管理與付款憑單總覽 |
| 系統設定 | `/system-settings` | 帳號管理、組織架構、支出欄位、側邊欄自定義、角色權限、表單設定、狀態標籤設定 |
| 問題回報 | `/report-issue` | Rich Text + 圖片上傳、狀態追蹤、影響模組標籤 |
| 登入 | `/login` | Email + Password |
| 首頁 | `/` | 顯示我的申請紀錄與付款憑單 |

## 主要資料模型（Supabase 資料表）

- `funds_allocation`：資金分配申請，含 `flow_template_id`、`current_step`、`status`（draft/pending/approved/rejected）；舊 `step1~5_*` 欄位保留備份
- `funds_payment`：付款憑單，關聯 `funds_allocation_id`，套用同一套彈性審核架構；`status`（draft/pending/approved/rejected/paid）
- `temp_vouchers`：暫付款沖銷憑單，關聯 `funds_payment_id`（限已付款+預支），`status`（draft/pending/approved/rejected）；`created_by bigint` 關聯 `app_users(id)`
- `status_label_config`：狀態標籤自訂設定（單列 JSON，含各模組 status 的標籤名稱、顏色 hex、是否顯示步驟名）
- `approval_flow_templates`：審核流程範本（`form_type`: funds_allocation | payment_voucher | temp_voucher）
- `approval_flow_steps`：步驟定義（`reviewer_type`: org_role | system_role）
- `approval_records`：每筆審核動作記錄（取代舊 step1~5_* 欄位）
- `template_payment_accounts`：範本與出款帳號的對應（多對多）
- `app_users`：系統使用者，含 `system_role_id`
- `user_positions`：使用者職位，關聯 `org_unit_role_id`，`is_primary` 標記主職位
- `org_units`：組織單位，樹狀結構（部門/處/課/科），含 `parent_id`
- `role_types`：職位類型
- `org_unit_roles`：組織單位職位（`org_unit_id` + `role_type_id` 組合）
- `system_roles`：系統角色，`is_admin` 標記管理員，`allowed_item_ids` 功能菜單權限
- `dropdown_options`：下拉選項（institution / payment_account 欄位）
- `expense_items`：費用項目
- `dev_tracker`：問題回報（type: bug/feature/improvement/performance）
- `form_schema_rows` / `form_slots`：動態表單配置
- **Storage Bucket** `issue-images`：問題回報圖片（路徑：`{issueId}/{timestamp}.{ext}`）

## 目錄結構

```
src/
├── app/
│   ├── _components/       # 全局共享組件（SidebarLayout、ThemeProvider、HomeTabView、StatusBadge 等）
│   ├── actions/           # Server Actions（auth、payment、temp-voucher、account、sidebar-config、dev-tracker、form-schema、status-labels）
│   ├── api/               # API Routes（upload-image）
│   ├── funds-allocation/
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
│   └── dateUtils.ts            # 日期格式化（Asia/Taipei）
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
