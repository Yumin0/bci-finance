-- ============================================================
-- 費用類型設定：初始化部門與欄位
-- ============================================================
-- 用途：一次完成「費用類型設定」頁面的前置設定
-- 執行效果：
--   1. 修復相關資料表的主鍵序號（避免 duplicate key 錯誤）
--   2. 清除錯誤建立為頂層類別的「第一～第七部門」（若有）
--   3. 確認「費用項目」類別已有「項次」和「項目名稱」兩個欄位
--   4. 在「費用項目」底下建立第三～第七部門子類別
--      （第一、第二部門若已存在則自動跳過）
--
-- 安全性：
--   - 只新增缺少的資料，不刪除、不覆蓋現有正確資料
--   - 可重複執行，不會產生重複記錄
--
-- 適用環境：開發（bci-finance-dev）與正式（bci-finance）皆可執行
-- ============================================================

-- [1] 修復各資料表主鍵序號
--     說明：若曾以顯式 ID 寫入資料（例如從正式環境匯入），序號可能落後實際最大值，
--     導致下次 INSERT 產生 "duplicate key violates pkey" 錯誤
SELECT setval(pg_get_serial_sequence('fee_categories', 'id'),
  COALESCE((SELECT MAX(id) FROM fee_categories), 0) + 1, false);

SELECT setval(pg_get_serial_sequence('fee_subcategories', 'id'),
  COALESCE((SELECT MAX(id) FROM fee_subcategories), 0) + 1, false);

SELECT setval(pg_get_serial_sequence('fee_category_fields', 'id'),
  COALESCE((SELECT MAX(id) FROM fee_category_fields), 0) + 1, false);

SELECT setval(pg_get_serial_sequence('fee_records', 'id'),
  COALESCE((SELECT MAX(id) FROM fee_records), 0) + 1, false);

-- [2] 清除錯誤建立為頂層類別的「第一～第七部門」（若有）
--     說明：這些部門應該是「費用項目」底下的子類別，不是獨立的頂層類別。
--     先刪欄位定義，再刪類別本身（有外鍵約束，順序不能反）
DELETE FROM fee_category_fields
WHERE category_id IN (
  SELECT id FROM fee_categories
  WHERE name IN ('第一部門','第二部門','第三部門','第四部門','第五部門','第六部門','第七部門')
);

DELETE FROM fee_categories
WHERE name IN ('第一部門','第二部門','第三部門','第四部門','第五部門','第六部門','第七部門');

-- [3] 確認「費用項目」類別有「項次」和「項目名稱」欄位
--     說明：這兩個欄位是費用項目頁面的基本欄位，整個費用項目類別共用
INSERT INTO fee_category_fields (category_id, label, field_type, options, sort_order)
SELECT
  c.id,
  f.label,
  'text',
  NULL,
  f.sort_order
FROM fee_categories c
CROSS JOIN (VALUES ('項次', 0), ('項目名稱', 1)) AS f(label, sort_order)
WHERE c.name = '費用項目'
AND NOT EXISTS (
  SELECT 1 FROM fee_category_fields
  WHERE category_id = c.id AND label = f.label
);

-- [4] 在「費用項目」底下建立第一～第七部門子類別
--     說明：子類別用來在費用項目頁面中分組顯示，已存在的自動跳過
INSERT INTO fee_subcategories (category_id, name, sort_order)
SELECT
  c.id,
  v.name,
  v.sort_order
FROM fee_categories c
CROSS JOIN (VALUES
  ('第一部門', 0),
  ('第二部門', 1),
  ('第三部門', 2),
  ('第四部門', 3),
  ('第五部門', 4),
  ('第六部門', 5),
  ('第七部門', 6)
) AS v(name, sort_order)
WHERE c.name = '費用項目'
AND NOT EXISTS (
  SELECT 1 FROM fee_subcategories
  WHERE category_id = c.id AND name = v.name
);
