'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';

type Estado = {
  hitosTotal: number;
  hitosCompletados: number;
  hitosRechazados: number;
  pagosCustodia: number;
  pagosAutorizados: number;
  importeCustodia: number;
  importeAutorizado: number;
  incidenciasAbiertas: number;
  incidenciasCerradas: number;
  avancePct: number;
  updatedAt: string;
};

export default function EstadoPage() {
  const [e, setE] = useState<Estado | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await api<Estado>('/estado');
    setE(r);
  }, []);

  useEffect(() => {
    void load().catch((ex) => setErr((ex as Error).message));
  }, [load]);

  async function recalc() {
    setErr('');
    try {
      setE(await api<Estado>('/estado/recalcular', { method: 'POST', body: '{}' }));
    } catch (ex) {
      setErr((ex as Error).message);
    }
  }

  const cards = e
    ? [
        ['Avance', `${e.avancePct} %`],
        ['Hitos', `${e.hitosCompletados}/${e.hitosTotal}`],
        ['Rechazados', String(e.hitosRechazados)],
        ['Pagos custodia', `${e.pagosCustodia} (${e.importeCustodia} €)`],
        ['Pagos autorizados', `${e.pagosAutorizados} (${e.importeAutorizado} €)`],
        ['Incidencias abiertas', String(e.incidenciasAbiertas)],
        ['Incidencias cerradas', String(e.incidenciasCerradas)],
      ]
    : [];

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Estado de obra</h1>
        <button className="rounded-lg bg-ink px-4 py-2 text-sm text-white" onClick={() => void recalc()}>
          Recalcular
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500">Lo escribe el backend. Sin invoke entre chaincodes.</p>
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{k}</p>
            <p className="mt-1 text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </div>
      {e && <p className="mt-4 text-xs text-slate-400">{e.updatedAt}</p>}
    </Shell>
  );
}
