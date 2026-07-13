-- 執行位置：Supabase Dashboard > SQL Editor
-- 目的：付款憑單審核時可調整/確認核准金額，核准金額＝最終撥款金額，用於計算資金分配單剩餘可用額度
-- 此 migration 為新增欄位，不影響既有欄位與資料

ALTER TABLE funds_payment ADD COLUMN IF NOT EXISTS approved_amount numeric;
