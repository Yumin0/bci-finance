-- 執行位置：Supabase Dashboard > SQL Editor
-- 目的：組織架構頁「預設展開/收合」狀態改為可由使用者在「排列組織架構」設定並儲存，
--   取代原本依層級名稱（含「處」「課」即收合）的猜測邏輯
-- 此 migration 為新增欄位並回填，不刪改既有欄位與資料

-- 1. 新增「主畫面預設是否展開子節點」欄位，預設為展開
ALTER TABLE org_units ADD COLUMN IF NOT EXISTS default_expanded BOOLEAN NOT NULL DEFAULT true;

-- 2. 回填現有資料：套用目前畫面的收合規則（層級名稱含「處」或「課」的節點預設收合），
--    確保改完欄位後畫面顯示與現況一致，後續再由使用者於「排列組織架構」調整並儲存
UPDATE org_units SET default_expanded = false
WHERE level LIKE '%處%' OR level LIKE '%課%';
