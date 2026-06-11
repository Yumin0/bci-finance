-- 清除 org_unit_members.display_name 後面的「(職稱)」括號備註
-- 例如「Wu Suyu (財務長)」→「Wu Suyu」、「Huang Riku (儲備IC)」→「Huang Riku」
-- 讓帳號比對與顯示更乾淨一致

update org_unit_members
set display_name = trim(regexp_replace(display_name, '\s*[（(].*$', ''))
where display_name ~ '[（(]';
