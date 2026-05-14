-- 執行位置：Supabase Dashboard > SQL Editor
-- 前提：已執行 migration_org_structure.sql

-- 部門
INSERT INTO org_units (code, name, level, parent_id, sort_order) VALUES
  (NULL, '第一部門', '部門', NULL, 0),
  (NULL, '第二部門', '部門', NULL, 1);

-- 處
INSERT INTO org_units (code, name, level, parent_id, sort_order)
  SELECT '第一處', '行政處', '處', id, 0 FROM org_units WHERE name = '第一部門' AND level = '部門';

INSERT INTO org_units (code, name, level, parent_id, sort_order)
  SELECT '第二處', '業務處', '處', id, 0 FROM org_units WHERE name = '第二部門' AND level = '部門';

-- 課（第一處）
INSERT INTO org_units (code, name, level, parent_id, sort_order)
  SELECT '第1課', '人事課', '課', id, 0 FROM org_units WHERE code = '第一處' AND level = '處';

INSERT INTO org_units (code, name, level, parent_id, sort_order)
  SELECT '第2課', '溝通課', '課', id, 1 FROM org_units WHERE code = '第一處' AND level = '處';

INSERT INTO org_units (code, name, level, parent_id, sort_order)
  SELECT '第3課', '檢視課', '課', id, 2 FROM org_units WHERE code = '第一處' AND level = '處';

-- 課（第二處）
INSERT INTO org_units (code, name, level, parent_id, sort_order)
  SELECT '第4課', '宣傳活動課', '課', id, 0 FROM org_units WHERE code = '第二處' AND level = '處';

INSERT INTO org_units (code, name, level, parent_id, sort_order)
  SELECT '第5課', '瞭解課', '課', id, 1 FROM org_units WHERE code = '第二處' AND level = '處';

INSERT INTO org_units (code, name, level, parent_id, sort_order)
  SELECT '第6課', '銷售課', '課', id, 2 FROM org_units WHERE code = '第二處' AND level = '處';
