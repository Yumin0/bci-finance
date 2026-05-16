-- 執行位置：Supabase Dashboard > SQL Editor
-- 為 dev_tracker 新增 Before/After 欄位

ALTER TABLE dev_tracker
  ADD COLUMN before_description TEXT,
  ADD COLUMN before_images      TEXT[] DEFAULT '{}',
  ADD COLUMN after_description  TEXT,
  ADD COLUMN after_images       TEXT[] DEFAULT '{}';
