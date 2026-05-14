-- 執行位置：Supabase Dashboard > SQL Editor

CREATE TABLE app_users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app_users DISABLE ROW LEVEL SECURITY;
