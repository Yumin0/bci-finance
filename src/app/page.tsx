import { supabase } from '@/lib/supabase'
import { MOCK_USER_ID } from '@/lib/constants'
import { FundsAllocation, FundsPayment } from '@/lib/types'
import HomeTabView from './_components/HomeTabView'

export default async function Home() {
  const [fundsResult, paymentResult] = await Promise.all([
    supabase
      .from('funds_allocation')
      .select('*')
      .eq('created_by', MOCK_USER_ID)
      .order('created_at', { ascending: false }),
    supabase
      .from('funds_payment')
      .select('*')
      .eq('created_by', MOCK_USER_ID)
      .order('created_at', { ascending: false }),
  ])

  const fundsRecords = (fundsResult.data as FundsAllocation[]) ?? []
  const paymentRecords = (paymentResult.data as FundsPayment[]) ?? []

  return (
    <HomeTabView fundsRecords={fundsRecords} paymentRecords={paymentRecords} />
  )
}
