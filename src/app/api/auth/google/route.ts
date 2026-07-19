import { NextRequest, NextResponse } from 'next/server'
import { safeReturnUrl } from '@/lib/returnUrl'

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID!
  const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`
  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  })

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  )

  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  // 登入成功後要跳回的站內路徑（分享連結情境）：OAuth 來回走外部網站，用短效 cookie 傳遞
  const returnUrl = safeReturnUrl(req.nextUrl.searchParams.get('returnUrl'))
  if (returnUrl) {
    response.cookies.set('google_oauth_return', returnUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })
  }

  return response
}
