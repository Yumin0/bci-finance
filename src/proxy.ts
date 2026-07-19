import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'
import { safeReturnUrl } from '@/lib/returnUrl'

const publicRoutes = ['/login']

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isPublicRoute = publicRoutes.includes(path)

  const cookie = req.cookies.get('session')?.value
  const session = await decrypt(cookie)

  if (!isPublicRoute && !session?.userId) {
    // 帶上原始路徑，登入後自動跳回原本要去的頁面（分享連結情境，優先序2 列22）
    const loginUrl = new URL('/login', req.nextUrl)
    if (path !== '/') loginUrl.searchParams.set('returnUrl', path + req.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  if (isPublicRoute && session?.userId) {
    const ret = safeReturnUrl(req.nextUrl.searchParams.get('returnUrl'))
    return NextResponse.redirect(new URL(ret ?? '/', req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$|favicon.ico).*)'],
}
