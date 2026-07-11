// 費用項目主要/細項連動篩選共用邏輯
// 選項標籤格式約定為「編號 名稱」（如「1.1 招募費用」「1.1 招募_廣告費」），
// 以開頭編號（第一個空白前的字串）作為主要與細項的對應鍵。
export function feeItemCode(label: string): string {
  return label.trim().split(/\s+/)[0] ?? ''
}
