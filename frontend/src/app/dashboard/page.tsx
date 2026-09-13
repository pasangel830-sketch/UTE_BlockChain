'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { ORG_PROFILES, type OrgProfile } from '@/lib/orgs';

type Estado = { avancePct: number; hitosTotal: number; pagosCustodia: number; incidenciasAbiertas: number };

type Pago = { estado?: string; desglose?: Record<string, number> };

type Socia = OrgProfile & { empresa: string; pct: number };

const SOCIAS: Socia[] = Object.values(ORG_PROFILES)
  .filter((p): p is Socia => p.empresa != null && p.pct != null)
  .sort((a, b) => a.empresa.localeCompare(b.empresa));

function fmtEuro(n: number): string {
  return `${Number(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`;
}

function desgloseAutorizado(pagos: Pago[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const p of pagos) {
    if (p.estado !== 'AUTORIZADO' || !p.desglose) continue;
    for (const [empresa, importe] of Object.entries(p.desglose)) {
      acc[empresa] = (acc[empresa] || 0) + Number(importe || 0);
    }
  }
  return acc;
}

export default function DashboardPage() {
  const [e, setE] = useState<Estado | null>(null);
  const [pagos, setPagos] = useState<Pago[] | null>(null);

  useEffect(() => {
    void api<Estado>('/estado')
      .then(setE)
      .catch(() => setE(null));
    void api<{ items: Pago[] }>('/pagos')
      .then((r) => setPagos(r.items || []))
      .catch(() => setPagos([]));
  }, []);

  const porEmpresa = desgloseAutorizado(pagos || []);
  const totalAutorizado = SOCIAS.reduce((s, p) => s + (porEmpresa[p.empresa] || 0), 0);
  const nAutorizados = (pagos || []).filter((p) => p.estado === 'AUTORIZADO').length;

  return (
    <Shell>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amberx">Registro de obra pública</p>
      <h1 className="page-title">Inicio</h1>
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
      <div className="card mt-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Autorizado a ingresar</p>
          <p className="text-[11px] tabular-nums text-slate-400">
            {pagos == null
              ? '—'
              : `${nAutorizados} ${nAutorizados === 1 ? 'pago' : 'pagos'} · ${fmtEuro(totalAutorizado)}`}
          </p>
        </div>
        <p className="mt-1 text-xs text-slate-400">Según participaciones UTE. Solo pagos autorizados.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SOCIAS.map((p) => (
            <div key={p.empresa}>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                {p.label} · {p.pct} %
              </p>
              <p className="mt-1 font-serif text-2xl font-semibold">
                {pagos == null ? '—' : fmtEuro(porEmpresa[p.empresa] || 0)}
              </p>
            </div>
          ))}
        </div>
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
