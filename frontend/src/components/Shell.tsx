'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken, getSession, getToken, type Session } from '@/lib/api';
import { profileLabel } from '@/lib/orgs';
import { useEffect, useState } from 'react';
import { BrandLockup } from '@/components/Brand';

const LINKS = [
  ['/dashboard', 'Inicio'],
  ['/hitos', 'Hitos'],
  ['/pagos', 'Pagos'],
  ['/incidencias', 'Incidencias'],
  ['/estado', 'Estado obra'],
  ['/explorer', 'Explorer'],
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    setSession(getSession());
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <div className="h-1.5 bg-gradient-to-r from-gold via-amberx to-ink" />
      <header className="border-b border-gold/30 bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <BrandLockup size="sm" invert />
            <div className="min-w-0">
              <p className="font-serif text-lg font-bold tracking-tight">UTE Blockchain</p>
              <p className="truncate text-[11px] uppercase tracking-[0.16em] text-gold/90">
                Ayuntamiento de Madrid · registro de obra
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {session && (
              <span
                className="hidden max-w-xs truncate rounded-full border border-gold/40 bg-white/5 px-3 py-1 text-xs text-slate-200 md:inline"
                title={session.org}
              >
                {profileLabel(session.org)}
              </span>
            )}
            <button
              className="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
              onClick={() => {
                clearToken();
                router.replace('/');
              }}
            >
              Salir
            </button>
          </div>
        </div>
        <nav className="border-t border-white/10 bg-ink/80">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 py-1.5 text-sm">
            {session && (
              <span
                className="mb-1 w-full rounded-full border border-gold/30 bg-white/5 px-3 py-1 text-xs text-slate-200 md:hidden"
                title={session.org}
              >
                {profileLabel(session.org)}
              </span>
            )}
            {LINKS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={`relative rounded-md px-3 py-1.5 ${
                  path === href
                    ? 'bg-amberx text-white after:absolute after:inset-x-3 after:bottom-0.5 after:h-0.5 after:bg-gold'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main key={path} className="mx-auto w-full max-w-6xl flex-1 animate-page-in px-4 py-8">
        {children}
      </main>
      <footer className="mt-auto border-t border-gold/30 bg-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-[11px] uppercase tracking-[0.14em] text-gold/80">
          <p>UTE Blockchain Solutions · Ayuntamiento de Madrid</p>
          <p>Convenio de colaboración · canal channel-obra</p>
        </div>
      </footer>
    </div>
  );
}
