// 登入後回跳網址的安全檢查：只接受站內相對路徑，
// 擋掉 https://... 與 //evil.com 這類外部網址（open redirect）
export function safeReturnUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (!url.startsWith('/') || url.startsWith('//')) return null
  return url
}
