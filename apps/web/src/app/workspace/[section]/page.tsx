import { notFound } from 'next/navigation';
import { Overview } from '@/features/overview';
import { Explorer } from '@/features/explorer';
import { Sales, Entities } from '@/features/tables';
import { Sources } from '@/features/sources';
import { Dashboards } from '@/features/dashboards';
import { Reports } from '@/features/reports';
import { Settings } from '@/features/settings';
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  switch (section) {
    case 'overview':
      return <Overview />;
    case 'analytics':
      return <Explorer />;
    case 'sales':
      return <Sales />;
    case 'customers':
      return <Entities kind="customers" />;
    case 'products':
      return <Entities kind="products" />;
    case 'data-sources':
      return <Sources />;
    case 'dashboards':
      return <Dashboards />;
    case 'reports':
      return <Reports />;
    case 'settings':
      return <Settings />;
    default:
      notFound();
  }
}
