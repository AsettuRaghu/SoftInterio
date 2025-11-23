import { DashboardLayout } from '@/modules/dashboard/components/DashboardLayout'

export default function DashboardPageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  )
}