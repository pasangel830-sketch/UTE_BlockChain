'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken, getSession, getToken, type Session } from '@/lib/api';
import { profileLabel } from '@/lib/orgs';
import { useEffect, useState } from 'react';

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
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="font-semibold tracking-tight">UTE Blockchain</p>
            {session && (
              <span
                className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200"
                title={session.org}
              >
                {profileLabel(session.org)}
              </span>
            )}
          </div>
          <nav className="flex flex-wrap gap-1 text-sm">
            {LINKS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-1.5 ${
                  path === href ? 'bg-amberx text-white' : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                {label}
              </Link>
            ))}
            <button
              className="rounded-md px-3 py-1.5 text-slate-300 hover:bg-slate-800"
              onClick={() => {
                clearToken();
                router.replace('/');
              }}
            >
              Salir
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
