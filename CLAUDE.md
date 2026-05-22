@AGENTS.md

# 系統背景

## 技術棧
- **Next.js** (App Router) + **React 19** + **TypeScript**（strict mode）
- **Tailwind CSS 4.x** 樣式
- **Supabase**（PostgreSQL 資料庫 + Storage 圖片儲存）
- **JWT Session**（HTTP-only Secure Cookie，7 天有效期，jose 套件）
- **路由保護**：`src/proxy.ts` 攔截未登入請求，重導向 `/login`
- **Server Actions**：所有資料庫操作在 Server Actions 執行，不直接暴露 API

## 已完成功能模組

| 模組 | 路徑 | 說明 |
|------|------|------|
| 資金分配申請 | `/funds-allocation` | 申請、編輯、5 級審核工作流（課→處→諮詢議會→主管議會→財務長） |
| 付款憑單 | `/funds-payment` | 新增、4 級審核工作流（課→處→支出課→處長） |
| 財務管理 | `/finance` | 資金管理與付款憑單總覽 |
| 系統設定 | `/system-settings` | 帳號管理、組織架構、支出欄位、側邊欄自定義、角色權限、表單設定 |
| 問題回報 | `/report-issue` | Rich Text + 圖片上傳、狀態追蹤、影響模組標籤 |
| 登入 | `/login` | Email + Password |
| 首頁 | `/` | 顯示我的申請紀錄與付款憑單 |

## 主要資料模型（Supabase 資料表）

- `funds_allocation`：資金分配申請，含 `step1~5_decision/comment/reviewer/at`
- `funds_payment`：付款憑單，關聯 `funds_allocation_id`，含 `step1~4_*`
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
│   ├── _components/       # 全局共享組件（SidebarLayout、ThemeProvider、HomeTabView 等）
│   ├── actions/           # Server Actions（auth、payment、account、sidebar-config、dev-tracker、form-schema）
│   ├── api/               # API Routes（upload-image）
│   ├── funds-allocation/  # 資金分配申請模組
│   ├── funds-payment/     # 付款憑單模組
│   ├── finance/           # 財務管理
│   ├── system-settings/   # 系統設定
│   ├── report-issue/      # 問題回報
│   └── login/
├── lib/
│   ├── types.ts           # 所有 TypeScript 型別定義
│   ├── constants.ts       # 狀態常數
│   ├── supabase.ts        # Supabase 客戶端
│   ├── session.ts         # JWT Session 管理
│   ├── sidebar-config.ts  # 側邊欄預設配置
│   └── dateUtils.ts       # 日期格式化（Asia/Taipei）
└── proxy.ts               # 路由保護中間件
```

## 架構注意事項

- **權限三層**：SystemRole（功能菜單）→ UserPosition（組織職位）→ SidebarConfig（動態側邊欄）
- **動態表單**：FormSchemaRow + FormSlot，支援 12+ 種資料來源，可在 Supabase 管理不需部署
- **主題**：CSS Variables 定義顏色，偏好存 localStorage（`bci-theme`），有防 hydration 閃爍 script
- **MOCK_USER_ID**：`'00000000-0000-0000-0000-000000000001'`，待整合真正 Supabase Auth 後替換

---

# 協作工作流程規則

每次對話開始時，主動確認以下事項：

1. **詢問使用者是否已拉取最新版本**：如果使用者一開始就描述需求（跳過準備步驟），先暫停並提醒：
   「開始之前，請問你有沒有先拉取最新版本？如果還沒，我可以幫你執行。」
   確認後再繼續。

2. **詢問是否需要建立新分支**：如果是兩人協作期間，提醒使用者是否要建立功能分支，還是確認目前只有自己在改動（可直接在 main 上進行）。

完成程式碼改動並確認 localhost:3000 測試沒問題後：

3. **主動提示上傳**：改動完成後，根據本次對話的需求內容自己擬好 commit 說明，主動告知使用者接下來要做什麼，請使用者確認後直接執行。例如：
   「改動完成了。我會幫你 commit 並 push 到 GitHub，說明寫『新增報表功能』，確認後我就執行。」
   使用者回覆確認（如「好」、「ok」）即直接執行，不需要使用者再補充任何資訊。

4. **文件改動也要推 GitHub**：如果本次對話中有修改任何文件檔（包含 CLAUDE.md、AGENTS.md、協作 SOP 文件），完成後也要主動提示 commit 並 push，說明：「文件有更新，協作者需要拉取才看得到，我幫你一起推上去。」這類改動不需要通過 localhost:3000 測試，確認即可直接執行。

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
