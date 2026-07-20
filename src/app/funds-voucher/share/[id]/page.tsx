import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { resolveVoucherShareTarget } from '@/app/actions/share-link'
import ShareNoAccess from '@/app/_components/ShareNoAccess'

// 暫付款沖銷憑單分享連結中介轉址：未登入由 proxy 導 /login?returnUrl= 回跳到這裡，
// 登入後依身份分流到審核頁／自己的沖銷詳細頁；無權限顯示提示頁
export default async function VoucherSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numId = Number(id)
  const session = await getSession()
  if (!session?.userId || !Number.isFinite(numId)) return <ShareNoAccess />

  const target = await resolveVoucherShareTarget(numId, session.userId)
  if (target) redirect(target)
  return <ShareNoAccess />
}
