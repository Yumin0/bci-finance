import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const folder = formData.get('folder') as string | null

  if (!file || !folder) {
    return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filename = `${folder}/${Date.now()}_${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await supabase.storage
    .from('fund-attachments')
    .upload(filename, buffer, { contentType: file.type, upsert: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('fund-attachments')
    .getPublicUrl(filename)

  return NextResponse.json({ url: publicUrl, storagePath: filename, fileName: file.name, fileType: ext })
}

export async function DELETE(req: NextRequest) {
  const { storagePath } = await req.json()
  if (!storagePath) return NextResponse.json({ error: '缺少 storagePath' }, { status: 400 })

  const { error } = await supabase.storage.from('fund-attachments').remove([storagePath])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
