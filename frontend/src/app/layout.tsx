import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'UTE Blockchain',
  description: 'Hitos, pagos, incidencias y Explorer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-100 text-ink antialiased">{children}</body>
    </html>
  );
}
