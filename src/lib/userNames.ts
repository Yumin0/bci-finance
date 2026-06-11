// 從 email 取得英文名（@ 前面的部分，首字大寫），例如 riku@hcatwn.com → Riku
export function emailToEnglishName(email: string): string {
  const local = email.split('@')[0]
  return local.charAt(0).toUpperCase() + local.slice(1)
}

// 從「姓氏 英文名」格式去掉姓氏，只取英文名，例如 "Chen Jason" → "Jason"
export function stripSurname(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts.slice(1).join(' ') : name
}

// 去掉名字後面的括號附註（職稱等），例如 "Huang Riku (課長)" → "Huang Riku"
export function cleanDisplayName(name: string): string {
  return name.replace(/\s*[（(].*$/, '').trim()
}
