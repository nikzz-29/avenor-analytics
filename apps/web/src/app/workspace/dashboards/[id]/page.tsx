import { DashboardDetail } from '@/features/dashboards';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DashboardDetail id={id} />;
}
