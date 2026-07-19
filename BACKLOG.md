# BCI Finance 功能待辦清單

每次開新對話前，從這裡挑選要做的功能告知 AI，不需要重新說明背景。
完成的功能請移到「已完成」區段並標注日期。

---

## 進行中

**沖銷審核付款分類預設「回存」＋審核群組「財務人員」改名「支出課」**（Yumin）
分支：`feature/yumin-voucher-category-default`
開始：2026-07-19
說明：① 暫付款沖銷審核頁（群組步驟）「付款分類」下拉預設選「回存」（先承接本單前面關卡選值、沒有才帶回存；不再承接母付款憑單的付款分類——母憑單分類描述預支出帳當下，與沖銷回存性質不同）；② 審核群組「財務人員」改名「支出課」（dev approval_groups id=4 已改，正式機 SQL 登記 prod-pending-sql；程式碼無寫死名稱、Tab 名稱隨群組名自動變）。皆 Yumin 2026-07-19 拍板。
- [x] /funds-voucher/review/check/[id]（付款分類預設）
- [x] dev 改名＋docs/prod-pending-sql.md 登記
- [x] npx tsc --noEmit 零錯誤

**暫付款沖銷：回存金額 + 母憑單對照卡片 + 總額預帶值修正**（Yumin）
分支：`feature/yumin-voucher-return-amount`
開始：2026-07-15
規格文件：[`docs/core-logic/暫付款沖銷與回存金額_待確認事項.md`](docs/core-logic/暫付款沖銷與回存金額_待確認事項.md)（第二節五項已拍板，其餘待財務確認）
說明：① 付款憑單建單頁「總額」預帶母單剩餘額度（多組只帶第一組）；② 沖銷建單頁「總額」預帶母憑單**實際撥款金額**（修 bug：原本帶母憑單原始填寫值，只要審核下修過就必定超額被擋）；③ 超額硬擋維持不變（財務確認：不可花超過，超過請另做資金分配申請）；④ 沖銷建單／詳細／審核三頁加「預支的付款憑單」對照卡片（原本完全沒有母憑單資訊，審核人看不到當初預支多少）；⑤ 顯示「回存金額」＝實際撥款 − 各組總額加總（即時算不落地）。**全部不動資料庫、無待執行 SQL。**
名稱約定：這個數字**一律叫「回存金額」**，不可叫「剩餘金額」（後者在全站已是「資金分配核准金額 − 憑單佔用額度」，意思完全不同，撞名會全站混淆）。
影響範圍確認（回存金額顯示為橫切關注點）：
- [x] /funds-voucher/my-voucher/add/[id]（建單頁：對照卡片＋回存金額＋總額預帶值）
- [x] /funds-voucher/my-voucher/[id]（詳細頁：對照卡片＋回存金額；順修送出後 reload 漏帶 funds_payment embed 導致採購單號掉成「-」）
- [x] /funds-voucher/review/check/[id]（審核頁：對照卡片＋回存金額）
- [x] /funds-payment/my-payment/add/[id]（付款憑單建單頁：總額預帶剩餘額度）
- [x] AllocationSummaryCard 3 個使用點（改用共用 SummaryCard，props 未變）
- [x] DetailSummaryItem 既有 7 個使用點（新增選填 danger prop，不影響現有呼叫）
- [x] npm run build 全站編譯通過（零 error 零 warning）

**審核清單快速審核按鈕放大＋共用化、拿掉查閱按鈕**（Yumin）
分支：`feature/yumin-review-quick-buttons`
開始：2026-07-15
說明：資金分配審核管理頁快速審核按鈕比照筑今系統放大、改為紅底／綠底實心按鈕，抽成共用元件 `_components/QuickReviewButtons.tsx`；拿掉列表與歷史紀錄的「查閱」按鈕（單號本身即連結）。

**組織架構編輯課別/處別按保存沒反應（層級誤設必填）**（Riku）
分支：`feature/riku-org-edit-save`
開始：2026-07-14
說明：組織架構節點編輯的存檔函式把「層級」欄位設為必填（`!editLevel.trim()` 就 return），但層級是純顯示用的選填自由文字標籤，多數節點留空，導致編輯留空層級的課別/處別按保存直接靜默 return、畫面無反應也無錯誤。修正為只檢查名稱必填。

**新增申請單：選申請課別/處別會把已選職務清空**（Riku）
分支：`feature/riku-role-cascade`
開始：2026-07-14
說明：新增資金分配申請單頁「職務」下拉選項值已改為「組織單位＋職稱」組合字，但「申請處別/課別」onChange 仍留舊邏輯，會用純職稱字串反向覆寫職務——格式對不上導致一選課別就把職務清空（多角色課別直接清空、單角色也塞入對不到選項的值）。修正：移除申請處別/課別 onChange 反向覆寫職務的那段（改處別仍清空已選課別）。設計維持單向「選職務→自動帶入處/課」。編輯頁為另一種設計（處/課驅動職務、選項為純職稱），格式一致故不動。

**明細頁共用元件：付款明細表格 + 欄位區塊渲染**（Yumin）
分支：`feature/yumin-shared-detail-components`
開始：2026-07-15
說明：抽出共用唯讀顯示元件 `_components/RecordDetailView.tsx`（`ReadOnlyField`／`DetailFieldLayout`／`DetailBlock`／`DetailSummaryItem`／`GroupDetailTable`／`detailRowGridStyle`），三個明細頁改用同一套樣式，改顏色/間距一次到位連動。暫付款沖銷明細表格原本樣式不同（muted 標頭＋#序號欄），統一為付款憑單/資金分配樣式（text-body 標頭、空值「—」、拿掉 # 欄）。欄位版面比照資金分配申請表單：**無群組區塊＝橫式（標籤在左固定寬 140、內容填滿、columnGap 48）、有群組/可重複列的區塊（付款明細）＝直式（標籤在上）**，三個明細頁一致。審核區塊共用化列為後續階段。
※ 與 Riku `feature/riku-ui-consistency`（付款憑單詳細頁、審核操作頁）重疊，已知會，Yumin 與 Riku 協調。
影響範圍確認（共用明細顯示為橫切關注點）：
- [x] /funds-allocation/review/check/[id]（FundsAllocationDetail 唯讀顯示）
- [x] /funds-payment/my-payment/[id]（FundsPaymentDetail）
- [x] /funds-payment/review/check/[id]（FundsPaymentDetail）
- [x] /funds-voucher/my-voucher/[id]（沖銷明細頁，本次主要目標）
- [x] /funds-voucher/review/check/[id]（沖銷審核頁的明細表格）
- [x] npm run build 全站編譯通過

**出款帳戶可見範圍 + 編輯／防重複／排序**（Riku）
分支：`feature/riku-payment-account-visibility`
開始：2026-07-13
說明：出款帳戶可設定「可見範圍」（組織節點，勾選節點含子孫成員才會在申請單下拉看到；空＝全公司可見）；並加就地改名、新增/改名防重複（去空白不分大小寫）、右上角拖曳排序。
影響範圍確認（出款帳戶下拉過濾為橫切關注點）：
- [x] /funds-allocation/my-funds/add（申請單新增，下拉過濾）
- [x] /funds-allocation/my-funds/edit/[id]（申請單編輯，下拉過濾）
- [x] /funds-payment 建立/草稿編輯（出款帳戶為唯讀繼承，不需過濾，已確認）
- [x] /system-settings/expense-fields（可見範圍/編輯/防重複/排序 UI）
- [x] 待執行 SQL 登記 docs/prod-pending-sql.md

**UI 一致性重構：導入 shadcn Card / Table 組件**（Riku）
分支：`feature/riku-ui-consistency`
開始：2026-06-04
影響範圍確認：
- [x] /system-settings/account-management（含新增、編輯）
- [x] /system-settings/expense-fields
- [x] /system-settings/status-labels
- [x] /system-settings/role-permissions
- [x] /system-settings/approval-flows
- [x] /system-settings/payee-settings
- [x] /system-settings/sidebar-customization
- [x] /system-settings/org-structure
- [x] /system-settings/form-settings（cycle、tax、template tab 及標題區）
- [x] 各模組列表頁（資金分配、付款憑單、暫付款沖銷的 my/all）
- [x] 各模組審核管理頁（三個模組）
- [x] /funds-voucher/review/check/[id]
- [x] /finance/funds、/finance/payment
- [x] /report-issue（IssueListView、module-settings）
- [x] 側邊欄導航（SidebarNav）
- [x] 首頁
- [ ] 其餘頁面（付款憑單詳細頁、審核操作頁、填表頁、費用類型設定、登入頁等）

---

## 待開發

### 🔴 高優先

#### ~~[審核流程與職稱整合重構]~~（Riku）✅ 已完成（2026-06-18）
- [x] 階段一：職稱管理解除層級限制
- [x] 階段二：每位負責人直接帶職稱
- [x] 階段三：申請單職稱欄位改用新來源
- [x] 階段四：審核流程真正運作（2026-06-17 完成）
- [x] 階段五：側邊欄功能權限查詢更新（2026-06-18 完成）

---

#### ~~[帳號管理 + 角色功能權限整合重構]~~（Riku）✅ 已完成（2026-06-18）
- [x] 系統角色精簡：刪除課級主管、主管議會成員、諮詢議會成員；主管改名為處、課級主管；保留系統管理員、處、課級主管、財務長、財務人員、一般職員
- [x] 移除「對應組織職稱」欄位（SystemRole 型別已不含此欄位）
- [x] 帳號管理 + 角色功能權限合成一頁，用 Tab 切換（Tab1：角色管理；Tab2：帳號列表）
- [x] 側邊欄移除「角色功能權限設定」獨立入口，只留「帳號管理」（role-permissions 頁 redirect 至 account-management）

#### ~~[審核群組（諮詢議會/主管議會）]~~（Riku）✅ 已完成（2026-06-18）
- [x] 資料庫新增 `approval_groups`、`approval_group_members` 表
- [x] 審核流程管理頁新增「審核群組」Tab，可新增群組並搜尋帳號加入成員
- [x] 審核流程步驟新增第三種審核人類型「審核群組」
- [x] 後端審核邏輯（`checkCanReviewStep`、`getPendingXxxForReviewer`）支援群組比對

#### [全站 confirm() 替換為系統風格確認對話框]
- **問題**：全站 19 處使用瀏覽器原生 `confirm()`，彈出視窗與系統 UI 風格不一致
- **解法**：安裝 shadcn Dialog，建立 `useConfirm` hook，替換 8 個檔案中所有 `confirm()` 呼叫
- **範圍**：`approval-flows`、`expense-fields`、`role-permissions`、`org-structure`、`payee-settings`、`fee`、`form-settings/_tax-tab`、`funds-allocation/edit`、`report-issue/module-settings`

#### [費用項目（主要）欄位值未存入資料庫（欄位代號誤掛 amount）]
- **問題**：表單設定中「費用項目（主要）」的欄位代號被設成結構化欄位 `amount`，送出時 `amount` 欄位會被付款明細彙總總額覆寫，主要的選擇完全沒有存進資料庫；編輯頁該欄位還原時顯示金額數字（如「0」「16000」）而不是當初選的項目
- **實測確認**：2026-07-11 做費用項目連動功能時 Playwright 實測發現（編輯頁主要還原值為「0」）
- **修法方向**：把該欄位改掛自訂欄位代號（表單設定重新加入欄位、或 SQL 直接改 `form_schemas` jsonb 的 fieldId），改完值會存進 `extra_data`；需同步檢查共用範本（含筑今匯入的 23 個）的 `field_values` 是否有以 `amount` 為 key 存主要值，有的話要一起搬 key
- **備註**：細項連動已對此防呆——主要值不在選項清單中時退回顯示全部選項，不會鎖死

#### [支出欄位設定 RLS 寫入修復]
- **問題**：`/system-settings/expense-fields` 新增／刪除選項時出現 RLS 錯誤（`new row violates row-level security policy for table "dropdown_options"`）
- **原因**：頁面直接用 `supabase`（一般客戶端）執行 INSERT/DELETE，被 Supabase RLS 擋住
- **解法**：與組織架構頁相同，將寫入操作移至 Server Actions，改用 `supabaseAdmin`（service role key）

#### ~~[（稅收）費用自動計算]~~（Riku）✅ 已完成（2026-06-02）

#### ~~[資金分配審核流程彈性化]~~ ✅ 已完成（2026-05-22）

#### ~~[付款憑單審核流程彈性化]~~ ✅ 已完成（2026-05-22）

#### ~~[暫付款憑單邏輯設計]~~ ✅ 已完成（2026-05-23）

#### ~~[我的列表應對應使用者，避免看到他人單據]~~（Riku）✅ 已完成（2026-06-08）

#### [付款明細欄位需同步到付款憑單、暫付款沖銷憑單]（付款憑單部分 ✅ 已完成 2026-07-10，Yumin）
- **目標**：付款明細的欄位內容要能延續／同步到付款憑單與暫付款沖銷憑單，不需要重複填寫
- **進度**：付款憑單同步已完成（見已完成區段）；**暫付款沖銷憑單同步尚未開始**，留在此追蹤

#### ~~[資金分配申請類型選擇邏輯調整：改到付款憑單階段才選]~~（Riku）✅ 已完成（2026-07-11）

#### [付款分類：審核步驟下拉＋後台設定＋列表欄]（2026-07-14 Yumin 拍板）→ 開發中，已移至「進行中」（分支 `feature/yumin-payment-category`），規格見 `docs/core-logic/BC資金分配系統核心邏輯.md` 第十節

---

### 🟡 中優先

#### ~~[預選範本]~~ ✅ 已完成（2026-05-27，Riku）
- 資金分配申請預選範本完成；付款憑單不實作

#### ~~[CSV 匯出—付款憑單 + 暫付款沖銷憑單]~~ ✅ 已完成（2026-05-25，Riku）

#### ~~[各頁面搜尋功能]~~ ✅ 已完成（2026-05-24，Riku）
- **目標**：每個列表頁加入關鍵字搜尋列，支援即時過濾

#### ~~[下拉選單搜尋功能]~~ ✅ 已完成（2026-05-25，Riku）


#### ~~[付款憑單區塊、列設定]~~ ✅ 已完成（Riku）

#### [剩餘金額顯示（審核管理）]（Yumin）
- **目標**：審核管理頁顯示剩餘可用金額，讓審核人一眼掌握預算狀況

#### ~~[自定義狀態標籤名稱]~~ ✅ 已完成（2026-05-23）

---

#### [通知功能]（Riku）
- **目標**：頂列頭像左側新增鈴鐺圖示，顯示未讀數量紅點；點開後列出通知清單，點擊跳轉對應頁面並標記已讀
- **通知事件（對申請人）**：
  - 申請單 / 付款憑單被**核准**
  - 申請單 / 付款憑單被**退回**
  - 資金分配申請核准後，提醒可以**建立付款憑單**
- **通知事件（對審核人）**：
  - 有新的申請單 / 付款憑單 / 暫付款沖銷憑單**等待你審核**
- **通知事件（對管理員，可選）**：
  - 問題回報新增 / 狀態更新
- **備註**：需新增 `notifications` 資料表（對象、類型、連結、是否已讀）；審核動作執行時同步寫入通知記錄

#### [使用者個人資料編輯]（Riku）
- **目標**：右上角頭像選單的「修改密碼」實作完整功能
- ~~**編輯頭像**：點擊後可上傳圖片，更新後頭像顯示於右上角選單~~ ✅ 已完成（2026-06-25）
- **修改密碼**：點擊後彈出表單（舊密碼 + 新密碼 + 確認新密碼），驗證後更新
- **Google 登入相容**：若未來改為 Google OAuth 登入，「修改密碼」改顯示提示文字「已使用 Google 登入，無法修改密碼」，不顯示表單
- **備註**：一般 Email 註冊帳號維持可改密碼；Google 帳號不顯示此選項或顯示說明提示

#### ~~[Google 註冊、登入]~~（Riku）✅ 已完成（2026-06-09）

#### [分享個人範本給其他使用者]（Riku）
- **目標**：共用範本邏輯保留；個人範本額外支援「分享給指定使用者」，被分享者可選用該範本填單
- **備註**：需確認分享對象選取方式（搜尋人名）及被分享者是否可另存為自己的個人範本

#### [付款明細費用與總額列畫面呈現優化]（Riku）
- **目標**：確認付款明細的費用欄與總額欄可同時顯示並正確排列，優化多列明細的視覺呈現
- **備註**：與「支援同時新增兩列」高優先任務相關，可合併處理

#### [文字引導：不清楚欄位名稱的提示說明]
- **目標**：對系統中語意不直觀的欄位或操作，加入 tooltip 或說明文字，降低使用者理解門檻
- **備註**：範圍待整理（逐頁標注不清楚的字詞後統一實作）

#### [CSV 匯出欄位選擇邏輯檢查]（Riku）
- **目標**：確認各列表的 CSV 匯出彈窗中，欄位選項是否正確、完整、符合實際需求
- **範圍**：資金分配申請、付款憑單、暫付款沖銷憑單
- **備註**：問題回報列表、帳號管理列表不需要做 CSV 匯出

### 🟢 低優先 / 未來探索

#### [站外通知（推播）]（Riku）
- **目標**：在現有站內通知基礎上，支援站外推播，讓使用者不開瀏覽器也能收到通知
- **備選方案**：
  - **Browser Push Notification**：Web Push API + Service Worker，使用者同意後可在瀏覽器背景推播（不需 App）
  - **Email 通知**：寄信到使用者 email，適合低頻重要事件（最終核准/退回）
  - **Line Notify / Line Bot**：若公司內部使用 Line，接入 Line Notify 或 Messaging API
- **備註**：現有 `notifications` 資料表架構已可擴充；推播 token 需新增欄位儲存（`app_users.push_token`）；優先確認公司偏好的通知管道再實作

#### [剩餘金額計算（個人儀表板畫面）]
- **目標**：在個人儀表板顯示個人剩餘可用金額，讓申請人掌握自身預算狀況

#### [視覺化組織圖（可編輯 + 權限整合）]
- **目標**：將現有樹狀列表改為可互動的視覺化格子組織圖
- **核心邏輯**：每個格子 = 一個職位，格子綁定系統角色，使用者放入格子即自動繼承該角色的功能權限；角色功能定義維持在現有「角色功能權限設定」頁不變
- **可編輯範圍**：新增/刪除/移動格子（改父層關係）、格子內指派人員、格子綁定系統角色
- **視覺功能**：上方可點選層級（財務長/處長/課長/職員等），點選後對應層級的所有格子亮起燈號
- **初始匯入**：Riku 可提供 Excel（欄位：層級關係、職位名稱、對應人員），由系統一次匯入建底板，後續用視覺圖維護
- **資料庫異動**：`org_unit_roles` 新增 `system_role_id` 欄位，串接組織職位與權限角色
- **備註**：公司組織圖約半年更新一次；匯入格式建議為平坦式 Excel（每列一人，含部門/處/課/科/職稱/姓名欄位）

---

## 設計問題待確認（開工前需回答）

### 通知發給「非審核者」— 節點負責人被直接當審核人（待確認方向，Riku 2026-07-15 討論）

**現象**：同一個人掛在多個組織節點、或一個課/處節點下掛了多位負責人時，非審核者（例如課員）也會一直收到「待審核」通知。

**目前通知邏輯（4 種事件、2 個觸發時機）**：
- 事件：`待審核`(發下一關審核人)／`已核准`(發申請人)／`已退回`(發申請人)／`可建立付款憑單`(發申請人，僅資金分配核准後多發)。
- 觸發時機：① 有人按「送出」→ 通知第一關審核人；② 有人按「核准/不核准」→ 核准非末關傳下一關、核准末關回發申請人(已核准[+可建付款憑單])、不核准回發申請人(已退回)。
- 儲存草稿、財務「確認付款」結案 → 不發通知。
- 三種單據(資金分配/付款憑單/沖銷)機制相同，僅標題文字不同。

**根因**：`org_role` 審核步驟只存「處別/課別」層級（`org_unit_type`），**不存職稱**（`role_type_id` 永遠 null，見 `approval-flows/page.tsx:404` 與步驟編輯 UI 只有層級下拉）。於是：
- 通知找人（`actions/notifications.ts` 的 `resolveReviewerUserIds`）＝抓「該課/處節點底下**全部**負責人」。
- 實際可審判斷（`actions/approval-flow.ts` 的 `stepMatchesReviewer`, L563-571）＝一樣，只認「你是該節點成員」，**不看職稱**。
- 兩邊「一致地」把節點所有負責人＝審核人，所以課長、課員全被通知也全能審。

**待決定的修正方向（三選一，Riku 尚未拍板）**：
1. **依職稱過濾**：審核人＝節點成員中職稱為課長(課別)/處長(處別)者；課員留節點當團隊成員但不通知不可審。需組織架構主管職稱標記完整。
2. **範本步驟加「限定職稱」下拉**：留空＝現狀(全節點)、選了＝只找該職稱。最有彈性、不動組織語意，但要改範本 UI＋通知/審核兩邊解析。
3. **只清組織架構資料**：節點只掛真正簽核人、課員不掛負責人。治標易重犯。

**注意**：這是橫切關注點——通知端(`notifications.ts`)與可審端(`approval-flow.ts` 的 `stepMatchesReviewer`/`resolveReviewerUserIds`)必須**同步改**，否則會變「有通知不能審」或反之。方案 2 另需登記正式機 SQL(步驟表加職稱欄若尚無)。

---

### 審核流程重構過程中發現的設計問題（待確認）

測試階段三（申請單職稱欄位）時發現，當使用者只在「處」級節點有成員身份（例如處長），沒有直屬的課別時，以下邏輯尚未決定：

1. **處級人員申請時，申請課別是否為選填？**
   目前課別為必填，但處長本來就不屬於任何課，無法填寫。應改為非必填？或提供「不適用」選項？

2. **若申請人沒有課別（只有處），審核鏈從哪裡開始？**
   正常流程是：課員 → 課長 → 處長 → …。處長自己提申請，是否跳過課長步驟直接從處長（自審）開始？還是走完整流程由課長空步驟自動通過？

3. **申請課別為空時，職稱欄位是否仍能帶出？**
   目前已改為「選了處別就能填職稱」（不需要選課別），但職稱的邏輯需搭配第 1、2 點的結論一起調整。

---

### 待詢問 D3 財務人員

- **離職或轉調人員轉單問題**：審核人員離職或轉調時，進行中的申請單如何處理？（轉交給誰、由誰觸發）
- **分公司切換邏輯問題**：多分公司的切換機制如何設計？（登入後選分公司 vs. 帳號對應單一分公司）
- **課別無負責人時的審核行為**：申請人所在的課別若沒有指定負責人，申請單送出後課別審核步驟無人可審，目前會卡死。需確認：應在送出前擋住並提示、自動跳過該步驟，還是通知管理員介入？
- **登入方式確認**：是否改用 Google OAuth 取代現有 Email + Password 登入？
  - 若改用 Google OAuth，新使用者第一次登入時系統自動建立帳號，並指派到管理員預先設定的「新用戶預設職務」，立即繼承該職務的系統角色權限，不需要等待審核
  - 預設職務可在系統設定中自由指派為任一職務（通常設為一般職員等基本權限角色）
  - Admin 有空時再進組織圖把使用者移到正確職位，權限自動更新
  - 使用 Google 登入的帳號，個人資料頁的「修改密碼」改顯示說明提示，不開放修改

### 資金分配 / 付款憑單審核流程彈性化

#### ✅ 已確認

- **審核人解析方式**：根據申請人所屬組織單位 + 步驟定義的職位類型動態找到審核人。例如第一處員工提交 → 找第一處課長 → 第一處處長。
- **流程變更時機**：統一宣布後所有新申請改用新流程，不會有跑到一半的舊資料，不需要快照機制。
- **範本獨立管理**：資金分配和付款憑單各自有獨立的流程範本，分開設定。
- **提交人即審核人時的行為**：採 **B. 手動自審**——課長仍需進入審核清單自行點一次「通過」才往上送。

---

## 已完成

**付款明細群組編輯表格化（GroupEditTable 共用元件）**（2026-07-16，Yumin）
分支：`feature/yumin-group-edit-table`
開始：2026-07-16
說明：同仁反映付款明細多組時卡片式排版（每組重印一次 label）眼花撩亂、金額無法上下對照，且編輯畫面與送出後唯讀明細頁（GroupDetailTable 表格）樣式不一致。新增共用元件 `_components/GroupEditTable.tsx`，群組明細**編輯**畫面統一表格化（表頭一次含必填星號與欄位 hint、每組一列、行尾 ✕ 刪除、表格下方＋新增項目），對齊筑今與唯讀明細頁表格；欄寬依欄位型別自動配置（數字 125（容納七位數金額，Yumin 驗收後調整）／日期 130／下拉依該欄最長選項文字自動 110～280（selectOptionLabels 回呼，細項→256、稅額選擇→110）／文字欄吃剩餘寬度；資金分配付款明細在 1452px 筆電側欄展開下不需捲動，更窄時區塊內橫向捲動），群組表格區塊左右內距 48→24 換取表格空間；欄位順序＝表單設定群組列攤平順序（程式不寫死，rowGroupStart 開關旁加說明文字）；稅額公式自動帶入/總額唯讀加總/費用項目主細項連動等計算邏輯完全不動（renderCell 由各頁提供、只換渲染外殼）。`SearchableSelect` 加選用 `portal` 參數（下拉改 createPortal 到 body、fixed 定位、捲動時同步重算位置）——表格容器 `overflow-x: auto` 會裁切原本絕對定位的下拉，只有表格儲存格內的下拉開啟、其他頁面行為不變。另依 Yumin 指定調整 dev/staging 資金分配付款明細結構（正式機需手動同步＋回填 SQL，見 prod-pending-sql）：①欄位順序改「摘要/用途說明、費用、手續費、稅額選擇、稅額」；②**單據種類/幣別移出群組**（整張單同一個值、新增多組不用每組重選，顯示在表格上方組外列，群組表格欄序＝費用項目（細項）、摘要、費用、手續費、稅額選擇、稅額）；③舊申請單 34 筆＋範本 8 筆已回填第一組的單據種類/幣別到頂層 extra_data／field_values（不回填舊單這兩欄會空白、編輯舊草稿要重選；多組值不同帶第一組，與付款憑單帶入規則一致，Yumin 拍板）；④付款憑單表單群組列「稅額選擇｜摘要/用途說明」互換為「摘要/用途說明｜稅額選擇」（攤平欄序＝摘要、稅額選擇、未稅金額、稅額、總額）。npm run build 通過，Playwright 實測（1452/1512 視窗表格不捲動、稅額自動計算 1000×境外稅→250、彙總正確、增刪組正常、portal 下拉不被裁切、舊單 #49 編輯頁正確帶出回填的單據種類/幣別）。
影響範圍確認（群組編輯為橫切關注點）：
- [x] /funds-allocation/my-funds/add（AddFundsForm，實測含稅額計算/增刪組）
- [x] /funds-allocation/my-funds/edit/[id]（EditFundsForm，含審核人編輯與唯讀模式：非 canEdit 不顯示新增/刪除）
- [x] /funds-payment/my-payment/add/[id]（建立頁，實測表頭 稅額選擇|摘要|未稅金額|稅額|總額）
- [x] /funds-payment/my-payment/[id]（草稿編輯頁，實測同上）
- [x] /funds-voucher/my-voucher/add/[id]（沖銷建立頁，實測表頭 摘要用途|未稅金額|稅額|總額、總額預帶值正常）
- [x] /system-settings/form-settings 範本分頁（群組預填編輯器共用同元件、去必填星號，實測既有範本值正常載入）
- [x] npm run build 全站編譯通過

**附件欄位：說明提示 + 母單附件帶入欄位 + 修三頁附件顯示 bug**（2026-07-16，Yumin）
分支：`feature/yumin-attachment-hints`
開始：2026-07-16
說明：① `FormSlot` 新增 `hint`（欄位說明小字），表單設定頁每個欄位可填一行提示，顯示在填寫頁欄位上方——附件欄位用來列各階段常見應附單據（資金分配：CSW/合約/報價單、Invoice/發票、刷卡明細；付款憑單：Invoice/發票、刷卡明細、匯出付款憑單html；暫付款沖銷：紙本發票收據）；② 母單（上游單據）附件改為顯示在填寫頁「第一個附件欄位」內（唯讀灰底不可刪；付款憑單標「來自申請單」、暫付款沖銷帶兩層——申請單附件標「來自申請單」＋母付款憑單附件標「來自付款憑單」，`getVoucherInheritedAttachments` 一次撈兩層，沖銷建立/詳細/審核三頁皆帶；沖銷詳細頁草稿狀態附件欄位可直接補傳/刪除，上傳即存檔），移除付款憑單建立頁/草稿編輯頁/審核頁底部重複的「附件」卡片（原本「本憑單附件」與表單附件欄位功能重複，職員會傳錯位置）；付款憑單表單並刪除與「上傳單據」重複的「補充單據資料」附件欄位（Yumin 確認，表單設定變更；舊檔由歸位規則自動收進「上傳單據」顯示）；③ 修三個 bug：付款憑單草稿編輯頁 attachment 欄位渲染成文字框（漏抄建立頁的 attachment 分支）、草稿存檔把 attachment 欄位當文字寫進 extra_data 污染、FundsPaymentDetail／沖銷詳細頁／沖銷審核頁完全看不到附件（審核人看不到職員上傳的單據）；④ 抽共用 `lib/attachmentSlots.ts`（附件欄位與 slot_label 對應規則，對不上的舊檔收進第一格）＋ `RecordDetailView` 的 `FieldHint`／`DetailAttachmentField`。
dev 資料庫遷移已執行（2026-07-16，Yumin 確認）：填入三張表單附件 hint、刪付款憑單「補充單據資料」欄位、清掉 15 張憑單 extra_data 的附件欄位殘留 key。正式機需同步（見 prod-pending-sql）。
影響範圍確認（附件顯示為橫切關注點）：
- [x] /funds-payment/my-payment/add/[id]（建立頁：母單附件入欄位、hint、移除底部卡片）
- [x] /funds-payment/my-payment/[id]（草稿編輯頁：修文字框 bug、修存檔污染、母單附件入欄位、hint、移除底部卡片；已送出走 FundsPaymentDetail）
- [x] /funds-payment/review/check/[id]（審核頁：FundsPaymentDetail 顯示附件、移除底部卡片）
- [x] /funds-voucher/my-voucher/add/[id]（沖銷建立頁：hint）
- [x] /funds-voucher/my-voucher/[id]（沖銷詳細頁：修看不到附件 bug）
- [x] /funds-voucher/review/check/[id]（沖銷審核頁：修看不到附件 bug）
- [x] /funds-allocation/my-funds/add、edit/[id]（資金分配新增/編輯：hint）
- [x] FundsAllocationDetail（已正確處理 attachment，未受影響）
- [x] Playwright 實測：建立頁上傳按鈕（非文字框）、母單附件帶入標「來自申請單」、底部卡片消失、無 console error
- [x] npm run build 全站編譯通過

**審核管理預設週次時區 bug：UTC 伺服器凌晨差一天**（2026-07-16，Yumin，staging 測試時發現順修）
分支：`feature/yumin-attachment-hints`（隨附件功能同分支）
開始：2026-07-16
說明：三個審核管理頁（資金分配/付款憑單/沖銷）是 Server Component，預設週次用 `getCurrentWeekStart()`＝`new Date()` 伺服器本地時間（Vercel＝UTC）計算。台北比 UTC 快 8 小時，每天台北 00:00–08:00 期間伺服器還停在「昨天」；週四（週起始日）凌晨開審核管理，預設週會錯落到上一週、新單全被過濾掉看不見（我的付款憑單等列表頁是 client 端算週次用瀏覽器台北時間，正確，兩頁對不起來）。修正：`weekUtils` 的 `getCurrentWeekStart` / `getAvailableYears` 改以台北時區日曆日計算（`toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })`）。WeekPicker 為 client 元件不受影響。
影響範圍確認（weekUtils 為共用，橫切關注點）：
- [x] /funds-allocation/review（server 端預設週次）
- [x] /funds-payment/review（server 端預設週次，bug 發現處）
- [x] /funds-voucher/review（server 端預設週次）
- [x] /finance/funds（用 getAvailableYears）
- [x] WeekFilterBar / WeekPicker（client 端，瀏覽器台北時間本就正確，行為不變）
- [x] node 模擬 UTC 2026-07-15T20:00（台北 07-16 週四凌晨）：舊邏輯回 07/09（錯）、新邏輯回 07/16（對）
- [x] npm run build 通過

**原生 confirm/alert 全站改為系統彈窗**（2026-07-15，Riku）
分支：`feature/riku-confirm-dialog`
說明：全站所有刪除／移除確認、上傳失敗提示原本用瀏覽器原生 `confirm()`／`alert()`（與網址列同源、抽離系統視覺、不跟隨深淺色主題），改為系統中央彈窗。新增共用元件 `_components/ConfirmDialog.tsx`（比照 ErrorDialog 視覺、`document.body` portal、刪除類 `danger` 紅色確定鈕）＋`_components/useConfirm.tsx`（Promise 版 hook，`if (!(await confirm(...))) return`）；上傳失敗兩處改用既有 `ErrorDialog`。共 24 處。
影響範圍確認（原生彈窗取代為橫切關注點，grep `confirm(`／`alert(` 全站清空、僅剩註解）：
- [x] /system-settings/org-structure（移除職位指派／負責人、刪除節點／職位／職稱，共 5）
- [x] /settings/fee（類別／子類別／欄位／費用項目，共 4）
- [x] /system-settings/payee-settings（類別／欄位／付款對象，共 3）
- [x] /system-settings/expense-fields（付款分類、選項 ×2，共 3）
- [x] /system-settings/approval-flows（群組、範本，共 2）
- [x] /system-settings/account-management（角色）、form-settings/_tax-tab（稅額選項）、report-issue/module-settings（模組選項）
- [x] /funds-allocation/my-funds/add（刪除範本）、edit/[id]（刪除單據）
- [x] /report-issue 列表與詳細頁上傳失敗提示（改用 ErrorDialog）
- [x] npx tsc --noEmit 零錯誤

**費用項目（主要）底下細項唯一時自動帶入細項**（2026-07-15，Riku）
分支：`feature/riku-fee-detail-autofill`
說明：資金分配申請新增/編輯頁，選「費用項目（主要）」後，若該主要編號底下對應的「費用項目（細項）」恰好只有一筆，就自動帶入那一筆（使用者不必再點）；有多筆時維持原本只列出符合編號的選項、交給使用者自選。改在觸發連動的 `clearMismatchedDetailFees`（選主要時呼叫）內計算：先清掉編號對不上的舊細項，再對每個細項欄位算出符合主要編號的選項，剛好一筆就填入。固定欄位與付款明細群組欄位分開處理（依欄位屬於固定區或群組區，避免污染群組 extra_data）；只在「改選主要」時觸發，載入既有單子不覆蓋原值。使用者已先在費用類型設定補上 `3.1 應收帳款支出` 的細項，故目前全部主要編號都至少對應一筆（原本 3.1 無細項會導致必填細項無選項卡送出）。
影響範圍確認（主要/細項連動為橫切關注點）：
- [x] /funds-allocation/my-funds/add（AddFundsForm：選主要→單筆自動帶、多筆自選）
- [x] /funds-allocation/my-funds/edit/[id]（EditFundsForm：同上）
- [x] /funds-allocation/review/check/[id]（審核頁編輯用 EditFundsForm，一併涵蓋）
- [x] npx tsc --noEmit 零錯誤

**資金分配「費用項目（主要）」欄位代號撞名 amount 修正**（2026-07-15，Riku）
分支：`feature/riku-fee-item-fieldid`
說明：資金分配表單「費用項目（主要）」下拉的欄位代號被誤設為 `amount`，與存「金額／總額」的 `amount` 撞名——載入時被填成單子總額數字（畫面顯示成數字而非費用項目）、存檔時使用者選的值又被付款明細總額覆蓋、選的值永遠存不進去。修法：把該欄 fieldId 改為專屬 `custom_expense_item_main`（純表單設定變更、**無程式碼變更**），`custom_` 既有機制自動把值存進 `extra_data['費用項目']`、載入正確顯示、也繼續驅動「費用項目（細項）」連動篩選；數字總額 `amount` 照舊由付款明細加總算出、列表「費用項目」欄仍以細項（`expense_item`）為準。dev/staging 共用同一 Supabase 故 script 一改即同步（staging 可直接測）；正式站為獨立專案，同一 fieldId 變更 SQL 已登記 `docs/prod-pending-sql.md` 待執行。掃過三種 form_type，僅資金分配有此撞名。舊申請單（改前建立）此欄會顯示空白（該值以前從沒存下來），必填故編輯舊單需補選一次。Playwright 實測：主要下拉正確顯示費用項目、改費用存檔後主要值不被總額覆蓋、DB `extra_data[費用項目]` 正確保存。
影響範圍確認（表單欄位代號 + 主要/細項連動為橫切關注點）：
- [x] /funds-allocation/my-funds/add（新增頁：選主要→存 extra_data、連動細項）
- [x] /funds-allocation/my-funds/edit/[id]（編輯頁：正確顯示、改費用不覆蓋主要）
- [x] /funds-allocation/review/check/[id]（審核頁編輯：同編輯頁，實測通過）
- [x] 範本存/套用（field_values 以 fieldId 為 key 通用存取，新範本存 custom_expense_item_main、舊範本此欄空白）
- [x] 列表「費用項目」欄（讀 expense_item=細項，不受影響）
- [x] showWhen 掃描（無欄位以 amount 為觸發，安全）
- [x] 其他 form_type 掃描（payment_voucher/temp_voucher 無 amount 撞名）
- [x] docs/prod-pending-sql.md 登記正式站 fieldId 變更 SQL

**審核頁儲存變更後畫面即時刷新**（2026-07-15，Riku）
分支：`feature/riku-review-save-refresh`
說明：資金分配審核頁（`/funds-allocation/review/check/[id]`）審核人編輯欄位按「儲存變更」後，畫面未即時更新（資料實際已存、變更歷程可證），需手動重新整理才正確。根因：`onSaveSuccess` 先 bump `refreshKey` 讓 `EditFundsForm` 立即用「還沒重抓的舊 record」重建，重抓 record 的 `useEffect` 是非同步晚一步完成，且 `EditFundsForm` 欄位值初始化綁 `[record.id]`（存檔前後不變）故不再同步，於是畫面卡在舊值。修法：把 `load()` 抽成可重複呼叫（`useCallback`），`onSaveSuccess` 改為先 `await load()`（更新 record 與核准金額預填）再 bump `refreshKey`，確保表單重建時吃到新資料。只動審核頁一個檔，不碰共用元件。Playwright 實測：改費用 10000→8000 存檔後未重新整理，畫面即顯示 8000／稅額 2000／總額 10000／上方費用項目與核准金額預填同步更新，DB 一致。tsc 通過。

**付款憑單／暫付款沖銷申請人檢視頁審核進度改用共用 ReviewProgressBlock**（2026-07-15，Yumin）
分支：`feature/yumin-applicant-review-block`
說明：付款憑單詳細頁（`funds-payment/my-payment/[id]`）與暫付款沖銷詳細頁（`funds-voucher/my-voucher/[id]`）的申請人檢視原本是純文字「審核歷程」列表（只列已完成紀錄、無未來階段），改為共用 `_components/ReviewProgressBlock.tsx` 的 `readOnly` 一列式排版（比照資金分配編輯頁）：完整顯示所有審核階段、已完成階段顯示核准/不核准 radio＋審核人/時間、未來階段反灰。付款憑單顯示核准金額欄（`showApprovedAmount`）、沖銷不顯示。查詢多帶 `approval_flow_steps` 的 `id`/`reviewer_type`、新增依 `reviewer_id` 撈 `app_users` 審核人名，草稿狀態不顯示。此為第 28 行「明細頁共用元件」任務註明的「審核區塊共用化後續階段」的申請人檢視收尾。
影響範圍確認（審核進度顯示為橫切關注點）：
- [x] /funds-payment/my-payment/[id]（付款憑單申請人檢視，含核准金額欄）
- [x] /funds-voucher/my-voucher/[id]（暫付款沖銷申請人檢視，不含核准金額欄）
- [x] /funds-allocation/my-funds/edit/[id]（資金分配編輯頁，先前已套用，本次未動）
- [x] tsc 型別檢查與 eslint 通過

**建單頁資訊區塊改橫式（比照唯讀詳細頁）**（2026-07-15，Yumin，同分支延續）
說明：付款憑單建單頁與暫付款沖銷建單頁的上方非群組資訊區塊原本是直式（標籤在上），與唯讀詳細頁（RecordDetailView 橫式）不一致。改為共用 `DetailFieldLayout`＋`detailRowGridStyle`（同一 `block.rows.some(r => r.repeatable || r.rowGroupStart)` 判斷）：無群組區塊＝橫式（標籤在左固定寬 140），付款明細群組區塊維持可編輯卡片直式。DetailFieldLayout 的 children 放可編輯 renderInput/renderField；付款憑單直式群組區塊維持原本含總額提示排版。另沖銷建單頁最外層原本有 `maxWidth: 720` 限制（付款憑單建單頁/兩個詳細頁皆無），導致橫式欄位輸入框過窄截斷，一併移除改滿版與詳細頁一致。
影響範圍確認（建單頁版面為橫切關注點）：
- [x] /funds-voucher/my-voucher/add/[id]（暫付款沖銷建單頁）
- [x] /funds-payment/my-payment/add/[id]（付款憑單建單頁）
- [x] tsc 型別檢查與 eslint 通過

**審核清單快速審核按鈕放大＋共用化、拿掉查閱按鈕**（2026-07-15，Yumin）
分支：`feature/yumin-review-quick-buttons`
說明：資金分配審核管理頁快速審核按鈕比照筑今系統放大、改為實心紅底 `#f1416c`（不核准）／綠底 `#50cd89`（核准）、`whitespace-nowrap` 不斷行，抽成共用元件 `_components/QuickReviewButtons.tsx`（原本不核准只是紅框白底小字）。拿掉列表非本關列與「我的審核紀錄」歷史列的「查閱」按鈕（單號欄本身即連結，不影響進入審核頁），並移除歷史列空白動作欄；職務欄加 `w-32` 讓右側快速審核欄留白。build 通過。
影響範圍確認（審核清單按鈕為橫切關注點）：
- [x] /funds-allocation/review（快速審核 Tab：諮詢議會／執行長／財務長；查閱按鈕移除含課處長 Tab 與我的審核紀錄）
- [x] 新增共用元件 QuickReviewButtons，供三模組審核清單未來共用
- [x] npm run build 全站編譯通過

**範本管理付款明細支援整組重複＋按編輯自動捲動**（2026-07-15，Riku）
分支：`feature/riku-template-group-repeat`
說明：共用範本管理（表單設定→範本分頁 `_template-tab.tsx`）的付款明細群組原本只能存「一組」預設值，與資金分配申請表單的整組重複新增功能對不齊，導致範本無法預填多組明細。改為比照申請表單支援多組——每組以框線卡片包裝、標「第 N 組」，下方「＋ 新增此組」、兩組以上每組右上角「刪除此組」；`editorGroup` state 由單一物件改為陣列、`buildFieldValues` 存整組陣列（整組空白略過）、`openEdit` 讀回全部組（不再只取第一組），與 `__group_{blockId}` JSON 格式一致，套用範本時 AddFundsForm 即帶入全部組。另修正按「編輯／新增」需自己往上滑才看到編輯卡片：加 `editCardRef` + `scrollIntoView` 自動平滑捲到編輯卡片。範本編輯器不帶稅額自動計算（純預填值）。只動 `_template-tab.tsx`，無資料庫結構變更，tsc 通過。

**付款憑單／暫付款沖銷憑單建立頁加「儲存草稿」按鈕**（2026-07-15，Yumin）
分支：`feature/yumin-payment-voucher-draft`
說明：對齊資金分配新增頁，兩個建立頁改成「儲存草稿」＋「確定送出」雙按鈕。儲存草稿只建立 draft（放寬：`createPayment`/`createTempVoucher` 加 `asDraft` 參數，草稿允許金額 0 存半成品、仍擋負數與超過剩餘/原預支上限）、確定送出跑費用檢查（付款憑單 `validateFeePositive`）後建立並接送審 action（`submitMyPayment`/`submitTempVoucher`）。既有呼叫端不受影響（新增選填參數、預設嚴格）。無資料庫結構變更。tsc/eslint 通過。

**審核區塊共用化：抽 ReviewProgressBlock，比照筑今一列式排版**（2026-07-15，Yumin）
分支：`feature/yumin-review-block-shared`
說明：三個審核操作頁（資金分配／付款憑單／暫付款沖銷 review/check）的「審核進度」動作區塊統一改用共用元件 `_components/ReviewProgressBlock.tsx`，比照筑今一列式排版——每個階段一列（階段名｜不核准○核准○｜評論(＋付款分類)｜核准金額｜確定送出），已完成階段顯示已選(反灰)結果＋審核人/時間、未來階段整列反灰、僅進行中可操作；評論框與核准金額同高(56px)、整列垂直置中；不核准/核准比照筑今順序；僅進行中階段名深色、其餘灰字，不再顯示「待審核」字樣。props 切換 `showApprovedAmount`（資金分配／付款憑單）與 `enablePaymentCategory`（付款憑單／沖銷的審核群組步驟顯示付款分類）。申請人自行查看審核進度（EditFundsForm 面板）改用 `readOnly` 模式：整列唯讀、不核准/核准置中、右側顯示核准金額、無評論框無送出鈕（比照筑今申請人檢視）。各頁保留自己的送出/驗證邏輯。無資料庫結構變更，npm run build 通過。
影響範圍確認（審核區塊為橫切關注點）：
- [x] /funds-allocation/review/check/[id]（showApprovedAmount，無付款分類）
- [x] /funds-payment/review/check/[id]（showApprovedAmount＋群組步驟付款分類）
- [x] /funds-voucher/review/check/[id]（無核准金額，群組步驟付款分類）
- [x] /funds-allocation/my-funds/edit/[id]（EditFundsForm 申請人視角，readOnly 模式）
- [x] staging Yumin 驗收通過

**暫付款沖銷憑單審核管理頁 Tab 對齊付款憑單**（2026-07-14，Riku）
分支：`feature/riku-voucher-review-tabs`
說明：審核管理頁原本只有「待我審核／我的審核紀錄」兩個 Tab，改寫成 Server 元件（`review/page.tsx`）＋ `VoucherReviewClient.tsx`，Tab 結構比照付款憑單審核管理頁——課、處長審核（org_role，回溯母付款憑單申請單處/課別過濾）＋動態群組 Tab（`getTempVoucherReviewGroups`）＋我的審核紀錄，依出款帳戶（繼承母付款憑單）分區塊、年份＋週次篩選、Tab badge 只計待審筆數、群組 Tab 審核鈕只給群組成員。新增 3 個 server action（`getVouchersForOrgRoleByWeek`/`getVouchersForApprovalGroupByWeek`/`getTempVoucherReviewGroups`），擴充 `filterReached`/`getMaxRecordedSteps` 支援 `temp_voucher_id`，新增 `getAttachmentsByTempVoucherIds`。新增權限 `fv-review-div`/`fv-review-group`。列表對齊 9 欄（敘述欄與核准金額抓母付款憑單、第 8 欄「沖銷金額」為沖銷憑單自身 amount、發票憑證為沖銷憑單附件）。無資料庫結構變更（`fund_attachments.temp_voucher_id` 早已存在，僅補進 TS 型別）。
影響範圍確認：
- [x] /funds-voucher/review（改寫 Server 元件 + VoucherReviewClient）
- [x] actions/approval-flow.ts（3 個新 server action + filterReached 擴充）
- [x] actions/attachments.ts（getAttachmentsByTempVoucherIds）
- [x] lib/sidebar-config.ts（fv-review-div / fv-review-group）
- [x] Playwright 實測：課處長／財務人員群組／我的審核紀錄三 Tab 皆正確渲染 9 欄、分帳戶區塊、週次篩選，無 runtime error

**付款分類全套＋財務付款憑單管理頁對齊筑今＋付款方式/費用項目欄位代號修正**（2026-07-14，Yumin）
分支：`feature/yumin-payment-category`（已合併 main）
說明（Yumin 拍板，規格見 BC 核心邏輯文件第十節）：
1. **付款分類**：支出欄位設定頁新增選項管理區塊（新增/改名/刪除、防重複；不做次帳戶）；付款憑單/沖銷憑單審核走到**審核群組步驟**（財務人員、第三處處長）時可選付款分類（課處長步驟不顯示），選值存 `approval_records.payment_category`（僅核准時寫入）；後面關卡預設承接前面最新選值、沖銷憑單預設帶母付款憑單最後選值；審核管理群組 Tab 與財務付款憑單管理頁顯示「付款分類」欄（最新選值）
2. **財務付款憑單管理頁對齊筑今**：狀態＋9 欄（重用 PaymentListCells、採購單號即連結）＋付款分類＋付款執行，拿掉查閱按鈕與申請人欄；批次確認付款與匯出報表列第二批
3. **欄位代號修正**：付款憑單表單「付款方式」曾掛 note、「費用項目」曾掛自訂代號 → 付款方式存不進結構化欄位（列表全「-」、詳細頁誤顯備註）；已修 dev 表單設定＋回填 12 張舊憑單，建立/草稿頁加 isPaymentMethodSlot label 備援解析防再犯
4. 審核紀錄存檔失敗改回傳中文訊息；核心邏輯文件更新（筑今 v3 三張單據關係／付款分類次帳戶、BC v8 第十節）
SQL：dev 已執行；**正式機兩筆待執行**（approval_records 加欄＝部署前必跑、表單欄位代號核對＋payment_method 回填），見 prod-pending-sql。E2E 實測（核准選值入庫/處長承接/列表欄/沖銷預設）與 staging Yumin 驗收通過。
注意：沖銷憑單要出現付款分類，沖銷範本需在審核流程設定加入財務群組步驟（現行 R&D 沖銷範本只有課長→財務長，無群組關）。

**角色管理清單手動拖曳排序**（2026-07-14，Riku）
分支：`feature/riku-role-sort`
說明：帳號管理→角色管理左側角色清單每張卡片加拖曳握把 `⠿`，可手動拖曳調整順序，放開即逐筆寫回 `system_roles.sort_order`（其他電腦重載同步），失敗顯示錯誤並還原；卡片點擊進編輯／刪除不受影響（拖曳只綁握把）。沿用出款帳戶拖曳樣式。`sort_order` 欄位已存在，未動資料庫。帳號列表 Tab 的角色下拉本就依 sort_order 排序自動同步。localhost 測試通過。

**暫付款沖銷憑單改版：多組明細繼承＋一單一沖銷＋核心邏輯文件重整 v7**（2026-07-14，Yumin）
分支：`feature/yumin-tempvoucher-groups`（已合併 main）
說明（Yumin 拍板）：
1. 沖銷表單「會計科目」移除；付款明細改為**多組**（同付款憑單整組重複），逐組繼承付款憑單的摘要用途／未稅金額／稅額／**總額**（總額預帶原組值＝最常見全額沖銷情境，皆可修改），沖銷金額＝各組總額加總（>0、≤原憑單實付）；`temp_vouchers.extra_data` 落地儲存（9-5 待補 2 結案）
2. **一張付款憑單只能建一張沖銷憑單**：草稿/審核中/已核准佔名額（付款憑單詳細頁按鈕改顯示既有沖銷單連結）、退回不算；後端存檔再擋（點名既有單號與狀態）
3. 核心邏輯文件重整 v7：第四節改為對齊後 9 欄現況、新增第五節沖銷憑單列表、舊五/六節併為第六節對齊狀態、第八節缺口盤點整併成「規則｜目前狀況」總表（15 條）、第九節總表更新且 9-5 三條待補全部結案
4. 順修：付款憑單詳細/審核頁「日期、職稱」顯示「-」的 label 回退缺漏（FundsPaymentDetail）
SQL 與表單設定：dev 與正式機皆已執行（含表單區塊 SQL 替換，正式機以唯讀查詢驗證生效）；本機 Playwright 實測（多組繼承/單號/一單一沖銷擋法/總額預帶）與 staging Yumin 驗收通過。

**審核管理「主管議會」Tab 改名為「執行長」**（2026-07-14，Riku）
分支：`feature/riku-rename-executive-tab`
說明：資金分配審核管理的「主管議會」Tab 改名「執行長」。程式端三處（`TAB_LABELS` 顯示、sidebar-config 權限勾選標籤、`page.tsx` 的 `GROUP_NAMES` 群組比對字串）＋資料庫 `approval_groups` 該筆同步改名（`GROUP_NAMES` 用名稱比對才撈得到群組）。審核流程範本以群組 ID 綁定不受影響；付款憑單群組 Tab 讀群組名稱自動跟著顯示「執行長」。SQL 已於 dev/staging 與正式機執行（2026-07-14，prod-pending-sql.md 已登記於已執行）。CLAUDE.md 相關描述同步更名。localhost 測試通過。

**憑單欄位帶入補強＋暫付款沖銷單號＋採購單號撞號修正**（2026-07-14，Yumin）
分支：`feature/yumin-voucher-serial-inherit`（已合併 main）
說明（Yumin 拍板）：
1. 付款憑單建立時「單據種類」「幣別」從申請單付款明細**第一組**帶入（可修改）
2. 暫付款沖銷憑單建立時自動帶入「採購單號」（＝原付款憑單採購單號，唯讀）與「申請日期」（＝建立當天，可改）
3. 新增**暫付款沖銷單號**（`temp_vouchers.serial_number`）：格式＝母付款憑單採購單號＋3 碼流水；我的列表／全部紀錄／審核管理／首頁分頁／CSV 匯出顯示單號欄（單號即連結），詳細/審核頁標題帶單號
4. 修正**付款憑單採購單號流水碼寫死 001 撞號 bug**：改為同母單最大流水碼 +1（`nextPurchaseOrderNumber`），既有撞號舊單以 SQL 依建單順序補正
5. 日期原則：資金分配申請日期維持只能選週三；付款憑單與沖銷憑單的日期改為**建立當天**（不再繼承母單申請日期；付款憑單審核管理週次篩選隨之依實際建單週分組）
影響範圍確認：全項完成（付款憑單建立/草稿頁、沖銷建立/詳細/審核頁、沖銷三列表＋首頁分頁＋CSV、核心邏輯文件第二/九節、CLAUDE.md）；SQL 已於 dev 與正式機執行（2026-07-14，prod-pending-sql.md 已移至已執行）；本機 Playwright 實測 8 項＋端對端建立沖銷單全數通過、staging Yumin 驗收通過。

**核心邏輯文件新增第九節「三張單據內頁欄位總表」**（2026-07-14，Yumin）
分支：無（純文件，直接在 main）
說明：`docs/core-logic/BC資金分配系統核心邏輯.md` 新增資金分配 × 付款憑單 × 暫付款沖銷三欄總表，涵蓋內頁全部欄位、必填標記、欄位繼承（帶入）關係；欄位依測試站實際表單設定與程式行為逐欄核對。盤點時發現三個待補事項（記錄於 9-5，尚未拍板）：①付款憑單「單據種類/幣別」不會從申請單帶入（欄位名稱與組層級對不上）②沖銷憑單五個欄位（採購單號/會計科目/摘要用途/未稅金額/稅額）填了不會存檔 ③沖銷憑單採購單號/申請日期不自動帶入。

**「憑證類型」全環境更名為「單據種類」（資料遷移，無程式碼變更）**（2026-07-14，Yumin）
分支：無（純 Supabase 資料修正，不經部署）
背景：財務反應「憑證類型」職員看不懂，先前只改了資金分配表單的欄位標籤，付款憑單表單沒跟著改，且改名前存的舊單資料 key 還是「憑證類型」，新標籤撈不到值導致顯示空白/名稱不一致。動態表單值以「欄位 label」為 key 存 `extra_data`、付款憑單帶入申請單也以 label 比對，故表單標籤與資料 key 必須一起改。
影響範圍確認（dev/staging 與正式機兩個 Supabase 專案皆已執行，受影響資料列已先備份）：
- [x] dev：`form_schemas` 付款憑單表單 label 更名；`funds_allocation` 22 筆＋`funds_payment` 9 筆 `extra_data` key 遷移，驗證零殘留
- [x] 正式機：同上；`funds_allocation` 3 筆＋`funds_payment` 1 筆，驗證零殘留
- [x] 暫付款沖銷憑單表單無此欄位，不受影響；`funds_allocation_templates` 無此 key，不受影響
- [x] `docs/prod-pending-sql.md` 已執行區的舊 SQL 含「憑證類型」僅為歷史紀錄，待執行區為空，無回滾風險
- [x] Playwright 實測 localhost（＝staging 同庫）：付款憑單詳細頁與資金分配編輯頁標籤顯示「單據種類」、舊單值（國內公司）正常帶出、全頁無「憑證類型」殘留

**金額防呆與限制補強（核心邏輯文件第八節，Yumin 已拍板）**（2026-07-14，Yumin）
分支：`feature/yumin-amount-guards`
規格：`docs/core-logic/BC資金分配系統核心邏輯.md` 第八節（缺口 1〜8；缺口 7 併發超額依拍板記錄不做）。大原則：畫面照擋、存檔時後端再驗一次當最後防線；擋下訊息一律白話三段式（發生什麼→為什麼→怎麼做），且點名到具體（日期/建單人名字（本人寫「你自己」）/憑單名/採購單號/金額）。Server Action 的預期錯誤依 Next.js 文件改用回傳值 `{ error }` 帶回（正式環境 throw 訊息會被遮蔽），`submitApprovalDecision` 回傳型別改 `{ error: string | null }`、五個呼叫端全部接住。
影響範圍確認：
- [x] `submitApprovalDecision` 存檔驗證：核准金額必須 >0（0 元請按不核准，缺口5）、資金分配不可高於承接上限（上一關核准金額/申請金額，缺口1）、下修不可低於底下憑單已佔用總額（缺口3，逐張點名式訊息）、付款憑單上限＝剩餘＋本張佔用
- [x] 呼叫端接錯誤：資金分配審核頁＋付款憑單審核頁、暫付款審核頁、ReviewPageClient 快速核准/批次核准（逐張列出被擋單號與原因）
- [x] **全站共用「操作被擋」中央彈窗 `_components/ErrorDialog.tsx`**（Yumin 驗收時指定：長表單送出按鈕在底部、頁頂紅字看不到＝等於沒做；拍板中央彈窗、按「我知道了」關閉、支援多行 pre-line）：已套用資金分配新增/編輯表單（feeValidation 錯誤，移除 scrollTo hack）、三個審核頁、審核列表快速/批次核准（原生 alert 全數移除）、付款憑單建立/草稿頁、沖銷憑單建立頁；Playwright 實測 4/4（底部按建立當場見彈窗、我知道了關閉、審核 0 元、多行點名訊息完整顯示）
- [x] `createPayment`/`updateDraftPayment`：金額必須 >0（草稿也擋）；**超額訊息升級點名式**（Yumin 驗收時指定）——顯示核准金額＋逐張列出佔用中憑單（日期/建單人（本人寫「你自己」）/憑單名/採購單號/狀態（草稿/審核中/已核准待付款/已付款）/各佔多少）＋合計與這次最多能填多少；點名清單抽共用工具 `lib/occupiedVoucherLines.ts`（`buildOccupiedVoucherSummary`，server-only），缺口 3 訊息與付款憑單審核超額訊息同套；建立/草稿頁前端原本的簡略超額快速檢查移除，改由伺服器回詳細訊息
- [x] `createTempVoucher`：沖銷金額必須 >0 且 ≤ 原預支憑單實際付款金額；**附帶修正既有 bug**——表單金額欄（自訂欄位「總額」）fieldId 對不到結構化 `amount`，舊沖銷憑單金額一律存 null，改為後端依表單設定以 label「總額」對應存入；建立頁送出被擋時保留表單顯示行內錯誤（原本任何錯誤都整頁換成錯誤畫面丟失表單）
- [x] `lib/feeValidation.ts`：付款憑單總額不可低於未稅＋稅額合計（等於放行；直接填總額、未稅稅額 0 不受影響）
- [x] EditFundsForm：母單剩餘 ≤0 即隱藏「建立付款憑單」按鈕（缺口8，對齊筑今；含審核頁嵌入情境，存檔超額檢查照舊當最後防線）
- [x] **超額點名訊息排版改版**（Yumin 驗收時指定）：段落間空行、首尾重點句粗體；佔用清單每行改「佔用金額在前、採購單號＋狀態收行尾括號」，採購單號為超連結連到憑單詳細頁（開新分頁）；ErrorDialog 支援 `**粗體**`／`[文字](路徑)` 輕量標記渲染，純文字訊息不受影響；三處訊息（憑單建立與草稿超額／缺口3下修／憑單審核核准超額）同套格式
實測（Playwright + 單元測試，2026-07-14）：審核頁核准 0 元/上調 9500（上限 9000）/下修 2000（佔用 3000）三情境全部擋下、點名式訊息完整（日期＋黃耀輝＋採購單號＋金額）、DB 無寫入無審核紀錄；繞過前端 required 驗證直接送出金額 0 憑單被伺服器擋下、DB 乾淨；剩餘 10000 顯示建立按鈕、插單佔滿後按鈕消失；feeValidation 6/6 單元案例通過；沖銷憑單 0 元/99999（>5000）擋下、合法 1000 成功建立且 amount 確實存入；測試資料全數清除。無資料庫結構變更、無正式機待執行 SQL。

**付款憑單列表欄位對齊筑今（舊系統，一般列表＋審核管理）＋核心邏輯文件**（2026-07-14，Yumin）
分支：`feature/yumin-remaining-amount`
三個「一般列表」＋付款憑單審核管理頁全部 Tab 的欄位改為對齊筑今（bci-financial.com）的 9 欄：狀態｜採購單號｜費用項目｜項目｜付款對象｜付款方式｜核准金額｜實際付款金額｜發票憑證，拿掉舊的「檢視／查閱／審核」按鈕（採購單號本身即連結；審核管理頁採購單號連到審核頁 `/funds-payment/review/check`，待審核的單點單號即可進審核）。核准金額未核准顯「-」；實際付款金額只有「已付款」顯示（＝核准金額）否則「-」；發票憑證列出該憑單附件、顯示使用者上傳原始檔名、一檔一行、可點預覽。新增共用元件 `funds-payment/_components/PaymentListCells.tsx`（狀態後 8 欄、可帶 `hrefBase` 切換採購單號連結目標、接受精簡型別 `PaymentListRow`，一般列表/審核管理共用避免不一致）與批次撈附件 `getAttachmentsByPaymentIds`。另新增核心邏輯文件於 `docs/core-logic/`：《筑今系統邏輯_列表欄位（參考基準）》與《BC資金分配系統核心邏輯》（白話、非技術人員可讀，記錄兩張列表欄位邏輯、單號規則、核准金額承接、剩餘金額、實際付款金額認列，皆與 Yumin 確認）。
影響範圍確認：
- [x] /funds-payment/my-payment（我的付款憑單）
- [x] /funds-payment/all（全部付款紀錄）
- [x] / 首頁「我的申請紀錄 → 付款憑單申請單」分頁（HomeTabView）
- [x] /funds-payment/review 審核管理全部 Tab（課、處長審核／財務人員／第三處處長等群組 Tab／我的審核紀錄）—— 統一 9 欄，`AccountGroupedList` 與 `HistoryList` 共用 `PaymentListCells`
- [ ] 財務付款憑單管理頁（/finance/payment）欄位對齊筑今（採購單號／付款對象／核准金額／實際付款金額／發票憑證）＋「付款分類」欄＋批次確認付款＋匯出報表 —— **第二批待做**（2026-07-14 已核對筑今截圖：「付款執行」＝確認付款按鈕那一欄，新系統此頁已有，非缺項；見 BC 核心邏輯文件第六節、第十節）
實測（Yumin，localhost:3000，2026-07-14）：一般三頁＋審核管理四個 Tab 欄位順序正確、發票憑證原始檔名一行一個可點開、實際付款金額僅已付款筆顯示數字、審核頁採購單號進得去。

**資金分配剩餘金額與付款憑單核心邏輯**（2026-07-13，Yumin）
分支：`feature/yumin-remaining-amount`
對齊舊系統（bci-financial.com）完整邏輯：資金分配單核准後可在不同時間點分批建立多張付款憑單各自扣款，剩餘金額（＝核准金額−所有相關憑單佔用金額，即時計算不落地）在列表與付款憑單頁即時顯示，剩餘金額歸零時（財務確認付款）資金分配單自動轉為新增的 `paid`「已付款」狀態；同張分配單建立多張憑單時金額加總不可超過核准金額（前後端皆擋）。釐清過程見 `docs/core-logic/`（業務邏輯總結與缺口比對，皆與 Yumin 確認）。共用計算純函式 `lib/fundsAllocationRemaining.ts`，查詢/結案 server action 在 `actions/fund-budget.ts`（`getAllocationRemainingInfo`、`recalcAllocationCloseStatus`）。
影響範圍確認：
- [x] `funds_payment` 新增 `approved_amount` 欄位；審核頁可填/改核准金額（承接上一步，上限＝剩餘＋本張佔用）
- [x] 建立/草稿編輯付款憑單存檔改採用實填總額（`createPayment`/`updateDraftPayment` 加 `amount` 參數），「總額」欄位開放手動輸入（`manualTotalKeys` 旗標，改過就不再被費用/稅額自動覆寫）
- [x] 建立/儲存付款憑單時同分配單憑單金額加總防呆（`checkAmountWithinRemaining`，排除自己）
- [x] `funds_allocation` 新增 `FUNDS_STATUS.PAID`，`confirmPayment` 觸發 `recalcAllocationCloseStatus` 歸零轉入
- [x] 全站判斷 `status === 'approved'` 逐一檢查（`fund-budget.ts` 週預算 `.in()` 加 paid、三列表 stepName/剩餘顯示、EditFundsForm/review 文案、ExportCsvButton 篩選+標籤、`status-label-config` 加 paid 標籤列）
- [x] 「建立付款憑單」「審核付款憑單」「草稿編輯頁」補上「已核准資金分配申請單」對照卡片（核准金額／剩餘／本次填寫即時試算）
- [x] 首頁 / my-funds / all 三列表「剩餘金額」即時計算顯示（server 端 join `funds_payment` 算好傳入）
- [x] 狀態標籤設定頁資金分配模組自動出現「已付款」可設定列（讀 `DEFAULT_STATUS_LABEL_CONFIG`）
- [x] 付款憑單付款明細數字欄改回舊系統「未稅金額／稅額／總額」（移除手續費、新增純手動填的總額、三欄用全新 fieldId 與資金分配脫鉤、建立時金額欄不從申請單帶入、`amount`＝各組總額加總、`feeValidation` 改檢查總額>0；只改付款憑單）：dev/staging 已用 service role 改 `form_schemas` block_pay_2，正式機表單設定步驟登記在 `docs/prod-pending-sql.md`。改動檔：`add/[id]/page.tsx`、`[id]/page.tsx`、`FundsPaymentDetail.tsx`、`lib/feeValidation.ts`
- [x] 頂部「已核准資金分配申請單」對照卡片擴充成舊系統完整母單摘要列（單號/處別/課別/日期/申請人/職稱/幣別/機構/出款帳戶/費用項目/項目＋核准/剩餘金額，落差3）：新增共用元件 `_components/AllocationSummaryCard.tsx`，`getAllocationRemainingInfo` 回傳型別擴充為 `AllocationRemainingInfo`（含母單 `summary`），建立/草稿/審核三頁改用同一元件，Playwright 截圖確認 13 欄齊全排版正常
- [x] 修正既有 bug：審核管理群組 Tab 的「審核」按鈕沒檢查群組成員（列表顯示可審、進審核頁卻被 `checkCanReviewStep` 擋）。`getPaymentsForApprovalGroupByWeek`／`getAllocationsForApprovalGroupByWeek` 加傳 `userId`，`is_pending_here` 併入群組成員判斷；非成員顯示「查閱」、badge 不計入。付款憑單＋資金分配（諮詢議會/主管議會/財務長）兩模組都修。Playwright 實測：非成員 Yumin 看到「查閱」、群組成員王亞瑜看到「審核」+badge1
實測（Playwright，2026-07-13）：建 2 張憑單 2000+1000＝核准 3000 → 超額第 3 張被擋（剩餘 NT$1,000 錯誤）→ 逐張確認付款 → 分配單自動轉「已付款」、剩餘 0；部分付款情境（10000 核准、2 付 1 待）分配單維持「已核准」、剩餘正確 4000；審核頁對照卡片＋核准金額輸入框（承接 1000、上限 6000 超額被擋）皆正確。付款明細改版實測：分配單 #42（核准 5750）建憑單填 2 組總額 2298+566、未稅/稅額留 0 → 送出未被「必須大於 0」擋、`amount` 存入 2864、彙總顯示「未稅金額 0／稅額 0／總額 2,864」、剩餘 2886，測試資料已清除。
備註：需在正式機執行兩段 SQL（見 `docs/prod-pending-sql.md`）——`funds_payment` 加 `approved_amount` 欄位、放寬 `funds_allocation_status_check` 約束允許 `paid`（此約束未曾記錄在專案 migration，實測時才發現是當初直接在 Supabase Dashboard 手動加的，dev/staging 已補跑）。

**資金分配審核管理：欄位顯示 + 快速核准按鈕改上下排列**（2026-07-14，Riku）
分支：`feature/riku-review-columns`
審核管理頁（課處長／諮詢議會／主管議會／財務長 Tab）右上角新增「欄位」按鈕，可自由開關欄位（狀態/單號/申請處別/申請課別/申請人/職務/申請金額/核准金額/剩餘金額/費用項目/項目），快速審核/審核/查閱動作欄固定顯示不列入；預設收起處別/課別/剩餘金額，讓核准鈕更容易落在畫面內、減少往右滑；每個 Tab 各記各的（localStorage）。快速核准／不核准按鈕改為上下排列（不核准在上、核准在下）、以 `items-stretch` 撐成等寬。
影響範圍確認（共用 hook `useColumnVisibility` 加選填 `defaultKeys` 參數，向下相容）：
- [x] `src/app/_components/useColumnVisibility.ts`（新增 defaultKeys、切換 Tab 回預設值）
- [x] `HomeTabView` / `MyFundsTableView` / `AllFundsTableView`（仍傳兩參數，行為不變，typecheck 綠）
- [x] `funds-allocation/review/ReviewPageClient.tsx`（欄位顯示 + 按鈕 UI）

**付款憑單「受款人」資料來源合併付款對象類別**（2026-07-13，Yumin）
分支：`feature/yumin-payee-merge-source`
表單設定「資料來源」下拉新增「全部付款對象（合併）」選項（`payee_records:all`，`actions/form-schema.ts` 的 `getFormDataSources()` 動態附加，只要 `payee_categories` 有資料就會出現），選這個欄位會合併目前所有付款對象類別（不寫死類別數量，未來新增類別自動一起併入）供搜尋/選取。付款憑單表單「受款人」欄位已改選此選項，實測搜尋同時涵蓋國內廠商（賀伯特行政管理有限公司）與職員（謝靜弦），選取廠商後正確自動帶入對應欄位值。
影響範圍確認：
- [x] `actions/form-schema.ts`（`getFormDataSources()` 新增合併選項）
- [x] `funds-payment/my-payment/add/[id]/page.tsx`（建立頁：`payee_records:all` 特例抓取全部類別欄位+資料並合併，Playwright 實測搜尋/選取/自動帶入）
- [x] `funds-payment/my-payment/[id]/page.tsx`（草稿編輯頁：`payee_records:all` 特例，autoFillLabels 與 fetch 迴圈皆處理）
- [x] `funds-payment/my-payment/page.tsx`、`/all`、`/review`（僅用 `.find()` 找欄位標籤，`payee_records:` 前綴不受影響，無需改動）
- [x] 資金分配申請單、暫付款沖銷憑單、範本管理頁本次未使用此欄位，不受影響
備註：目前僅套用於付款憑單表單的「受款人」欄位（使用者本次需求範圍）；dev/staging 與正式機表單設定皆已透過畫面操作存檔套用（Yumin 2026-07-13 確認正式機已完成設定）。

**表單欄位預設值機制**（2026-07-13，Yumin）
分支：`feature/yumin-form-default-values`
FormSlot 型別新增 `defaultValue`（文字/選項預設值）與 `dateDefaultMode`（'fixed' | 'nearest_cycle'，僅 date 類型）；表單設定頁欄位設定面板新增「預設值」設定（date 類型可選固定日期或自動選最近可用日期，其餘類型為文字輸入，輸入選項的顯示文字即可設為預設選中）；資金分配申請新增頁（AddFundsForm）讀取套用，僅在全新表單（未選範本/草稿）時生效，避免蓋掉範本既有資料。首次套用：申請日期預設最近可用週次日期、機構預設 BIZ、幣別預設台幣。另外新增「申請處別」依使用者組織架構身分自動帶入（依組織樹順序取第一個所屬處別，課別/職務不自動帶入，維持使用者自行選擇；此為 AddFundsForm 內寫死邏輯，非表單設定頁可調整項目）；「職務」下拉選項文字改為「組織單位 + 職稱」（如「第7課 收入課 課長」），改讀 `org_unit_members.role_type_id` 對照 `role_types.name`，無職稱的舊資料維持只顯示單位名稱。
影響範圍確認：
- [x] `src/lib/types.ts`（FormSlot 型別新增欄位，三種表單類型共用資料結構）
- [x] `src/app/system-settings/form-settings/_client.tsx`（右側欄位設定面板新增「預設值」設定，資金分配申請單/付款憑單/暫付款沖銷憑單三個 Tab 都會看到這個設定選項）
- [x] `src/lib/dateUtils.ts`（新增 `computeNearestAllowedDate` 最近可用日期計算函式）
- [x] `src/lib/orgPositions.ts`（`unitsInTreeOrder`、`nearestDivisionId` 改為 export 供 AddFundsForm 共用）
- [x] `src/app/funds-allocation/my-funds/add/_components/AddFundsForm.tsx`（讀取 defaultValue 套用＋申請處別/職務標籤邏輯，Playwright 驗證：申請日期/機構/幣別/申請處別皆正確帶入，職務下拉正確顯示「單位+職稱」且選取後仍正確連動處別/課別，且既有範本載入不受影響）
- 備註：EditFundsForm（編輯頁）與付款憑單/暫付款沖銷憑單建立頁本次不同步調整，僅資金分配申請新增頁生效
- 附帶修復（測試時發現的獨立舊問題）：表單設定「範本管理」頁的「職務」欄位選不到任何選項（顯示「無符合選項」），原因是資料來源 `org_unit_roles` 這張表自 2026-06-18「審核流程 Phase 2」移除「＋新增職位」按鈕後就完全沒有資料寫入、一直是空表；改為讀取 `org_unit_members`（實際指派負責人）＋ `role_types` 對照，標籤格式與 AddFundsForm 統一為「單位＋職稱」；`_template-tab.tsx`
- 備註：付款憑單／暫付款沖銷憑單建立頁本次不接上讀取邏輯（機制先建立，之後有需求再串接）

**審核管理 Tab 依流程進度顯示＋群組已核准總額修正**（2026-07-12，Riku）
分支：`feature/riku-review-flow`
審核管理各 Tab 改為「單子已走到該 Tab 對應步驟」才顯示：待審核看目前步驟、已核准（含已付款）視為走完全部步驟、被退回的看審核紀錄實際走到過的最大步驟（退回後目前步驟會清空）、草稿一律不顯示；還在課長/處長階段的單不再提前出現在諮詢議會/主管議會/財務長 Tab，處長也不會提前看到課長階段的單，審過的單照舊停留在對應 Tab。群組 Tab 標頭「已核准總額」改為只加總「該群組步驟實際按過核准」的審核紀錄核准金額（到達但尚未核准不列入、被退回視為釋回），並依所選週次（申請日期）過濾，不再全週次累計（`actions/fund-budget.ts` 的 `getGroupApprovedTotals`）。
影響範圍確認（Riku localhost 實測 OK）：
- [x] /funds-allocation/review（課、處長審核 / 諮詢議會 / 主管議會 / 財務長 Tab：到達該步驟才顯示）
- [x] /funds-allocation/review 群組 Tab 標頭（已核准總額改抓該群組實際核准的審核紀錄金額、依週次過濾）
- [x] /funds-payment/review（課、處長審核 / 動態群組 Tab：共用同套到達過濾，`actions/approval-flow.ts` 的 `hasReachedStep` / `filterReached`）

**核准金額逐步承接＋群組 Tab 已核准總額改抓核准金額**（2026-07-12，Riku）
分支：`feature/riku-approved-amount-cascade`
審核頁核准金額預填改為「承接上一步最新核准金額，第一步才帶申請金額」（申請 10000、課長核 9000，處長進審核頁自動帶 9000，依此類推；核准時金額會寫回申請單，故直接讀申請單的核准金額即可）。附帶修正：審核管理列表的快速核准／批次核准原本完全沒帶核准金額（核准金額欄一直是「-」），補上同樣的承接邏輯。諮詢議會／主管議會／財務長 Tab 帳戶標頭「已核准總額」改為只加總核准金額欄位（無核准金額的單子計 0，不再退回用申請金額灌入），沒人核准過時預設顯示 0 元，「剩餘可分配金額」隨之正確。
影響範圍確認（Riku localhost 實測 OK）：
- [x] /funds-allocation/review/check/[id]（核准金額預填承接最新核准金額）
- [x] /funds-allocation/review 快速審核／批次核准（補帶核准金額）
- [x] /funds-allocation/review 諮詢議會／主管議會／財務長 Tab「已核准總額」（只加總核准金額，`actions/fund-budget.ts`）
備註：過去用快速審核核准、沒留下核准金額的舊單子，在新算法下計 0（與列表核准金額欄顯示「-」一致）。

**修復申請單單號撞號導致送出失敗**（2026-07-12，Riku）
分支：`feature/riku-serial-number-fix`
申請單單號原以「當天已有幾筆 +1」產生流水號，只要當天有單被刪除產生跳號，算出的號碼就會撞到現存單號（單號有唯一性限制），送出被擋且該日期永遠卡死（實例：staging 的 2026-07-15 有 11 筆但 001/002/011 已刪，每次都算出已存在的 012）。改為「抓當天最大單號尾碼 +1」，跳號不再影響；新增送出與草稿轉送出共用同一產號函式，一處修正兩邊生效（`actions/funds-allocation.ts` 的 `generateSerialNumber`）。

**費用必須大於 0 才可送出＋數字欄位滾輪防誤觸、隱藏上下箭頭**（2026-07-12，Riku）
分支：`feature/riku-fee-input-rules`
兩項輸入邏輯調整：(1) 付款明細每一組的「費用」（稅額計算基底欄位）必須大於 0 才可送出，0 或負數擋下並顯示「『付款明細』第 N 組的『費用』必須大於 0」紅字（自動捲到頁頂），共用驗證函式 `lib/feeValidation.ts`；套用於申請單新增/編輯「確定送出」、編輯「儲存變更」（已送出單子被修改也擋）、付款憑單詳細頁「確定送出」；儲存草稿不擋（付款憑單「建立」實為存草稿，故擋在送審那步）。(2) 全站數字欄位防誤觸：Mac 觸控板/滑鼠滾輪在數字欄位內滑動會誤改數值，共用 Input 元件改為滾輪時先失焦（頁面照常捲動、數值不變），審核頁「核准金額」獨立輸入框一併處理；全域 CSS 隱藏所有數字欄位上下箭頭。
影響範圍確認（Playwright 實測 + Riku localhost 測試 OK）：
- [x] 共用 Input 元件（全站數字欄位：滾輪滑動先失焦不改值）
- [x] globals.css（全站 number input 隱藏上下箭頭）
- [x] /funds-allocation/my-funds/add（確定送出擋費用 ≤ 0，共用驗證函式）
- [x] /funds-allocation/my-funds/edit/[id]（費用 0/-1 擋下訊息正確、狀態維持草稿；5000 正常送出轉送審中，Playwright 實測）
- [x] /funds-payment/my-payment/[id]（確定送出擋；儲存草稿不擋）
- [x] /funds-allocation/review/check/[id]（核准金額輸入框滾輪失焦）
備註：驗證時發現長時間運行的 dev server（Turbopack 持久快取）會吃不到 globals.css 變更，清 `.next` 重啟即解。

**申請處別/課別開放自由選擇＋無負責人提示**（2026-07-12，Riku）
分支：`feature/riku-org-free-select`
申請單「申請處別/課別」下拉改為列出全部標記處別/課別的節點，不再限縮於使用者所屬組合（高層職務申請時原本推不出課別、下拉空白沒得選）；課別歸屬改依「往上最近的處別祖先」認定，支援深層節點（處→中間節點→課，`lib/orgPositions.ts` 的 `allSectionOptions`，表單設定範本 Tab 同函式一併受惠）；選「職務」自動帶入處/課的行為保留，帶入後仍可自由改選。另新增提醒：選到沒有「已綁定帳號負責人」的處/課時，欄位下方顯示橘色提示文字（審核步驟可能無人可簽核，請聯絡管理員設定負責人），只提示不擋送出（是否需要該節點簽核取決於出款帳戶對應的流程範本，硬擋會誤傷）。
影響範圍確認（Riku localhost 實測 OK）：
- [x] /funds-allocation/my-funds/add（含範本編輯模式，全部選項＋自動帶入＋無負責人提示）
- [x] /funds-allocation/my-funds/edit/[id]（含審核頁嵌入編輯情境，既有單子節點不在清單仍補進選項的防呆保留）
- [x] lib/orgPositions.ts `allSectionOptions` 其他使用點確認（form-settings 範本 Tab，深層課別修正一併生效）

**費用項目主要／細項連動篩選**（2026-07-11，Riku）
分支：`feature/riku-fee-cascade`
申請單新增/編輯頁：選了「費用項目（主要）」後，「費用項目（細項）」下拉只顯示編號開頭相同的選項（如主要選 1.1，細項只列 1.1 開頭，依選項標籤第一個空白前的編號比對，`lib/feeItems.ts`）；主要未選時細項無選項、placeholder 提示「請先選擇費用項目（主要）」；改選主要時自動清空編號對不上的已選細項（固定欄位與群組明細都清）。連動約定：label 含「費用項目」的費用項目資料欄位（主要＝群組列外第一個、細項＝其餘），label 改名或編號不照規則即自動退回不過濾，費用類型設定新增項目不用改程式。主要值不在選項清單中（既有 amount 欄位代號問題產生的異常值）時退回顯示全部選項防鎖死。
影響範圍確認（Playwright 實測 11/11 通過，Riku 帳號）：
- [x] /funds-allocation/my-funds/add（未選主要無選項＋提示、選 1.1/1.2 過濾正確、改主要自動清空）
- [x] /funds-allocation/my-funds/edit/[id]（草稿還原細項值正確、主要異常值退回全部選項、改主要清空＋重新過濾）
- [x] 其他 fee_records 下拉（幣別）不受影響（label 不含「費用項目」不觸發連動）
- [x] 付款憑單頁面不在此次範圍（使用者確認只做申請單）

**資金分配申請類型選擇邏輯調整：改到付款憑單階段才選**（2026-07-11，Riku）
分支：`feature/riku-payment-category`
「類型（一般/預支）」欄位從資金分配申請移除（`getFormSchemas` 讀取時過濾，Supabase 舊 schema 不用改即生效；表單設定欄位目錄同步移除），改為建立付款憑單時選擇：建立頁/草稿頁以「預支（需事後沖銷）」單一勾選框呈現（勾＝預支、不勾＝一般，預設不勾、舊申請單有值則帶入），值仍存一般/預支到 `funds_payment.category` 結構化欄位（不重複存動態欄位資料），送審後鎖定唯讀。表單設定付款憑單 Tab 欄位目錄新增「類型」可放置。`createTempVoucher` 補上「來源憑單必須已付款＋預支」後端驗證（原本只擋畫面按鈕）。無資料庫結構變更；正式機部署後需確認付款憑單表單設定有「類型」欄位。
影響範圍確認（Playwright 實測，Riku/Yumin 帳號）：
- [x] /funds-allocation/my-funds/add、edit（類型欄位不再渲染，舊單既有值保留不被清除）
- [x] /system-settings/form-settings 資金分配申請 Tab（畫布與欄位目錄皆無類型）
- [x] /system-settings/form-settings 付款憑單 Tab（畫布保留類型列、欄位目錄可選類型）
- [x] /funds-payment/my-payment/add/[id]（「預支」勾選框預設不勾，勾選建立後 DB 寫入正確）
- [x] /funds-payment/my-payment/[id]（草稿可改並儲存、送審後唯讀走 FundsPaymentDetail、預支+已付款顯示沖銷按鈕邏輯不變）
- [x] /funds-payment/review/check/[id]（共用 FundsPaymentDetail，類型以 label 回退顯示結構化欄位值）
- [x] 暫付款沖銷建立動作後端驗證（實測繞過按鈕直接送出被擋、零筆寫入）
- [x] CSV 匯出（匯出欄位不含類型，不受影響）

**已送出申請單另存為個人範本**（2026-07-11，Riku）
分支：`feature/riku-template-from-record`
回應使用者回饋「按按按就送出了，回不去存範本，還要重新建立一次」：申請單編輯/詳細頁（任何狀態：送審中/已核准/已退回/草稿）底部按鈕列新增「另存為我的範本」，點擊後輸入名稱即存為個人範本。僅申請人本人可見（含申請人剛好是目前審核步驟負責人的自審情境）；審核頁情境（審核頁嵌入或由審核頁進入編輯）不顯示。實作上重用編輯頁已把申請單資料還原成表單狀態的既有邏輯，照 AddFundsForm 的範本格式組資料（欄位代號 key、處別/課別存組織節點 id、可重複列與群組明細存 JSON），申請日期與單號不帶入範本。
影響範圍確認（Playwright 實測，登入 Riku 帳號）：
- [x] /funds-allocation/my-funds/edit/[id]（送審中單子按鈕出現、存檔成功顯示 ✓ 提示；空名稱時確認鈕反灰）
- [x] /funds-allocation/my-funds/edit/[id]（開他人單子按鈕隱藏）
- [x] /funds-allocation/review/check/[id]（嵌入同元件，hideApprovalPanel 情境不顯示按鈕）
- [x] 範本套用驗證：/funds-allocation/my-funds/add?templateId= 帶入處別/課別/機構/出款帳戶/項目與兩組付款明細（含稅額），申請日期為空、單號待自動產生
- [x] 資料庫格式驗證：field_values 為欄位代號 key、無 date/serial_number

**「我的」三個列表頁週次篩選＋我的申請紀錄排版調整**（2026-07-11，Riku）
分支：`feature/riku-week-picker-lists`
審核管理頁的週次選擇器概念複製到「我的申請紀錄」「我的付款憑單」「我的暫付款沖銷憑單」：新增共用 `WeekFilterBar` 元件＋`useWeekFilter` hook（前端過濾，預設當週，依申請日期比對、草稿無日期時退回建立日期換算台北時區）；共用 `WeekDropdown` 新增可選 `allowAll` 屬性（「全部週次」選項固定於下拉頂部），預設關閉、審核管理頁行為不變。我的申請紀錄排版調整：標題列只留「選取範本／＋新增申請單」，下方新增工具列（左：年份＋週次；右：搜尋框＋欄位按鈕）；另外兩頁同結構（左：週次；右：搜尋框）。週次篩選下空清單顯示「此週次尚無…，可切換『全部週次』查看」提示。
影響範圍確認（`WeekDropdown` 共用元件改動已 grep 全部 4 個使用點）：
- [x] /funds-allocation/my-funds（新排版＋週次篩選，Playwright 實測）
- [x] /funds-payment/my-payment（週次篩選，Playwright 實測）
- [x] /funds-voucher/my-voucher（週次篩選＋無日期退回建立日期，Playwright 實測）
- [x] /funds-allocation/review、/funds-payment/review、/finance/funds（既有使用點無「全部週次」選項、行為不變，Playwright 實測審核管理頁）

**按鈕排版調整＋個人範本編輯功能**（2026-07-11，Riku）
分支：直接在 `staging` 進行
四項 UI 調整：(1) 新增申請單底部按鈕改為左「另存為我的範本/儲存草稿」、右靠邊「取消/確定送出」；(2) 選取範本 Modal 我的範本按鈕改為「編輯｜改名｜套用」，刪除按鈕移除，「編輯」進入申請單表單頁（`?editTemplateId=`）編輯範本欄位值，底部為「刪除範本（左，紅字含確認）/取消/儲存範本（右）」，新增後端動作更新個人範本欄位值（僅限擁有者）；(3) 審核頁/編輯頁按鈕改為左「儲存草稿/建立付款憑單」、右靠邊「返回（取消）/儲存變更（確定送出）」，按鈕列與審核進度卡片間距拉開與表單卡片一致；(4) 移除首頁與我的申請紀錄列表最右側「檢視 / 編輯」欄（單號欄可點）。
影響範圍確認：
- [x] /funds-allocation/my-funds/add（底部按鈕、範本編輯模式）
- [x] /funds-allocation/my-funds 選取範本 Modal
- [x] /funds-allocation/my-funds/edit/[id] 與 /funds-allocation/review/check/[id]（共用同一按鈕列）
- [x] / 首頁與 /funds-allocation/my-funds 列表（移除檢視/編輯欄）

**共用範本適用組織範圍**（2026-07-11，Riku）
分支：`feature/riku-template-scope`
共用範本建立/編輯時強制指定適用組織範圍：底部按鈕列「適用組織範圍」按鈕（顯示已選節點數）開 Modal 勾選組織樹，任意層級可複選，勾上層節點即涵蓋整個分支（子孫顯示「已由上層涵蓋」）。選取範本 Modal 與網址帶範本編號套用皆只允許範圍涵蓋使用者的範本（依使用者在組織架構的指派節點，往上回溯是否命中所勾節點，`isUserCoveredByUnits`）。舊範本未設定範圍者對一般使用者隱藏，管理頁卡片顯示紅字提醒補設定。資料表新增適用組織節點欄位（SQL 已登記 `docs/prod-pending-sql.md`，正式機部署前需執行）。
影響範圍確認：
- [x] /system-settings/form-settings 範本管理 Tab（範圍按鈕 + Modal 勾選樹、卡片顯示適用範圍）
- [x] /funds-allocation/my-funds 選取範本 Modal（共用範本依範圍過濾，`getVisibleSharedFundTemplates`）
- [x] /funds-allocation/my-funds/add?templateId=（`getFundTemplateById` 後端檢查範圍防繞過）
- [x] 資料表：共用範本新增適用組織節點欄位（dev/staging 已執行）

**付款憑單審核管理 Tab 分類（比照資金分配審核管理）**（2026-07-10，Yumin）
分支：`feature/yumin-payment-review-tabs`
`/funds-payment/review` 從「待我審核/我的審核紀錄」改為「課、處長審核＋動態群組 Tab＋我的審核紀錄」：群組 Tab 依啟用中付款憑單範本實際使用的審核群組動態產生（範本改用其他群組時 Tab 自動跟著變，不用改程式）；週次篩選（年份＋週次下拉，依 `date` 過濾顯示該週全部狀態，badge 只計仍在此步驟待審筆數）；各 Tab 依出款帳戶分區塊；頁面重構為 server component（`page.tsx`）＋`PaymentReviewClient.tsx`。新增權限 ID `fp-review-div`（課、處長審核 Tab）、`fp-review-group`（群組 Tab），需在帳號管理為各角色勾選才看得到（管理員不受限）。金額彙總（已核准總額/剩餘可分配）與快速/批次審核本次不做。
影響範圍確認：
- [x] /funds-payment/review（頁面重寫，本機以 user 1 session 實測渲染：三 Tab、帳戶分區、審核/查閱按鈕正確）
- [x] `approval-flow.ts` 新增 `getPaymentsForOrgRoleByWeek` / `getPaymentsForApprovalGroupByWeek` / `getPaymentVoucherReviewGroups`（is_pending_here 直接判斷目前步驟，支援同範本多步驟用同一群組）
- [x] `sidebar-config.ts` 新增 fp-review-div / fp-review-group 權限項目
- [x] 帳號管理權限勾選 UI（由 DEFAULT_SIDEBAR_CONFIG 自動帶出子項）

**付款憑單/暫付款沖銷憑單審核人解析修正：org_role 步驟接上處別/課別**（2026-07-10，Yumin）
分支：`feature/yumin-payment-review-orgcontext`
問題：付款憑單與暫付款沖銷憑單的審核比對（待我審核清單、審核頁、通知）呼叫 `stepMatchesReviewer`/`checkCanReviewStep` 時未傳處別/課別 orgContext，且憑單資料表沒有 `apply_division_id`/`apply_section_id` 欄位，導致範本步驟為「課長/處長審核」（org_role + section/division）時永遠無人可審；另範本查詢用 `maybeSingle()` 遇多筆綁定會回錯誤且被靜默忽略，導致 `flow_template_id` 存成 null、憑單卡死無人可審。修法：不加欄位，一律回溯關聯的資金分配申請單取得處別/課別（新共用函式 `getAllocationOrgContext`；清單查詢用 PostgREST 巢狀 embed）；範本查詢改 `.limit(1)` 並記錄錯誤。
影響範圍確認：
- [x] `getPendingPaymentsForReviewer`（付款憑單待我審核清單，join 申請單 org ids）
- [x] `getPendingVouchersForReviewer`（暫付款沖銷待我審核清單，雙層 join）
- [x] /funds-payment/review/check/[id]（審核頁 canReview 判斷 + steps select 補 org_unit_type）
- [x] /funds-voucher/review/check/[id]（審核頁 canReview 判斷 + steps select 補 org_unit_type）
- [x] `submitApprovalDecision` 通知下一步審核人（付款憑單/暫付款沖銷分支）
- [x] `submitMyPayment` / `submitTempVoucher` 送審通知第一步審核人
- [x] `createPayment` / `submitMyPayment` / `createTempVoucher` / `submitTempVoucher` 範本查詢 maybeSingle 靜默失敗修正
- [ ] staging 資料修復：funds_payment #2 補 `flow_template_id = 2`（SQL 待使用者在 Supabase 執行）

**品牌 UI 全面調整：元件尺寸統一、側邊欄/header 改版、表單橫式排版**（2026-07-10，Yumin）
分支：`feature/yumin-ui-polish`（基於 staging 品牌新樣式，參考 docs/brand-guidelines 與 Claude Design 稿）
影響範圍確認：
- [x] 共用 Button：尺寸階梯統一（sm 36px / default 42px / lg 44px），outline hover 改邊框加深＋陰影；6 處列表頁頂部動作按鈕由 sm 改 default
- [x] 共用 Table：列上下間距 20px、欄間距 24px、首末欄邊距 24px、表頭 h-12
- [x] 共用 Card：淺色模式移除外框改淡陰影，深色保留框線（28 個檔案生效）
- [x] 共用 Input / Select / SearchableSelect / Textarea：高度統一 42px（Textarea 固定最小 112px）
- [x] 側邊欄：黑底膠囊＋品牌黃選中樣式（新增 --sidebar-item-active-bg/text 變數）、寬度 280px、間距加大
- [x] Header：高 75px、白底、底部陰影、PNG 新 logo（public/logo-mark-*.png）、文字改「資金分配系統」
- [x] 內容區 padding 44px 68px 96px（全站，SidebarLayout）
- [x] 資金分配申請表單（新增/編輯）：橫式 label 排版（含群組列區塊整塊直式規則）、卡片 16px 圓角與 Design 稿間距、radio 加大
注意：付款憑單/暫付款沖銷憑單的建立頁表單間距尚未同步（沿用舊排版），待後續處理。

**全站速度優化第一步：Vercel 伺服器區域改至孟買與資料庫同區**（2026-07-09，Riku）
實測發現全站每頁伺服器回應 2~3 秒的主因：Vercel 函數跑在預設美東（iad1），而兩個 Supabase 資料庫都在孟買（ap-south-1），每頁約 8 波查詢各付一次美東↔孟買往返。新增 `vercel.json` 將函數區域固定為 `bom1`，部署後查詢往返從約 0.2 秒降到 0.02 秒以內。後續優化候選（尚未做）：layout 三個依序查詢改平行、半靜態資料快取、loading 骨架屏。

**修正草稿轉正式送出後單號未產生的問題**（2026-07-09，Riku）
分支：`feature/riku-fix-draft-code`
問題：草稿先儲存、之後從「編輯草稿」頁面送出審核時，單號一直顯示「-」；但新增申請直接送出則正常產生單號。
原因：單號產生（`generateSerialNumber`）原本只寫在「新增申請」頁面的送出流程裡，是前端手動呼叫，`updateFundsAllocation`／`createFundsAllocation` 這兩個共用 server action 本身不負責產生單號，導致「編輯草稿→送出」這條路徑忘記呼叫，單號始終是空的。
解法：把「補產生單號」的判斷收斂進 `createFundsAllocation` / `updateFundsAllocation` 這兩個共用 server action 內部——狀態變成 `pending` 且目前沒有單號時自動產生，一次修好、未來任何「草稿轉正式」的入口都不會再漏掉。
附帶修復：測試時發現 `staging` 分支前一個 commit（中介層擋 svg 靜態圖片）的路由保護設定寫錯正規表達式（`src/proxy.ts` matcher 多了一個不合法的捕獲群組），導致 dev server 完全無法啟動、`staging` 測試站當時應該整個打不開；已一併修正為不捕獲寫法。

**深色模式寫死白底修正**（2026-07-09，Riku）
分支：`feature/riku-dark-mode-fix`
問題：深色模式先前被強制關閉從未實際上線，多處元件寫死白色背景、文字色未指定，深色模式下亮字疊白底看不清（下拉選單最明顯）。統一改用 `var(--bg-card)` + `var(--text-body)` 等 CSS 變數，並將選中狀態的舊藍色改為品牌主色（淺色近黑／深色品牌黃）。
影響範圍確認：
- [x] components/ui/searchable-select.tsx（全站共用下拉）
- [x] _components/DateCyclePicker.tsx（含選中日改用品牌主色、停用日期改灰階變數）
- [x] _components/AttachmentPreviewModal.tsx
- [x] _components/StatusBadge.tsx（未知狀態 fallback 標籤）
- [x] funds-allocation/my-funds/_components/TemplateModal.tsx（含按鈕樣式、文字灰階變數化）
- [x] funds-allocation/my-funds/add/_components/AddFundsForm.tsx（群組/可重複列刪除按鈕）
- [x] funds-allocation/my-funds/edit/[id]/_components/EditFundsForm.tsx（同上）
- [x] funds-allocation/review/check/[id]/page.tsx（審核評論框、核准金額輸入框）
- [x] funds-payment/my-payment/[id]/page.tsx（受款人搜尋下拉）
- [x] funds-payment/my-payment/add/[id]/page.tsx（受款人搜尋下拉）
- [x] system-settings/form-settings/_client.tsx（整頁：區塊/列/欄位卡片、選中高亮、右側面板按鈕與輸入框）

**品牌色彩導入 + 深色模式切換按鈕**（2026-07-09，Riku）
分支：`feature/riku-brand-ui`
新增 `docs/brand-guidelines/` 品牌與 UI 規範文件（品牌色彩、Claude Design 產出的登入頁/主控台淺色深色參考稿、logo mark）供之後 UI 改動對照；`globals.css` 全站色彩 CSS 變數改為品牌用色（主要色黃 #FFEA41／近黑 #111214／白，輔助灰階 #F2F2F3、#D4D8E3、#9599A4），淺色模式主要按鈕與側邊欄選中態用近黑、深色模式改用品牌黃，維持既有元件結構（左邊框強調樣式）不變，僅換色；`--destructive` 錯誤紅保留不動（品牌規範未定義，屬功能性色彩）。
另外發現 `layout.tsx` 先前寫死強制淺色（不讀 localStorage）、`ThemeToggle.tsx` 元件存在但從未被引用，導致深色模式實際上完全無法啟動；新增 `ThemeToggleButton.tsx`（通知鈴鐺左側圖示按鈕，淺色☀️→深色🌙→自動🌙+A 循環切換）取代舊的未使用元件（已刪除 `ThemeToggle.tsx`），並修正 `layout.tsx` 防閃爍腳本改為真的讀取 localStorage／系統偏好。
影響範圍確認：
- [x] 全站色彩（`globals.css`，所有頁面共用）
- [x] Header 深色模式切換按鈕（`layout.tsx`，所有登入後頁面共用）
按鈕形狀、圓角、間距等元件級外觀改動列為後續階段，本次僅處理色彩與新增切換入口。

**審核核准金額輸入 + 審核進度顯示核准金額**（2026-07-09，Riku）
資金分配申請審核頁新增核准金額輸入欄位（送出核准時可修改預填金額）；審核進度列表中已核准的步驟旁補上「核准金額：X 元」顯示，讓審核人與申請人能看到當時實際核准的金額，而不只是核准/不核准狀態。付款憑單審核頁尚未有此功能，暫不在此次範圍內。
另修正審核管理頁「諮詢議會/主管議會/財務長」Tab 帳戶區塊標頭「已核准總額」計算錯誤：原本加總的是申請時的原始金額（`amount`），審核人修改核准金額後總額不會跟著變；改為優先加總 `approved_amount`（未核准過則退回 `amount`）。

**系統正名：BCI財務系統 → BC 資金分配系統**（2026-07-09，Yumin）
登入頁標題、瀏覽器分頁標題、畫面左上角 Header 文字，統一改名。

**範本編輯器改為動態讀取表單設定**（2026-07-09，Riku）
分支：`feature/riku-template-schema-sync`
問題：資金分配申請「新增範本」欄位原本寫死固定 9 個欄位，未同步表單設定的動態 schema（如費用明細可重複／群組區塊、自訂欄位），套用範本時這些區塊會是空的。
解法：範本編輯器改為讀取與申請表單相同的動態 schema（`getFormSchemas()`），自動長出對應欄位；費用明細等可重複列／群組區塊支援存一組預設值。同時修正「另存為我的範本」（申請表單頁面內的個人範本）原本未儲存申請處別/課別與費用明細的問題。

**通知標題加上項目名稱**（2026-07-08，Riku）
影響範圍確認：
- [x] `notifications.ts`（`notifyReviewersForStep` / `notifyApplicant` 共用函式加上項目名稱）
- [x] `funds-allocation.ts`（新申請待審核通知 x2）
- [x] `approval-flow.ts`（資金分配申請：待審核／已核准／可建立付款憑單／已退回）
- [x] `approval-flow.ts`（付款憑單：待審核／已核准／已退回）
- [x] `approval-flow.ts`（暫付款沖銷憑單：待審核／已核准／已退回，透過關聯付款憑單帶入名稱）
- [x] `temp-voucher.ts`（送出審核通知）
所有通知標題統一在共用函式帶上項目名稱（格式：「原標題 - 項目名稱」），資金分配申請/付款憑單取自身 `name` 欄位，暫付款沖銷憑單透過關聯付款憑單帶入。

**資金分配申請列表欄位統一（含核准金額/剩餘金額）＋共用欄位切換元件**（2026-07-08，Riku）
首頁「我的申請紀錄」、/funds-allocation/my-funds、/funds-allocation/all 三個列表頁的欄位統一為審核管理頁的理想欄位（狀態/單號/申請處別/申請課別/申請人/職務/申請金額/核准金額/剩餘金額/費用項目/項目），出款帳戶保留為額外可切換欄位；「剩餘金額」本次維持顯示「-」，不定義計算公式。新增共用元件 `src/lib/fundsAllocationColumns.ts`（欄位定義）+ `useColumnVisibility` hook + `ColumnPicker` 元件，三頁共用同一份邏輯，以後調整欄位只需改一處；首頁新增原本沒有的單號欄位與欄位切換功能。

**審核管理週次篩選 + 欄位調整 + 資金管理 UI 統一**（2026-07-08，Riku）
審核管理各 Tab 改依週次顯示申請單（不限狀態，已審核單子不再消失）；Tab 右上角新增自訂年份 + 週次下拉選單（非 native select，含勾號選中效果、開啟自動捲至選中週次）；表格欄位「職稱」→「職務」、「金額」→「申請金額」，新增「核准金額」「剩餘金額」佔位欄；新增共用元件 `WeekPicker.tsx`（`YearDropdown` + `WeekDropdown`）；資金管理頁時間篩選改用相同元件，UI 一致。

**付款明細欄位確認：支援同時新增兩列**（2026-07-08，Riku）
付款明細欄位設定修正，支援同時新增多列（至少兩列）明細。

**審核管理 Tab 分類重構 + 帳戶已核准總額/剩餘可分配金額**（2026-07-07，Riku）
審核管理頁 Tab 改為課、處長審核 / 諮詢議會 / 主管議會 / 財務長 / 我的審核紀錄；各 Tab 依出款帳戶分區塊顯示，右上角顯示已核准總額與剩餘可分配金額；帳號管理新增四個子權限項目控制 Tab 可見性；課、處長 Tab 沿用舊過濾邏輯，群組 Tab 顯示該階段所有申請單。

**付款明細欄位同步到付款憑單（多組明細完整帶入）**（2026-07-10，Yumin，原掛 Riku 待辦、經確認接手）
付款憑單表單的「付款明細」區塊改為與資金分配申請單相同欄位（憑證類型/費用項目/幣別＋會計科目，群組列：稅額選擇/摘要/費用/手續費/稅額，`rowGroupStart` 同一機制）；建立付款憑單時自動帶入申請單所有群組明細（多組全帶，`extra_data.__group_` JSON 以 label 對應）；草稿編輯頁支援逐組增刪修改（每組稅額自動計算、儲存不會洗掉群組資料）；詳細頁/審核頁（FundsPaymentDetail）以表格顯示所有組並在標題列彙總費用/手續費/稅額/總額，舊憑單退回申請單合併的 `__group_` 資料顯示。付款憑單 schema 已在 dev/staging Supabase 更新（舊「未稅金額/稅額/總額」列移除，備份已留存）；**正式機 Supabase 為獨立專案，部署 main 後需在正式站表單設定重做同樣調整**。暫付款沖銷憑單同步為後續任務（留在待開發）。
影響範圍確認：
- [x] /funds-payment/my-payment/add/[id]（新增頁：群組列渲染＋多組帶入，Playwright 驗證）
- [x] /funds-payment/my-payment/[id]（草稿編輯＋唯讀詳細頁：群組編輯/表格顯示，Playwright 驗證）
- [x] /funds-payment/review/check/[id]（審核頁：共用 FundsPaymentDetail）
- [x] 付款憑單 CSV 匯出（只讀結構化欄位，不受標籤改名影響）
- [x] /funds-voucher/my-voucher/add/[id]（暫付款沖銷建立頁：只讀 payment 結構化欄位，不受影響）
- [x] 付款憑單表單 schema 更新（dev/staging DB 已完成）

**審核人可編輯申請單 + 變更歷程**（2026-07-06，Riku）
審核人在當前步驟未核准前可進入 edit 頁修改申請單（除單號外全部欄位）；每次儲存自動記錄變更人/時間/欄位/新舊值；標題列加「變更歷程」按鈕開 Modal 顯示時間軸；申請人視角顯示動態審核進度（含審核人名字）。

**申請列表改版：欄位自訂、金額與費用項目取第三區塊、刪除修正**（2026-07-05，Riku）
列表欄位可自訂顯示（localStorage 儲存偏好，「欄位」按鈕切換）；金額改取第三區塊（付款明細）的彙總總額；費用項目改取第三區塊的 fee_records 欄位值；「職稱」欄位改名為「職務」（my-funds 與 all 頁面）；刪除申請單前先清除關聯通知，修正 foreign key 限制錯誤。

**申請單職務選擇改版**（2026-07-04，Riku）
申請單職務欄位改為從負責人所屬組織單位帶入可選職務，選完職務後自動填入申請處別與課別。

**附件上傳改版：多筆上傳＋進度條＋私有 bucket 代理存取**（2026-07-05，Riku）
附件上傳元件改為 XHR 並行上傳（每個檔案各自顯示進度條）；上傳失敗顯示白話中文錯誤；Storage Bucket 改為 Private，新增 `/api/attachment` 代理路由（驗證登入後才能存取），避免附件 URL 外流可直接開啟。

**付款明細群組重複新增**（2026-07-05，Riku）
資金分配申請「付款明細」區塊支援整組重複新增：表單設定可將某一列標為「整組重複新增起始列」（`rowGroupStart`），從該列起以下整組欄位可點「+ 新增項目」整組複製；每組內稅額自動計算（先選稅額或先打費用皆可雙向觸發）；稅額欄位可手動覆蓋；右上角彙總同步顯示費用、手續費、稅額、總額跨所有群組實例的加總；資料存入 `extra_data.__group_{blockId}`（JSON 陣列，以欄位 label 為 key）。

**修復 Google OAuth 登入跨網域失敗**（2026-07-03，Yumin）
`allocation.boptaipei.com`（正式機自訂網域）、`allocation-staging.boptaipei.com`（staging）點 Google 登入會失敗，因 `/api/auth/google`、`/api/auth/google/callback` 的 redirectUri 原本寫死抓 `NEXT_PUBLIC_APP_URL` 環境變數，跨網域時 state cookie 對不上；改為用 `req.nextUrl.origin` 動態組成，不再依賴該環境變數；同步在 Google Cloud Console 補上 `allocation.boptaipei.com`、`allocation-staging.boptaipei.com` 兩組授權重新導向 URI；另修正本機 `.env.local` 誤指向本地 Supabase（127.0.0.1:54321）的問題，改回 `bci-finance-dev` 專案。新增固定 `staging` 分支＋測試網址 `allocation-staging.boptaipei.com`，之後 feature 分支需先過 staging 測試才可合併 main（詳見 CLAUDE.md 協作流程規則）。

**支出欄位設定移除費用項目、整合費用類型設定**（2026-07-02，Riku）
支出欄位設定頁移除「費用項目」Card（原管理 `expense_items` 資料表）；表單資料來源移除 `expense_items` 選項（改用費用類型設定的 `fee_records:{cat.id}`）；移除 `ExpenseItem` 型別及所有相關程式碼（AddFundsForm、EditFundsForm、_template-tab、_client.tsx）；支出欄位設定頁現只管理「機構」和「出款帳戶」兩個下拉選項。

**~~[通知功能]~~**（2026-06-25，Riku）
頂列頭像左側新增鈴鐺通知圖示；表單送出時通知第一步審核人（資金分配/付款憑單/暫付款沖銷）；審核核准時通知下一步審核人；最終核准/退回時通知申請人；資金分配最終核准額外通知可建立付款憑單；新增 `notifications` 資料表與 Server Action；通知顯示申請人英文名（email 衍生），每 60 秒自動更新未讀數。

**審核流程 Phase 2：處別/課別驅動審核人 + 申請單存 org_unit ID**（2026-06-18，Riku）
審核流程步驟設定改為選「處別」/「課別」取代舊的職稱列表（`org_unit_type` 欄位取代 `role_type_id`）；`funds_allocation` 新增 `apply_division_id`、`apply_section_id` 欄位（關聯 `org_units`）；新增/編輯申請單時同步儲存所選節點 ID；`stepMatchesReviewer` 改為依 `org_unit_type` 找申請單對應節點的負責人（`org_unit_members`）；`checkCanReviewStep` 與 `getPendingAllocationsForReviewer` 接上新邏輯；換人負責只需更新組織架構，後續單子自動流向新負責人；移除組織架構「+ 新增職位」按鈕（改以「+ 新增負責人」統一管理）。

**審核流程與職稱整合重構（全5階段）**（2026-06-16～18，Riku）
職稱管理解除層級限制；`org_unit_members` 新增 `role_type_id`，每位負責人直接帶職稱；申請單職稱欄位改從 `org_unit_members` 撈登入者職稱；審核流程換為真實 `session.userId` 記錄，`checkCanReviewStep` 驗證組織職位與系統角色資格，待審清單依申請人組織範圍過濾；`getUserAllowedItemIds` 移除舊 `user_positions → system_role_role_types` 路徑，改為直接讀 `app_users.system_role_id`。

**帳號管理 + 角色功能權限整合重構**（2026-06-18，Riku）
系統角色精簡為：系統管理員、處、課級主管、財務長、財務人員、一般職員（刪除課級主管、主管議會成員、諮詢議會成員；主管改名）；帳號管理與角色管理合成一頁 Tab 切換；`role-permissions` 路由 redirect 至 `account-management`；側邊欄不再有獨立的角色功能權限入口。

**審核群組（諮詢議會/主管議會）**（2026-06-18，Riku）
新增 `approval_groups`、`approval_group_members` 資料表；審核流程管理頁新增「審核群組」Tab 可建立群組並加入成員；審核步驟支援第三種類型「審核群組」；`checkCanReviewStep` 與 `getPendingXxxForReviewer` 支援群組成員比對。

**匯入帳號預設權限＋帳號管理搜尋功能**（2026-06-12，Riku）
40 筆一次性匯入的職員帳號 `system_role_id` 原為 null（首次 Google 登入後會看到空白側邊欄，無任何功能權限），批次設為「一般職員」；suyu/yumin/riku/aimee 既有權限不變。帳號管理頁列表抽出為 `AccountTableView` client component，新增搜尋框可依帳號/姓名即時過濾，編號仍依原始匯入順序顯示。

**職員帳號一次性匯入＋帳號管理「編號」顯示順序**（2026-06-12，Riku）
新增 `app_users.sort_order`（nullable）欄位；依職員名單一次性建立 40 筆帳號（僅 name + email，`password_hash`／`google_id` 留空，待使用者首次 Google 登入時依 email 自動比對補上），並為既有 4 筆帳號（suyu/yumin/riku/aimee）補上對應的 `sort_order`；帳號管理頁查詢改依 `sort_order` 排序（空值排最後），「編號」欄位改顯示排序後序號（不再顯示資料庫 id，編輯連結仍用 id 不受影響）。

**組織架構與職位設定邏輯彈性化 Phase 2：負責人綁定帳號＋申請處別/課別自動對應**（2026-06-12，Riku）
`org_units` 新增 `unit_type`（處別/課別/不適用）欄位並依舊 level 回填，組織架構頁可在編輯模式手動標記，畫面上以紫色「處別」／天藍色「課別」徽章顯示；「+新增負責人」改為可搜尋帳號下拉（`SearchableSelect`），直接綁定 `app_users` 並依 email 自動產生英文 display_name；新增「重新比對帳號」按鈕，將既有 Excel 匯入的文字標籤負責人依「display_name 去掉姓氏與括號職稱後的英文名」與使用者 email 英文名比對，自動回填 `user_id`（已驗證 Riku、Yumin、Aimee、Suyu 等帳號成功連結）；另以 SQL 清除 `org_unit_members.display_name` 中所有「(課長)」「(專員)」等括號職稱備註，使顯示與比對更乾淨。新增共用邏輯 `lib/orgPositions.ts`：依使用者所有指派節點（`org_unit_members` + `user_positions`）往上尋找最近的課別／處別祖先，推算出該使用者所有可用的（處別,課別）組合；資金分配申請（AddFundsForm、EditFundsForm）與表單設定範本 tab（_template-tab.tsx）的「申請處別/課別」下拉改為僅顯示登入者推算出的組合（多重身份則列出所有組合）。付款憑單建立頁的申請處別/課別為唯讀繼承欄位，無需調整。

**組織架構彈性化 Phase 1.1：預設收合可儲存、匯入範例強化、新增子節點修正**（2026-06-11，Riku）
新增 `org_units.default_expanded`（預設 true）取代原本依層級名稱猜測的收合邏輯；「排列組織架構」Modal 可調整各節點預設展開/收合，新增「儲存收合設定」按鈕（系統一致藍色樣式）批次套用，套用後主畫面初始展開狀態以此為準；「匯入組織架構」Modal 新增 3 層級範例表格（部門→課→科）說明欄位格式，並新增「下載範例檔案」按鈕（exceljs 產生對應 .xlsx）；修正「+ 新增子節點」表單移除非必要的「層級」「編號」欄位，僅需輸入名稱即可新增；修正點擊「新增」會重複出現兩個相同節點的 bug（新增按鈕加入送出中防重複點擊）。

**組織架構彈性化 Phase 1：Excel 匯入＋完整組織圖顯示＋拖曳排列**（2026-06-11，Riku）
`org_units.level` 改為自由文字標籤，階層完全由 `parent_id` 決定、深度不限；組織架構改為單一樹根（企業主），主頁面重構為通用遞迴樹元件，每個節點可獨立收合/展開（預設收合至「處」「課」層級）；新增「匯入組織架構」功能（exceljs 解析 .xlsx，依「上級職務」欄位自動建立階層，重複名稱列出衝突供使用者指定父節點）；新增 `org_unit_members` 資料表存放 Excel「負責人」暫定人員，依姓名比對既有 `app_users` 帳號；支援拖曳調整同層順序與跨層級重新掛載，並新增「排列組織架構」精簡清單 Modal（僅顯示層級＋名稱，L 數字依節點實際深度即時換算，方便長組織圖拖曳，立即儲存）；統一人名顯示格式（藍/綠 chip 皆採 email 前綴英文名，去除姓氏）；刪除有子節點的單位時顯示友善錯誤訊息；匯入 Modal 檔案選擇按鈕改用 shadcn 樣式。

**Google OAuth 登入／註冊**（2026-06-09，Riku）
登入頁新增「使用 Google 登入／註冊」按鈕，保留原 Email + Password 流程；callback 以 email 比對 app_users，同 email 自動合併帳號並補上 google_id，找不到則建立新帳號；app_users 新增 google_id 欄位、password_hash 改 nullable；帳號管理頁新增「登入方式」欄顯示 Google / Email。OAuth app 已發布（不限測試使用者）。

**申請單號與申請日期同步**（2026-06-09，Riku）
`generateSerialNumber` 改為接受傳入日期（YYYY-MM-DD），序號以該日期底下已存在筆數累計；AddFundsForm 送出時傳入 `fieldValues['date']`，確保單號前 8 碼與申請日期一致，而非建單當天。

**我的列表應對應使用者，避免看到他人單據**（2026-06-08，Riku）
查出「我的申請紀錄」首頁與 `/funds-allocation/my-funds` 在查詢資金分配申請單時，使用寫死的假測試帳號 `MOCK_USER_ID` 過濾，導致所有使用者看到的都是同一份混合資料（新增單據時也寫入同一個假值）；付款憑單與暫付款沖銷憑單原本就正確使用 `session.userId`，未受影響。修正：新增表單、我的列表查詢、首頁查詢三處改用登入者真實 `session.userId`；並在 Supabase 執行資料回填 SQL，依「申請人」姓名比對 `app_users` 把既有 19 筆記錄的 `created_by` 改寫為正確的真實使用者 id。已用 Playwright 登入兩個帳號比對，確認各自只看到自己的單據（9 筆／10 筆），無交叉顯示。

**付款憑單顯示資金分配申請附件**（2026-06-05，Riku）
核准後轉付款憑單時，申請單附件改為以唯讀方式顯示在建立付款憑單頁（my-payment/add/[id]）與付款憑單審核頁（review/check/[id]，同時顯示付款憑單本身的附件）。

**修復資金分配申請單儲存失效**（2026-06-05，Riku）
編輯申請單時儲存草稿／送出／儲存變更會被 RLS 靜默擋下導致更新失效；新增 `updateFundsAllocation` Server Action（supabaseAdmin）取代前端直接呼叫 `supabase.from('funds_allocation').update()`，三處呼叫改走 Server Action。

**資金分配申請單錯誤訊息與刪除 Bug 修正**（2026-06-04，Riku）
送出失敗改只顯示中文說明（不顯示英文原始錯誤）；刪除申請單改用 Server Action（supabaseAdmin）確保實際刪除，並加 router.refresh() 修正刪後仍顯示的問題；修正審核頁 record.name 為 null 導致 Input 收到 null 值的 Console Error。

**稅額自動計算 Bug 修正 + 每列獨立計算 + 欄位開放輸入**（2026-06-04，Riku）
修正可重複列（repeatable row）中費用填寫後稅額與總額不更新的問題：原因為計算結果寫入 fieldValues，但 repeatable row 的欄位讀取 repeatableValues；改為 effect 直接更新 repeatableValues；實作每列費用對應同列稅額自動計算；總額改為所有列（費用＋手續費＋稅額）加總；移除稅額和總額的唯讀限制，改為可輸入但費用變動時自動帶入；修正可重複列欄寬與下方固定列欄寬不對齊的問題（刪除按鈕改為絕對定位，統一 gap:20）。

**修復組織架構頁寫入被 RLS 擋住的問題**（2026-06-01，Riku）
`/system-settings/org-structure` 新增/編輯/刪除組織單位、職位、人員指派時被 Supabase RLS 擋住；將所有 INSERT/UPDATE/DELETE 操作移至新增的 `org-structure.ts` Server Actions，改用 supabaseAdmin（service role key）繞過 RLS。

**表單設定列上移／下移**（2026-05-29，Riku）
表單設定頁點選任一列後，右側列設定面板新增「↑ 上移」「↓ 下移」按鈕，可在同一區塊內整列對調順序；位於第一列時「上移」反灰、最後一列時「下移」反灰。

**申請日期可選日限制**（2026-05-29，Riku）
表單設定新增「申請週期」tab：管理員可勾選開放哪幾個星期幾（多選）及可往後選幾週（預設 3），儲存後資金分配申請的申請日期欄位改為自訂月曆，只有符合設定的日期可點選，其他反灰；未設定任何星期則不限制。新增 `application_cycle_config` 資料表、`DateCyclePicker` 自訂元件、`application-cycle` Server Action。

**表單設定分類區隔實作**（2026-05-29，Riku）
表單設定頁支援多區塊管理，申請單與付款憑單改為區塊式卡片排版；付款憑單銜接資金分配申請的底層邏輯已完成。

**附件上傳在付款憑單和暫付款沖銷憑單建立頁沒出現的 bug 修復**（2026-05-29，Riku）
表單設定裡設定了「附件上傳」欄位，但實際建立付款憑單或暫付款沖銷憑單時，那個欄位只顯示一個空白文字輸入框，完全沒辦法選檔案。原因是這兩個頁面的欄位渲染邏輯沒有處理「附件」類型，一律 fallback 成普通文字欄位。修正後可正常顯示檔案選擇器、上傳 PDF/JPG/PNG；暫付款沖銷憑單的附件需要在 Supabase 為 fund_attachments 資料表新增 temp_voucher_id 欄位（SQL 已附在對話紀錄中）。

**多列明細（可重複列）**（2026-05-29，Riku）
填表時，同一組欄位（例如：會計科目 / 摘要 / 金額）可以新增多列，不再只能填一筆。管理員在表單設定點選那一列，開啟「允許新增多列」即可啟用；填表人點「＋ 新增項目」新增列，可刪除多餘的列；審核人看單據時以表格方式看到所有明細。

**資金分配申請送出失敗修復**（2026-05-29，Riku）
送出資金分配申請單時出現「送出失敗」錯誤，原因是資料庫安全性設定更新後，填表頁面的資料庫操作權限不足。修正後申請單可正常送出與儲存草稿。

**資金申請附加檔案**（2026-05-25，Riku）
表單設定新增「附件上傳」欄位類型，管理員可自由放置附件欄位的位置；申請單新增／編輯時可上傳 PDF、JPG、PNG，點擊可預覽；審核頁顯示附件清單；付款憑單自動繼承申請單的附件（唯讀），另可補傳付款憑單本身的附件。

**預選範本（資金分配）**（2026-05-27，Riku）
資金分配申請新增「選取範本」功能；管理員可在表單設定維護共用範本供全員使用；使用者在我的申請列表點「選取範本」，可選共用範本或自己儲存的個人範本，支援另存為自己的版本、改名、刪除；選取後進入新增頁時欄位會自動帶入預設值。

**下拉選單搜尋功能**（2026-05-25，Riku）
資金分配申請單與付款憑單的所有下拉選單改為可輸入文字搜尋，方便快速找到選項；同時修正下拉清單有時被截斷、無法完整顯示的問題。

**付款憑單詳細頁草稿可編輯 + 欄位值正確帶入**（2026-05-24，Yumin）
付款憑單詳細頁（草稿狀態）改為內嵌可編輯動態表單：繼承自申請單的欄位灰底唯讀，付款專屬欄位（付款方式、受款人等）可編輯；新增「儲存草稿」與「確定送出」按鈕；修正舊資料欄位值未帶入問題（`??` 改 `||` 處理空字串 fallback）；受款人 combobox 下拉只顯示姓名欄位（搜尋仍全欄位比對）；FundsAllocation 型別補齊 extra_data 欄位

**付款憑單動態表單 + 受款人搜尋自動帶入**（2026-05-24，Yumin）
付款憑單新增頁改為全動態 schema 驅動渲染（對齊 AddFundsForm）；新增 extra_data jsonb 欄位儲存自訂欄位值；受款人欄位（payee_records:* 資料來源）改為可搜尋 combobox，選取後自動帶入受款銀行、分行、帳戶、Email 等關聯欄位；表單設定新增 slot 層級條件顯示（showWhen 多選值），移除舊 block 層級條件顯示 UI

**表單設定資料來源動態化**（2026-05-24，Yumin）
費用類型設定與付款對象設定的各分類可作為表單欄位資料來源；表單設定右側面板開放 select/radio 欄位修改資料來源，自訂欄位新增欄位類型選擇器；AddFundsForm / EditFundsForm 支援 fee_records:* 與 payee_records:* 資料來源

**費用類型設定**（2026-05-23，Yumin）
系統設定新增費用類型管理：Tab 式分類切換、自訂類別（新增/編輯/刪除）、各類別自訂欄位（文字/數字/下拉/日期）、費用項目資料管理；新增 fee_categories、fee_category_fields、fee_records 資料表，Server Actions fee.ts，頁面 /settings/fee

**付款對象設定**（2026-05-23，Yumin）
系統設定新增付款對象管理：Tab 式分類切換、自訂類別（新增/編輯/刪除）、各類別自訂欄位（文字/數字/下拉/日期）、實際付款對象資料管理；新增 payee_categories、payee_category_fields、payee_records 資料表，Server Actions payee.ts，頁面 /system-settings/payee-settings

**暫付款沖銷憑單**（2026-05-23，Yumin）
完整暫付款沖銷憑單功能：建立頁（從付款憑單連結）、我的列表、詳細頁、審核管理、全部紀錄；新增 temp_vouchers 資料表、temp_voucher FormType、審核流程範本支援、StatusBadge 整合

**付款憑單管理頁依出款帳戶分組顯示**（2026-05-23，Yumin）
/finance/payment 依出款帳戶分組，各組顯示總額/已執行統計；新增確認付款按鈕（approved → paid 即時更新）

**自定義狀態標籤名稱**（2026-05-23，Yumin）
全站狀態 badge 統一改為可自訂，支援標籤名稱、hex 顏色、是否顯示步驟名；新增 status_label_config 資料表、StatusBadge 共用組件、/system-settings/status-labels 設定頁；funds_allocation 新增 draft 狀態支援儲存草稿

**審核頁版面調整**（2026-05-24，Riku）
資金分配審核頁改為白底卡片雙欄排版，讓審核人一眼看清楚欄位內容；付款憑單審核頁移除寬度限制，讓頁面可以撐滿畫面。

**表單設定區塊概念**（2026-05-23，Riku）
設定頁支援多區塊管理，申請單與付款憑單改為區塊式卡片排版；動態表單架構新增 FormBlock 一層

**資金分配審核流程彈性化**（2026-05-22）
動態範本、出款帳號對應、統一審核管理頁、全部申請紀錄頁、approval_records 審核紀錄表

**付款憑單審核流程彈性化**（2026-05-22）
共用同一套 approval_flow 架構，/funds-payment/review、/all 新頁面，step1~4 路由移除

**資金分配申請（5 級固定流程）**
含 step1~5 審核、申請人視圖（已整合入彈性化流程）

**付款憑單（4 級固定流程）**
含 step1~4 審核、申請人視圖（已整合入彈性化流程）

**財務管理總覽**
資金管理 + 付款憑單管理頁面

**系統設定**
帳號管理、組織架構、支出欄位、側邊欄自定義、角色權限、表單設定

**問題回報系統**
Rich Text + 圖片上傳、狀態追蹤、模組標籤

**主題色切換**
淺色/深色模式，偏好存 localStorage

**側邊欄重構**
SidebarLayout 重構
