-- 執行位置：Supabase Dashboard > SQL Editor

-- 組織節點（自關聯，支援部門→處→課→科四層）
CREATE TABLE org_units (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code       TEXT,                    -- 編號，例如 '第8課'、'第21B-1課'
  name       TEXT NOT NULL,           -- 名稱，例如 '支出課'、'新技術研發'
  level      TEXT NOT NULL CHECK (level IN ('部門', '處', '課', '科')),
  parent_id  BIGINT REFERENCES org_units(id) ON DELETE RESTRICT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE org_units DISABLE ROW LEVEL SECURITY;

-- 角色類型（對應各層級可使用的角色，管理者可自定義）
CREATE TABLE role_types (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       TEXT NOT NULL,           -- 例如 '處長'、'課長'、'課長(儲備)'、'課員'
  level      TEXT NOT NULL CHECK (level IN ('處', '課', '科')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE role_types DISABLE ROW LEVEL SECURITY;

-- 實際角色（某個組織節點 × 某個角色類型，可自訂顯示全名）
-- display_name 為 NULL 時由前端自動組合：{unit.code} {unit.name} {role_type.name}
CREATE TABLE org_unit_roles (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_unit_id  BIGINT NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
  role_type_id BIGINT NOT NULL REFERENCES role_types(id) ON DELETE RESTRICT,
  display_name TEXT,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_unit_id, role_type_id)
);

ALTER TABLE org_unit_roles DISABLE ROW LEVEL SECURITY;

-- 預設角色類型
INSERT INTO role_types (name, level, sort_order) VALUES
  ('處長',       '處', 0),
  ('儲備處長',   '課', 0),
  ('課長',       '課', 1),
  ('儲備課長',   '科', 0),
  ('課員',       '科', 1);
