-- 執行位置：Supabase Dashboard > SQL Editor
-- 目的：org_units 新增 unit_type（處別／課別／不適用），讓「申請處別/申請課別」與「組織架構頁可指派帳號的職位」
--   不再依賴 level 文字內容判斷（level 已改為自由文字標籤，不同分支同一性質的節點層級名稱可能不同）
-- 此 migration 為新增欄位並回填，不刪改既有欄位與資料

-- 1. 新增「對應類型」欄位：'division'（處別）/ 'section'（課別）/ NULL（不適用）
ALTER TABLE org_units ADD COLUMN IF NOT EXISTS unit_type TEXT;

-- 2. 回填現有資料：level 為「處」的節點視為處別、「課」的節點視為課別
--    其餘新匯入節點（level 為 L1~L7 等自由文字）unit_type 維持 NULL，
--    需在「組織架構與職位設定」頁逐一手動標記
UPDATE org_units SET unit_type = 'division' WHERE level = '處';
UPDATE org_units SET unit_type = 'section' WHERE level = '課';
