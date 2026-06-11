-- 執行位置：Supabase Dashboard > SQL Editor
-- 目的：組織架構彈性化 Phase 1
--   1. 移除 org_units.level 的固定選項限制（部門/處/課/科），改為自由文字標籤，
--      階層關係改由 parent_id 決定，不再受限於層級數量
--   2. 新增 org_unit_members 表，用於 Excel 匯入「負責人」的暫定人員（尚無帳號者）
-- 注意：執行前請先在 Supabase Dashboard 將 org_units 表匯出 CSV 備份
-- 此 migration 為新增/放寬限制，不刪改既有欄位與資料

-- 1. 放寬 org_units.level 限制
ALTER TABLE org_units DROP CONSTRAINT IF EXISTS org_units_level_check;

-- 2. 新增組織單位成員表（Excel 匯入的負責人，與既有 org_unit_roles/user_positions 分開）
CREATE TABLE org_unit_members (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_unit_id  BIGINT NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  user_id      BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE org_unit_members DISABLE ROW LEVEL SECURITY;
