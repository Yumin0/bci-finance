-- 執行位置：Supabase Dashboard > SQL Editor
-- 新增 block-based 圖文內容欄位

ALTER TABLE dev_tracker
  ADD COLUMN before_blocks JSONB,
  ADD COLUMN after_blocks  JSONB;
