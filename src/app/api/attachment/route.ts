import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return new NextResponse('未登入，無法存取附件', { status: 401 })
  }

  const path = req.nextUrl.searchParams.get('path')
  if (!path) {
    return new NextResponse('缺少檔案路徑', { status: 400 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from('fund-attachments')
    .download(path)

  if (error || !data) {
    return new NextResponse('找不到檔案', { status: 404 })
  }

  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const contentTypeMap: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
  }
  const contentType = contentTypeMap[ext] ?? 'application/octet-stream'
  const fileName = path.split('/').pop() ?? 'attachment'

  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
