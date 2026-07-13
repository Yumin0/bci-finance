# 正式機待執行 SQL 清單

正式機的 Supabase 是獨立專案，dev/staging 執行過的結構變更**不會**自動同步。
每次功能合併到 `main` 部署正式機前，先來這裡檢查有沒有未執行的 SQL；
到正式機 Supabase 專案的 SQL Editor 執行完後，把該項目勾選並填上執行日期。

---

## ⏳ 待執行

### 付款憑單核准金額（feature/yumin-remaining-amount）

- [ ] 尚未在正式機執行

用途：付款憑單新增「核准金額」欄位，審核時可調整/確認，核准金額＝最終撥款金額，用於計算資金分配單剩餘可用額度。未執行前正式機無法使用剩餘金額計算功能。

```sql
ALTER TABLE funds_payment ADD COLUMN IF NOT EXISTS approved_amount numeric;
```

### 資金分配單「已付款」狀態約束放寬（feature/yumin-remaining-amount）

- [ ] 尚未在正式機執行

用途：資金分配單新增「已付款」狀態（剩餘金額歸零時自動轉入）。正式機資料庫對 `funds_allocation.status` 有一條既有的 CHECK constraint（本專案 migration 檔案中未曾記錄，應為當初直接在 Supabase Dashboard 手動加上），只允許 draft/pending/approved/rejected 四個值，需要放寬允許 `paid`。未執行前，資金分配單無法自動轉為已付款（會被資料庫擋下、寫入失敗）。

```sql
ALTER TABLE funds_allocation DROP CONSTRAINT IF EXISTS funds_allocation_status_check;
ALTER TABLE funds_allocation ADD CONSTRAINT funds_allocation_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'paid'));
```

### 付款憑單「付款明細」數字欄改為 未稅金額／稅額／總額（feature/yumin-remaining-amount）

- [ ] 尚未在正式機設定

**這不是 SQL，是「表單設定」的畫面調整**（付款憑單的付款明細欄位存在 `form_schemas` 資料，dev/staging 已用 service role 改好；正式機是獨立專案、表單設定不會自動同步，需在正式站畫面手動改一次）。

用途：付款憑單的付款明細數字欄，從資金分配沿用來的「費用／手續費／稅額」改回舊系統的「未稅金額／稅額／總額」——移除手續費、新增可手動填的「總額」，且三個金額欄改用付款憑單自己的全新欄位代號，與資金分配脫鉤（改名後建立付款憑單就不會再從申請單帶入這三個金額，改由承辦人依實際單據逐張填）。未設定前，正式機付款憑單付款明細仍是舊的費用/手續費/稅額、且沒有可填的總額，剩餘金額會算錯。

正式站操作步驟（每步附原因）：

1. 進入 系統設定 → 表單設定 → 選「付款憑單」→ 找到「付款明細」區塊。
   *為什麼：只改付款憑單，資金分配與暫付款沖銷憑單的付款明細維持原狀不要動。*

2. 在付款明細區塊中，**刪除**原本的「手續費」數字欄。
   *為什麼：舊系統付款憑單只有 未稅金額／稅額／總額 三個數字欄，沒有手續費。*

3. 把原本的「費用」數字欄**刪除後重新新增**一個數字欄命名「未稅金額」；同理把原本的「稅額」數字欄刪除後重新新增一個數字欄命名「稅額」；再新增一個數字欄命名「總額」。三欄順序：未稅金額 → 稅額 → 總額。
   *為什麼：要用「新增」產生全新的欄位代號（系統會自動給 `custom_<新時間戳>`），才能和資金分配的欄位代號脫鉤；沿用舊欄位只改名字不算脫鉤。三欄都要是全新代號。*

4. 點「稅額選擇」欄位的設定，把稅額計算設定調成：**稅基（baseFieldId）＝未稅金額**、**稅額欄（taxAmountFieldId）＝稅額**、**總額欄（totalFieldId）＝總額**。
   *為什麼：選稅時系統要知道用哪一欄當稅基算稅、把結果填到哪一欄；總額欄要指到新的「總額」欄位，剩餘金額才會抓對數字。總額本身是純手動填、不自動加總。*

5. 儲存表單設定。建立一張付款憑單試填：未稅金額留 0、稅額留 0、總額直接填一個數字（例如 2298），確認右上角彙總的「總額」＝各列總額加總、且能正常送出（不會被「必須大於 0」擋下）。
   *為什麼：舊系統實務就是直接填總額、未稅與稅額留 0，送出檢查已改成看「總額 > 0」而非未稅金額，要確認正式站表單設定與程式行為一致。*

---

## ✅ 已執行

### 共用範本適用組織範圍（feature/riku-template-scope）

- [x] 已在正式機執行（執行日期：2026-07-11）

用途：共用範本資料表加上「適用組織節點清單」欄位，範本管理的組織範圍設定與選取範本的過濾都靠這個欄位。未執行前正式機建立共用範本會失敗。

```sql
alter table funds_allocation_templates
  add column if not exists org_unit_ids bigint[] not null default '{}';
```
