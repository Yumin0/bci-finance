-- 執行位置：Supabase Dashboard > SQL Editor
-- 前提：已執行 migration_org_structure.sql 及 seed_org_structure.sql

-- 所有「處」節點 → 處長
INSERT INTO org_unit_roles (org_unit_id, role_type_id, sort_order)
SELECT u.id, r.id, 0
FROM org_units u CROSS JOIN role_types r
WHERE u.level = '處' AND r.name = '處長';

-- 所有「課」節點 → 儲備處長
INSERT INTO org_unit_roles (org_unit_id, role_type_id, sort_order)
SELECT u.id, r.id, 0
FROM org_units u CROSS JOIN role_types r
WHERE u.level = '課' AND r.name = '儲備處長';

-- 所有「課」節點 → 課長
INSERT INTO org_unit_roles (org_unit_id, role_type_id, sort_order)
SELECT u.id, r.id, 1
FROM org_units u CROSS JOIN role_types r
WHERE u.level = '課' AND r.name = '課長';
