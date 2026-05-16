-- 執行位置：Supabase Dashboard > SQL Editor
-- 開發追蹤器：記錄所有功能需求與 bug 修復

CREATE TABLE dev_tracker (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type         TEXT NOT NULL CHECK (type IN ('bug', 'feature')),
  title        TEXT NOT NULL,
  description  TEXT,
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'on_hold')),
  module       TEXT,
  workaround   TEXT,
  created_by   BIGINT REFERENCES app_users(id),
  assigned_to  BIGINT REFERENCES app_users(id),
  estimated_at DATE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE dev_tracker DISABLE ROW LEVEL SECURITY;
