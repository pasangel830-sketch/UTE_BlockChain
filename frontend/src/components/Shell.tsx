'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken, getSession, getToken, type Session } from '@/lib/api';
import { profileLabel, profileLines } from '@/lib/orgs';
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

let brandIntroPlayed = false;

function OrgBadge({ org, className }: { org: string; className?: string }) {
  const { title, subtitle } = profileLines(org);
  return (
    <span className={className} title={profileLabel(org)}>
      <span className="whitespace-nowrap text-sm font-medium leading-tight text-slate-100">{title}</span>
      {subtitle ? (
        <span className="whitespace-nowrap text-[10px] leading-tight text-slate-400">{subtitle}</span>
      ) : null}
    </span>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [intro] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !brandIntroPlayed;
  });

  useEffect(() => {
    if (!intro) return;
    const t = window.setTimeout(() => {
      brandIntroPlayed = true;
    }, 1100);
    return () => window.clearTimeout(t);
  }, [intro]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    setSession(getSession());
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <div
        className={`h-1.5 origin-left bg-gradient-to-r from-gold via-amberx to-ink ${intro ? 'animate-brand-bar' : ''}`}
      />
      <header className="border-b border-gold/30 bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <div className={intro ? 'animate-brand-mark' : undefined}>
              <BrandLockup size="sm" invert />
            </div>
            <div className="min-w-0">
              <p
                className={`truncate font-serif text-[10px] font-bold uppercase tracking-[0.2em] text-gold ${
                  intro ? 'animate-brand-kicker' : ''
                }`}
              >
                UTE Blockchain Solutions
              </p>
              <p
                className={`truncate font-serif text-[15px] font-bold leading-tight tracking-tight sm:text-lg ${
                  intro ? 'animate-brand-title' : ''
                }`}
              >
                Registro de obra pública
              </p>
              <span
                className={`mt-1.5 block h-px w-[4.5rem] origin-left bg-gradient-to-r from-gold to-transparent ${
                  intro ? 'animate-brand-rule' : ''
                }`}
                aria-hidden
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {session && (
              <OrgBadge
                org={session.org}
                className="hidden rounded-xl border border-gold/40 bg-white/5 px-3 py-1 md:inline-flex md:flex-col"
              />
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
        <nav className={`border-t border-white/10 bg-ink/80 ${intro ? 'animate-brand-nav' : ''}`}>
          <div className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 py-1.5 text-sm">
            {session && (
              <OrgBadge
                org={session.org}
                className="mb-1 flex w-full flex-col rounded-xl border border-gold/30 bg-white/5 px-3 py-1 md:hidden"
              />
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
