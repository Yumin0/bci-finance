import { getSidebarConfig } from '@/app/actions/sidebar-config'
import SidebarCustomizationClient from './_client'

export default async function SidebarCustomizationPage() {
  const config = await getSidebarConfig()
  return <SidebarCustomizationClient initialConfig={config} />
}
