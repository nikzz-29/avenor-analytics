import type { Metadata } from 'next';
import { Providers } from '@/providers/providers';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Avenor — Clarity in every number', template: '%s · Avenor' },
  description:
    'A quieter workspace for understanding your business. Import data, explore analytics, and build your own dashboards.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
