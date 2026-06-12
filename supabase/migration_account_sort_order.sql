-- 執行位置：Supabase Dashboard > SQL Editor
-- 目的：帳號管理頁「編號」欄位改為依此欄位排序顯示，不再用資料庫自動編號（id）
-- 此 migration 為新增欄位，不影響既有欄位與資料

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS sort_order INTEGER;
