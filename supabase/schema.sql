-- 執行位置：Supabase Dashboard > SQL Editor

-- 支出下拉選單選項（機構、出款帳戶）
CREATE TABLE dropdown_options (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  field      TEXT NOT NULL,  -- 'institution' | 'payment_account'
  label      TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE dropdown_options DISABLE ROW LEVEL SECURITY;

-- 費用項目（獨立表，項目較多）
CREATE TABLE expense_items (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label      TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expense_items DISABLE ROW LEVEL SECURITY;

CREATE TABLE funds_allocation (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            TEXT NOT NULL,
  amount          NUMERIC NOT NULL,
  date            DATE NOT NULL,
  category        TEXT,
  note            TEXT,
  institution     TEXT,
  payment_account TEXT,
  expense_item    TEXT,
  serial_number   TEXT UNIQUE,
  status          TEXT NOT NULL DEFAULT '新單-課級',
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  -- 課級審核
  step1_decision  TEXT CHECK (step1_decision IN ('approved', 'rejected')),
  step1_comment   TEXT,
  step1_reviewer  UUID,
  step1_at        TIMESTAMPTZ,

  -- 處級審核
  step2_decision  TEXT CHECK (step2_decision IN ('approved', 'rejected')),
  step2_comment   TEXT,
  step2_reviewer  UUID,
  step2_at        TIMESTAMPTZ
);

-- 關閉 RLS（開發期間，之後加入 Auth 時再啟用）
ALTER TABLE funds_allocation DISABLE ROW LEVEL SECURITY;
