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
      <h1 className="text-2xl font-bold">Inicio</h1>
      <p className="mt-1 text-slate-500">Rebanada hito → pago → Explorer. Incidencias PDC y estado de obra.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Avance', e ? `${e.avancePct} %` : '—'],
          ['Hitos', e ? String(e.hitosTotal) : '—'],
          ['Custodia', e ? String(e.pagosCustodia) : '—'],
          ['Incidencias', e ? String(e.incidenciasAbiertas) : '—'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-white p-4">
            <p className="text-xs uppercase text-slate-500">{k}</p>
            <p className="text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="rounded-lg bg-amberx px-4 py-2 text-white" href="/hitos">
          Ir a hitos
        </Link>
        <Link className="rounded-lg bg-ink px-4 py-2 text-white" href="/explorer">
          Explorer
        </Link>
      </div>
    </Shell>
  );
}
