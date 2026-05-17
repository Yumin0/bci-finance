import { getFormSchemas, getFormDataSources } from '@/app/actions/form-schema'
import FormSettingsClient from './_client'

export default async function FormSettingsPage() {
  const [initialSchemas, dataSources] = await Promise.all([
    getFormSchemas(),
    getFormDataSources(),
  ])
  return <FormSettingsClient initialSchemas={initialSchemas} dataSources={dataSources} />
}
