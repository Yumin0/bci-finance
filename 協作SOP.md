# BCI Finance 協作操作說明

---

## 先看這裡：誰來做哪些事？

這份 SOP 裡的操作分三種方式，請記住以下原則：

**叫 Claude Code 做**（直接用說的，不用自己打指令）
- 改程式碼、拉取最新版本、建立工作區、上傳 GitHub

**自己在終端機輸入**（只有這兩個需要自己來）
- 啟動伺服器：`npm run dev`
- 停止伺服器：`Ctrl + C`

**到 GitHub 網站按按鈕**
- 開 Pull Request、合併程式碼

---

## 零、每次打開終端機的第一件事

每次重新打開終端機，**一定要先進入專案資料夾**，不然 `npm run dev` 會沒有反應。

Yumin 的電腦輸入：
```
cd ~/Documents/bci-finance
```

協作者 Riku 的電腦輸入：
```
cd ~/bci-finance
```

怎麼確認有沒有進去？
- 有進去 → 終端機左側會顯示 `bci-finance %`
- 還沒進去 → 終端機左側顯示 `~ %`，要重新輸入上面那行

---

## 一、協作者第一次使用（只需要做一次）

### 1. 把專案下載到自己電腦
在終端機輸入（三行分開輸入，每行按一次 Enter）：
```
git clone https://github.com/Yumin0/bci-finance.git
cd bci-finance
npm install
```
等待跑完，看到 `bci-finance %` 就完成了。

### 2. 建立環境設定檔
用 VS Code 開啟 bci-finance 資料夾，在最外層新增一個檔案叫 `.env.local`，把 Yumin 傳給你的三行內容貼進去存檔。

### 3. 設定 GitHub 登入憑證
GitHub 不讓你用密碼登入，要用特殊的「通行碼」代替：
1. 登入 GitHub → 右上角頭像 → Settings
2. 左側最下方 → Developer settings
3. Personal access tokens → Tokens (classic)
4. Generate new token (classic) → 勾選 **repo** → 按 Generate → **複製那串文字**（只會出現一次，要存好）
5. 之後每次上傳時要求輸入密碼，把這串文字貼上去

---

## 二、每次開始改程式碼的流程

### 第一步：在 VS Code 裡叫 Claude Code 拉取最新版本並啟動伺服器
直接在 VS Code 的 Claude Code 對話框說：

> 「幫我拉取最新的 main 分支，然後啟動開發伺服器」

Claude Code 會自動執行 `git pull` 和 `npm run dev`，不需要自己開終端機。
看到 Claude Code 回報 `Ready` 後，打開瀏覽器前往 `localhost:3000` 確認畫面正常。

### 第三步：跟 Claude Code 說你要改什麼
直接描述需求，讓 Claude Code 寫程式。

### 第四步：在 localhost:3000 確認改動
- 確認你改的功能操作正常
- 確認其他頁面沒有因此壞掉

**有多個改動要做，什麼時候上傳？**
- 同一個功能的多個改動 → 全部改完確認沒問題後再一起上傳
- 兩個完全不相關的功能 → 建議分開上傳，之後出問題時比較好找原因

### 第五步：叫 Claude Code 上傳到 GitHub
在 VS Code 裡跟 Claude Code 說：

> 「幫我把剛才的改動 commit 並 push 到 GitHub，說明是『這裡寫你改了什麼』」

---

## 三、讓改動正式上線

### 方式 A：請對方確認後再上線（推薦）
1. 打開 `github.com/Yumin0/bci-finance`
2. 點選 **Pull requests → New pull request**
3. compare 那欄選你自己的分支名稱，base 選 main
4. 按 **Create pull request**
5. 另一方看過沒問題後按 **Merge pull request**
6. 幾分鐘後線上版本自動更新

### 方式 B：直接上線（確定只有自己在改動時）
跟 Claude Code 說：

> 「幫我切換到 main 分支，拉取最新版本，把改動 commit 並直接 push 到 main，說明是『這裡寫你改了什麼』」

不需要開 Pull Request，push 完幾分鐘後線上版本自動更新。

---

## 四、終端機狀態對照

**終端機左側顯示 `~ %`**
→ 還沒進專案資料夾，輸入 `cd ~/bci-finance` 再繼續

**終端機左側顯示 `bci-finance %`**
→ 已在專案內，可以正常輸入指令

**終端機一直在跑、沒有 `%` 符號**
→ 網頁伺服器啟動中，這是正常的。要輸入其他指令時先按 `Ctrl + C` 停掉

---

## 五、遇到問題怎麼辦

**終端機輸入指令沒反應、一直在跑**
→ 按 `Ctrl + C` 停掉再試

**`npm run dev` 沒有反應**
→ 先輸入 `cd ~/bci-finance` 進入專案資料夾再試

**localhost:3000 打不開**
→ 先在終端機輸入 `npm run dev` 啟動伺服器

**Claude Code 上傳時顯示 Authentication failed**
→ 要求輸入密碼時，貼上通行碼而非真的密碼

---

## 六、重要提醒

- `.env.local` 這個檔案只能私下傳，不能傳到 GitHub 或公開頻道
- 每次開始前記得叫 Claude Code 拉取最新版本
- 測試完 localhost:3000 沒問題才上傳，不要傳沒測試過的程式碼
