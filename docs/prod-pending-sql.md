# 正式機待執行 SQL 清單

正式機的 Supabase 是獨立專案，dev/staging 執行過的結構變更**不會**自動同步。
每次功能合併到 `main` 部署正式機前，先來這裡檢查有沒有未執行的 SQL；
到正式機 Supabase 專案的 SQL Editor 執行完後，把該項目勾選並填上執行日期。

---

## ⏳ 待執行

### 出款帳戶可見範圍（feature/riku-payment-account-visibility）

- [ ] 尚未在正式機執行

用途：出款帳戶（`dropdown_options`）加上「可見範圍組織節點清單」欄位。勾選的節點（含子孫）成員才會在申請單/付款憑單的出款帳戶下拉看到該帳戶；空陣列＝全公司可見。未執行前正式機的支出欄位設定頁讀寫出款帳戶會失敗。

```sql
alter table dropdown_options
  add column if not exists visible_org_unit_ids bigint[] not null default '{}';
```

---

## ✅ 已執行

### 共用範本適用組織範圍（feature/riku-template-scope）

- [x] 已在正式機執行（執行日期：2026-07-11）

用途：共用範本資料表加上「適用組織節點清單」欄位，範本管理的組織範圍設定與選取範本的過濾都靠這個欄位。未執行前正式機建立共用範本會失敗。

```sql
alter table funds_allocation_templates
  add column if not exists org_unit_ids bigint[] not null default '{}';
```
