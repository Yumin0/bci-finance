-- 執行位置：Supabase Dashboard > SQL Editor

ALTER TABLE funds_allocation
  ADD COLUMN apply_division TEXT,
  ADD COLUMN apply_section  TEXT,
  ADD COLUMN apply_role     TEXT;
