# 正式機待執行 SQL 清單

正式機的 Supabase 是獨立專案，dev/staging 執行過的結構變更**不會**自動同步。
每次功能合併到 `main` 部署正式機前，先來這裡檢查有沒有未執行的 SQL；
到正式機 Supabase 專案的 SQL Editor 執行完後，把該項目勾選並填上執行日期。

---

## ⏳ 待執行

目前無待執行項目。

---

## ✅ 已執行

### 暫付款沖銷憑單多組明細（feature/yumin-tempvoucher-groups）

- [x] 已在正式機執行（執行日期：2026-07-14，含表單設定 SQL 替換，執行後以唯讀查詢驗證三項變更皆生效）

用途：沖銷憑單資料表加自訂欄位儲存空間（`extra_data`），讓多組付款明細（摘要用途／未稅金額／稅額／總額）能確實存檔。未執行前正式機建立沖銷憑單會存檔失敗。

```sql
ALTER TABLE temp_vouchers ADD COLUMN IF NOT EXISTS extra_data jsonb;
```

**表單設定同步（第二段 SQL，與上面一起跑）**：表單設定是 `form_schemas` 的資料、不隨部署同步。已確認正式機沖銷表單的付款明細區塊結構與 dev 改版前完全一致（同 block/row/field id），故直接以 SQL 替換該區塊：移除「會計科目」、「摘要用途」列標記群組起始（rowGroupStart）、「總額」設必填，其它區塊原封不動。

```sql
-- 先備份（把結果存起來以便回滾）
SELECT rows FROM form_schemas WHERE form_type = 'temp_voucher';

-- 只替換付款明細區塊（block_1779545628726）
UPDATE form_schemas
SET rows = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'id' = 'block_1779545628726'
      THEN '{"id":"block_1779545628726","title":"付款明細","rows":[{"id":"row_1779545719609","cols":1,"rowGroupStart":true,"slots":[{"type":"text","label":"摘要用途","fieldId":"custom_1779545756959","required":false,"dataSource":"static","staticOptions":[]}]},{"id":"row_1779545749542","cols":3,"slots":[{"type":"number","label":"未稅金額","fieldId":"custom_1779545788642","required":false,"dataSource":"none"},{"type":"number","label":"稅額","fieldId":"custom_1779545795942","required":false,"dataSource":"none"},{"type":"number","label":"總額","fieldId":"custom_1779545814376","required":true,"dataSource":"none"}]}]}'::jsonb
      ELSE elem
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(rows) WITH ORDINALITY AS t(elem, ord)
)
WHERE form_type = 'temp_voucher';
```

（dev 已於 2026-07-14 直接改資料完成同樣調整，dev 調整前的表單 JSON 備份在開發機 scratchpad `temp_voucher_schema_backup.json`；正式機改版前備份 Yumin 已於執行時留存。）


### 審核群組「主管議會」改名為「執行長」（feature/riku-rename-executive-tab）

- [x] 已在正式機執行（執行日期：2026-07-14）

用途：資金分配審核管理的「主管議會」Tab 改名為「執行長」。程式端的 Tab 標籤、權限勾選項標籤、以及用來比對群組的 `GROUP_NAMES` 都改成「執行長」；`GROUP_NAMES` 是**用名稱**去撈 `approval_groups`，所以資料庫這筆群組也必須同步改名，Tab 才撈得到、才會出現。審核流程範本的步驟是用群組 **ID** 綁定（非名稱），故改名不影響既有流程；付款憑單審核管理的群組 Tab 直接讀群組名稱，會自動一起顯示「執行長」。

```sql
update approval_groups set name = '執行長' where name = '主管議會';
```

### 暫付款沖銷單號＋採購單號撞號補正（feature/yumin-voucher-serial-inherit）

- [x] 已在正式機執行（執行日期：2026-07-14）

用途（三段一起跑，順序不可換）：
1. `temp_vouchers` 加 `serial_number` 欄——暫付款沖銷單號（＝母付款憑單採購單號＋3 碼流水），未執行前沖銷憑單相關頁面查詢會失敗。
2. 補正既有付款憑單採購單號：舊程式流水碼寫死 `001`，同一張資金分配單底下多張憑單全部撞號；依建單順序重編為 001、002…（沖銷單號掛在憑單單號後面，必須先補正）。
3. 既有沖銷憑單依補正後的母憑單採購單號補上單號。

```sql
-- 1. 暫付款沖銷單號欄位
ALTER TABLE temp_vouchers ADD COLUMN IF NOT EXISTS serial_number text;

-- 2. 付款憑單採購單號補正（同母單依建單順序 001、002…）
WITH renumbered AS (
  SELECT fp.id,
         fa.serial_number || lpad((row_number() OVER (PARTITION BY fp.funds_allocation_id ORDER BY fp.id))::text, 3, '0') AS new_po
  FROM funds_payment fp
  JOIN funds_allocation fa ON fa.id = fp.funds_allocation_id
  WHERE fa.serial_number IS NOT NULL
)
UPDATE funds_payment fp
SET purchase_order_number = r.new_po
FROM renumbered r
WHERE fp.id = r.id
  AND fp.purchase_order_number IS DISTINCT FROM r.new_po;

-- 3. 既有沖銷憑單補單號（依補正後的母憑單採購單號＋流水）
WITH renumbered AS (
  SELECT tv.id,
         fp.purchase_order_number || lpad((row_number() OVER (PARTITION BY tv.funds_payment_id ORDER BY tv.id))::text, 3, '0') AS new_sn
  FROM temp_vouchers tv
  JOIN funds_payment fp ON fp.id = tv.funds_payment_id
  WHERE fp.purchase_order_number IS NOT NULL
)
UPDATE temp_vouchers tv
SET serial_number = r.new_sn
FROM renumbered r
WHERE tv.id = r.id;
```

### 出款帳戶可見範圍（feature/riku-payment-account-visibility）

- [x] 已在正式機執行（執行日期：2026-07-13）

用途：出款帳戶（`dropdown_options`）加上「可見範圍組織節點清單」欄位。勾選的節點（含子孫）成員才會在申請單/付款憑單的出款帳戶下拉看到該帳戶；空陣列＝全公司可見。未執行前正式機的支出欄位設定頁讀寫出款帳戶會失敗。

```sql
alter table dropdown_options
  add column if not exists visible_org_unit_ids bigint[] not null default '{}';
```

### 審核核准金額欄位 approved_amount（approval_records / funds_allocation）（補登記，feature 更早的「核准金額」功能遺漏）

- [x] 已在正式機執行（執行日期：2026-07-13）

用途：審核核准時 `submitApprovalDecision` 會往 `approval_records` 寫入、往 `funds_allocation` 更新 `approved_amount`（審核人填的核准金額）。這兩欄是更早「核准金額」功能加的，但當時**漏了登記到本清單、也沒在正式機執行**，導致正式機一按「核准 → 確定送出」就報「Server Components render」錯誤（頁面能載入但寫入失敗）。此次補上。**教訓：凡功能有改資料庫結構，一律當下就登記到本清單。**

```sql
ALTER TABLE approval_records ADD COLUMN IF NOT EXISTS approved_amount numeric;
ALTER TABLE funds_allocation ADD COLUMN IF NOT EXISTS approved_amount numeric;
```

### 付款憑單「付款明細」改 未稅金額／稅額／總額（feature/yumin-remaining-amount）

- [x] 已在正式機執行（執行日期：2026-07-13）

用途：把正式機付款憑單付款明細改成與 staging 一致（憑證類型/費用項目/幣別｜稅額選擇/摘要｜未稅金額/稅額/總額，整組重複＋稅額計算設定），承接新版「總額純手動填、amount＝各組總額加總」。正式機原本結構是舊的（幣別/會計科目/摘要/未稅金額/稅額(誤設為 payment_method 下拉)/總額，非群組、無稅額選擇），與 dev/staging 長期不同步。**表單設定是 `form_schemas` 表的資料、不隨 git 部署同步**，故改法不是畫面點按而是直接以 SQL 替換 `block_pay_2`（jsonb_agg by id，只換這一塊、保留其它區塊）。正式機費用類別 id 與 dev 相同（1=費用項目、3=幣別）。

```sql
-- 只替換 payment_voucher 的 block_pay_2（付款明細）區塊，其它區塊原封不動
update form_schemas
set rows = (
  select jsonb_agg(
    case when elem->>'id' = 'block_pay_2'
      then $json${"id":"block_pay_2","title":"付款明細","rows":[{"id":"r4","cols":3,"slots":[{"type":"select","label":"憑證類型","fieldId":"custom_pv_evtype","required":true,"dataSource":"static","staticOptions":["國內公司","國內個人","國外公司","國外個人"]},{"type":"select","label":"費用項目","fieldId":"custom_pv_feeitem","required":true,"taxConfig":{"baseFieldId":"custom_pv_untaxed","totalFieldId":"custom_pv_total","taxAmountFieldId":"custom_pv_taxamt"},"dataSource":"fee_records:1"},{"type":"select","label":"幣別","fieldId":"custom_pv_currency","required":false,"dataSource":"fee_records:3"}]},{"id":"r5","cols":2,"rowGroupStart":true,"slots":[{"type":"select","label":"稅額選擇","fieldId":"custom_pv_taxselect","required":false,"taxConfig":{"baseFieldId":"custom_pv_untaxed","totalFieldId":"custom_pv_total","taxAmountFieldId":"custom_pv_taxamt"},"dataSource":"tax_rates"},{"type":"text","label":"摘要/用途說明","fieldId":"custom_pv_summary","required":false,"dataSource":"static","staticOptions":[]}]},{"id":"r6","cols":3,"slots":[{"type":"number","label":"未稅金額","fieldId":"custom_pv_untaxed","required":false,"dataSource":"none"},{"type":"number","label":"稅額","fieldId":"custom_pv_taxamt","required":false,"dataSource":"none"},{"type":"number","label":"總額","fieldId":"custom_pv_total","required":false,"dataSource":"none"}]}]}$json$::jsonb
      else elem
    end
    order by ord
  )
  from jsonb_array_elements(rows) with ordinality as t(elem, ord)
),
updated_at = now()
where form_type = 'payment_voucher';
```

### 付款憑單核准金額 + 資金分配「已付款」狀態約束放寬（feature/yumin-remaining-amount）

- [x] 已在正式機執行（執行日期：2026-07-13）

用途：付款憑單新增 `approved_amount`（審核可調整/確認的核准金額，用於剩餘額度計算）；資金分配 `status` 放寬允許 `paid`（剩餘歸零自動結案）。

```sql
ALTER TABLE funds_payment ADD COLUMN IF NOT EXISTS approved_amount numeric;

ALTER TABLE funds_allocation DROP CONSTRAINT IF EXISTS funds_allocation_status_check;
ALTER TABLE funds_allocation ADD CONSTRAINT funds_allocation_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'paid'));
```

### 共用範本適用組織範圍（feature/riku-template-scope）

- [x] 已在正式機執行（執行日期：2026-07-11）

用途：共用範本資料表加上「適用組織節點清單」欄位，範本管理的組織範圍設定與選取範本的過濾都靠這個欄位。未執行前正式機建立共用範本會失敗。

```sql
alter table funds_allocation_templates
  add column if not exists org_unit_ids bigint[] not null default '{}';
```
