import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const issueId = formData.get('issueId') as string | null

  if (!file || !issueId) {
    return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const filename = `${issueId}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await supabase.storage
    .from('issue-images')
    .upload(filename, buffer, { contentType: file.type, upsert: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('issue-images')
    .getPublicUrl(filename)

  return NextResponse.json({ url: publicUrl })
}

export async function DELETE(req: NextRequest) {
  const { path } = await req.json()
  if (!path) return NextResponse.json({ error: '缺少 path' }, { status: 400 })

  const { error } = await supabase.storage.from('issue-images').remove([path])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
