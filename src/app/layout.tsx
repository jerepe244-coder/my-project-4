import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n/context';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'ZYRVAE Intelligence Dashboard',
  description: 'Internal operations, commercial intelligence and technical audit platform for ZYRVAE Digital Studio',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-zyrvae-950 font-sans antialiased">
        <I18nProvider>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
