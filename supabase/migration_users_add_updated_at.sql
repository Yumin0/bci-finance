-- 執行位置：Supabase Dashboard > SQL Editor

ALTER TABLE app_users
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
