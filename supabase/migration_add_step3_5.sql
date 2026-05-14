-- 新增 step3、step4、step5 審核欄位
ALTER TABLE funds_allocation
  ADD COLUMN step3_decision TEXT CHECK (step3_decision IN ('approved', 'rejected')),
  ADD COLUMN step3_comment  TEXT,
  ADD COLUMN step3_reviewer UUID,
  ADD COLUMN step3_at       TIMESTAMPTZ,
  ADD COLUMN step4_decision TEXT CHECK (step4_decision IN ('approved', 'rejected')),
  ADD COLUMN step4_comment  TEXT,
  ADD COLUMN step4_reviewer UUID,
  ADD COLUMN step4_at       TIMESTAMPTZ,
  ADD COLUMN step5_decision TEXT CHECK (step5_decision IN ('approved', 'rejected')),
  ADD COLUMN step5_comment  TEXT,
  ADD COLUMN step5_reviewer UUID,
  ADD COLUMN step5_at       TIMESTAMPTZ;
