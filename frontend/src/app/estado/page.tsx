'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { ErrorBox } from '@/components/ErrorBox';
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

function fmtEuro(n: number): string {
  return `${Number(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`;
}

type HitoItem = { id?: string; estado?: string; importe?: number };
type PagoItem = { hitoId?: string; estado?: string };

function sumaHitosNoRechazados(
  hitos: HitoItem[] | undefined,
  pagos: PagoItem[] | undefined,
): number {
  const hitoConPagoRechazado = new Set(
    (pagos || []).filter((p) => p.estado === 'RECHAZADO').map((p) => p.hitoId),
  );
  return (hitos || [])
    .filter((h) => h.estado !== 'RECHAZADO' && !hitoConPagoRechazado.has(h.id))
    .reduce((s, h) => s + Number(h.importe || 0), 0);
}

async function cargarPrevisto(): Promise<number | null> {
  const [hitosRes, pagosRes] = await Promise.all([
    api<{ items: HitoItem[] }>('/hitos').catch(() => null),
    api<{ items: PagoItem[] }>('/pagos').catch(() => null),
  ]);
  if (!hitosRes) return null;
  return sumaHitosNoRechazados(hitosRes.items, pagosRes?.items);
}

export default function EstadoPage() {
  const [e, setE] = useState<Estado | null>(null);
  const [previsto, setPrevisto] = useState(0);
  const [err, setErr] = useState<unknown>(null);

  const load = useCallback(async () => {
    const r = await api<Estado>('/estado');
    setE(r);
    const n = await cargarPrevisto();
    if (n != null) setPrevisto(n);
  }, []);

  useEffect(() => {
    void load().catch(setErr);
  }, [load]);

  async function recalc() {
    setErr(null);
    try {
      setE(await api<Estado>('/estado/recalcular', { method: 'POST', body: '{}' }));
      const n = await cargarPrevisto();
      if (n != null) setPrevisto(n);
    } catch (ex) {
      setErr(ex);
    }
  }

  const autorizado = e ? Number(e.importeAutorizado || 0) : 0;
  const pctPagado = previsto <= 0 ? 0 : Math.min(100, Math.round((autorizado / previsto) * 100));

  const cards = e
    ? [
        ['Avance', `${e.avancePct} %`],
        ['Hitos', `${e.hitosCompletados}/${e.hitosTotal}`],
        ['Rechazados', String(e.hitosRechazados)],
        ['Pagos custodia', `${e.pagosCustodia} (${e.importeCustodia} €)`],
        ['Incidencias abiertas', String(e.incidenciasAbiertas)],
        ['Incidencias cerradas', String(e.incidenciasCerradas)],
      ]
    : [];

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <h1 className="page-title">Estado de obra</h1>
        <button className="rounded-lg bg-ink px-4 py-2 text-sm text-white hover:shadow-official" onClick={() => void recalc()}>
          Recalcular
        </button>
      </div>
      <div className="gold-rule my-4 animate-hairline" />
      <ErrorBox error={err} />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.slice(0, 4).map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{k}</p>
            <p className="mt-1 font-serif text-2xl font-semibold">{v}</p>
          </div>
        ))}
        {e && (
          <div className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Pagos autorizados</p>
              <p className="text-[11px] tabular-nums text-slate-400">
                {e.pagosAutorizados} {e.pagosAutorizados === 1 ? 'pago' : 'pagos'}
              </p>
            </div>
            <p className="mt-2 font-serif text-2xl font-semibold leading-tight tracking-tight">
              <span>{fmtEuro(autorizado)}</span>
              <span className="mx-1.5 font-sans text-lg font-normal text-slate-300">/</span>
              <span className="text-slate-500">{fmtEuro(previsto)}</span>
            </p>
            <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.12em] text-slate-400">
              <span>Autorizado</span>
              <span>Hitos vigentes</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-cream">
              <div
                className="h-full rounded-full bg-gold transition-[width] duration-500"
                style={{ width: `${pctPagado}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-[11px] tabular-nums text-slate-400">{pctPagado} % del previsto</p>
          </div>
        )}
        {cards.slice(4).map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{k}</p>
            <p className="mt-1 font-serif text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </div>
      {e && <p className="mt-4 text-xs text-slate-400">{e.updatedAt}</p>}
    </Shell>
  );
}
