'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';

type Estado = { avancePct: number; hitosTotal: number; pagosCustodia: number; incidenciasAbiertas: number };

export default function DashboardPage() {
  const [e, setE] = useState<Estado | null>(null);

  useEffect(() => {
    void api<Estado>('/estado')
      .then(setE)
      .catch(() => setE(null));
  }, []);

  return (
    <Shell>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amberx">Registro de obra pública</p>
      <h1 className="page-title">Inicio</h1>
      <p className="page-kicker">Rebanada hito → pago → Explorer. Incidencias PDC y estado de obra.</p>
      <div className="gold-rule my-4 animate-hairline" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Avance', e ? `${e.avancePct} %` : '—'],
          ['Hitos', e ? String(e.hitosTotal) : '—'],
          ['Custodia', e ? String(e.pagosCustodia) : '—'],
          ['Incidencias', e ? String(e.incidenciasAbiertas) : '—'],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{k}</p>
            <p className="mt-1 font-serif text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="rounded-lg bg-amberx px-4 py-2 text-white hover:shadow-official" href="/hitos">
          Ir a hitos
        </Link>
        <Link className="rounded-lg bg-ink px-4 py-2 text-white hover:shadow-official" href="/explorer">
          Explorer
        </Link>
      </div>
    </Shell>
  );
}
