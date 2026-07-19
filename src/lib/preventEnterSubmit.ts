import type { KeyboardEvent } from 'react'

// 擋掉「在輸入框按 Enter＝送出表單」的瀏覽器預設行為——
// 使用者填金額時誤觸 Enter 會直接把單子送出審核（2026-07 測試回饋 Bug）。
// 只攔 input（文字/數字/日期等單行輸入框）；textarea 換行、按鈕上的 Enter 不受影響，
// 送單一律要實際按「確定送出」等按鈕。
export function preventEnterSubmit(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key !== 'Enter') return
  if (e.target instanceof HTMLInputElement) e.preventDefault()
}
