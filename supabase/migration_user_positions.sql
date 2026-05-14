-- 執行位置：Supabase Dashboard > SQL Editor

CREATE TABLE user_positions (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  org_unit_role_id BIGINT NOT NULL REFERENCES org_unit_roles(id) ON DELETE CASCADE,
  is_primary       BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, org_unit_role_id)
);

ALTER TABLE user_positions DISABLE ROW LEVEL SECURITY;
