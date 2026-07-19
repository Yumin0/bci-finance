import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { resolveAllocationShareTarget } from '@/app/actions/share-link'
import ShareNoAccess from '@/app/_components/ShareNoAccess'

// 資金分配申請單分享連結中介轉址（Q22c）：未登入由 proxy 導 /login?returnUrl= 回跳到這裡，
// 登入後依身份分流到審核頁／自己的單子頁；無權限顯示提示頁
export default async function AllocationSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numId = Number(id)
  const session = await getSession()
  if (!session?.userId || !Number.isFinite(numId)) return <ShareNoAccess />

  const target = await resolveAllocationShareTarget(numId, session.userId)
  if (target) redirect(target)
  return <ShareNoAccess />
}
