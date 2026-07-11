---
name: verify
description: 本專案的實測驗證流程 — 起 dev server、偽造登入 session、用 Playwright 驅動頁面
---

# 驗證流程（bci-finance）

## 啟動

- dev server 常駐在 localhost:3000（使用者通常自己開著 `npm run dev`）；先 `lsof -nP -iTCP:3000 -sTCP:LISTEN` 檢查，已在跑就直接用（有 HMR，改完程式即生效）。
- 沒在跑才自己 `npm run dev`（背景執行）。

## 登入（免帳密）

登入態是 JWT 放在 `session` cookie（HS256，密鑰 `.env.local` 的 `SESSION_SECRET`，payload 見 `src/lib/session.ts` 的 `SessionPayload`：`userId`（數字）、`name`、`email`、`expiresAt`）。用專案 node_modules 的 `jose` 簽一顆，Playwright `addCookies` 塞進去即為登入。

常用測試帳號（dev/staging 資料庫 `app_users`）：id 1 = Yumin、id 2 = Riku、id 3 = 其他測試者。

## 查測試資料

用 `.env.local` 的 `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 建 `@supabase/supabase-js` client（皆可從專案 node_modules require）直接查/改資料。注意 `.env.local` 內有多組被註解掉的環境設定，解析時要跳過 `#` 開頭行。

## Playwright

- 專案 node_modules 沒裝 playwright；可從 npx 快取載入：`createRequire('/Users/bci20250224002/.npm/_npx/705bc6b22212b352/node_modules/')`（先驗證該路徑仍存在，否則 `for d in ~/.npm/_npx/*/node_modules; do ls $d | grep -qx playwright && echo $d; done` 重找）。
- headless chromium + `addCookies([{ name:'session', value: jwt, domain:'localhost', path:'/' }])`。
- 自訂下拉（SearchableSelect）選中的值渲染在 input 裡，用 `input[value="…"]` 或截圖確認，`getByText` 常抓不到。

## 常見坑

- 送審中單子若登入者剛好是目前步驟審核人（自審），頁面行為會走審核人分支（`isCurrentReviewer`），驗證申請人視角時要留意單子目前的審核步驟。
- 驗證中寫進資料庫的測試資料（範本、申請單）記得事後刪掉。
