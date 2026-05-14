-- 執行位置：Supabase Dashboard > SQL Editor

CREATE TABLE funds_payment (
  id                  SERIAL PRIMARY KEY,
  funds_allocation_id INT NOT NULL REFERENCES funds_allocation(id),
  name                TEXT NOT NULL,
  amount              NUMERIC NOT NULL,
  date                DATE NOT NULL,
  institution         TEXT,
  payment_account     TEXT,
  expense_item        TEXT,
  category            TEXT,
  note                TEXT,
  apply_division      TEXT,
  apply_section       TEXT,
  applicant           TEXT,
  apply_role          TEXT,
  payment_method      TEXT,
  created_by          UUID NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT now()
);
