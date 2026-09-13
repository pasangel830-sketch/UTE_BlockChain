import './globals.css';
import type { Metadata } from 'next';
import { Libre_Baskerville, Source_Sans_3 } from 'next/font/google';

const serif = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-serif',
  display: 'swap',
});

const sans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Registro de obra | UTE Blockchain Solutions · Ayuntamiento de Madrid',
  description: 'Hitos, pagos, incidencias y Explorer del convenio de obra pública',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${sans.variable} ${serif.variable} bg-cream font-sans text-ink antialiased`}>
        {children}
      </body>
    </html>
  );
}
