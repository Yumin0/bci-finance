-- 修正資金分配申請單的 created_by：
-- 目前所有 19 筆記錄的 created_by 都是同一個假測試 UUID（MOCK_USER_ID），
-- 導致「我的申請紀錄」查詢時，所有人都看到全部人的單據。
-- 這裡依照各筆記錄的「申請人」姓名，回填對應的真實使用者 id（與 funds_payment.created_by 相同的字串格式）。

UPDATE funds_allocation
SET created_by = (SELECT id::text FROM app_users WHERE app_users.name = funds_allocation.applicant)
WHERE created_by = '00000000-0000-0000-0000-000000000001';
