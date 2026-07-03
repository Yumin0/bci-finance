import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { encrypt } from '@/lib/session'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = req.cookies.get('google_oauth_state')?.value

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(new URL('/login?error=oauth_failed', req.nextUrl))
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`

  // 用 code 換 access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenData.access_token) {
    return NextResponse.redirect(new URL('/login?error=oauth_failed', req.nextUrl))
  }

  // 取得 Google 使用者資料
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })

  const googleUser = await userRes.json()

  if (!googleUser.email) {
    return NextResponse.redirect(new URL('/login?error=oauth_failed', req.nextUrl))
  }

  if (!googleUser.email.endsWith('@hcatwn.com')) {
    return NextResponse.redirect(new URL('/login?error=domain_not_allowed', req.nextUrl))
  }

  // 用 email 找已存在的帳號，或建立新帳號
  const { data: existingUser } = await supabaseAdmin
    .from('app_users')
    .select('id, name, google_id')
    .eq('email', googleUser.email)
    .single()

  let userId: number
  let userName: string

  if (existingUser) {
    // 若還未記錄 google_id，補上
    if (!existingUser.google_id) {
      await supabaseAdmin
        .from('app_users')
        .update({ google_id: googleUser.sub })
        .eq('id', existingUser.id)
    }
    userId = existingUser.id
    userName = existingUser.name
  } else {
    const { data: newUser, error } = await supabaseAdmin
      .from('app_users')
      .insert({ email: googleUser.email, name: googleUser.name, google_id: googleUser.sub })
      .select('id, name')
      .single()

    if (error || !newUser) {
      return NextResponse.redirect(new URL('/login?error=oauth_failed', req.nextUrl))
    }
    userId = newUser.id
    userName = newUser.name
  }

  // 建立 session JWT，手動寫入 cookie（配合 redirect response）
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const sessionToken = await encrypt({ userId, name: userName, expiresAt })

  const response = NextResponse.redirect(new URL('/', req.nextUrl))
  response.cookies.set('session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
  response.cookies.delete('google_oauth_state')

  return response
}
