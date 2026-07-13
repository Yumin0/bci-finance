-- 執行位置：Supabase Dashboard > SQL Editor
-- 目的：資金分配單新增「已付款」狀態（剩餘金額歸零時自動轉入，代表額度已用完結案）
-- 注意：資料庫目前對 funds_allocation.status 有一條 CHECK constraint（未曾記錄在本專案 migration 檔案中，
-- 應為直接在 Supabase Dashboard 手動加上），只允許 draft/pending/approved/rejected 四個值，
-- 需要放寬允許 'paid'，否則寫入會被資料庫擋下（constraint violation）。

ALTER TABLE funds_allocation DROP CONSTRAINT IF EXISTS funds_allocation_status_check;
ALTER TABLE funds_allocation ADD CONSTRAINT funds_allocation_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'paid'));
