'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Badge } from '@/components/Badge';
import { ErrorBox } from '@/components/ErrorBox';
import { api, formatFecha, getSession, porFechaDesc } from '@/lib/api';

type Pago = {
  id: string;
  hitoId: string;
  empresa: string;
  importeTotal: number;
  estado: string;
  createdAt?: string;
  desglose?: Record<string, number>;
};

type OkMsg = { funcional: string; tecnico?: string };

export default function PagosPage() {
  const [items, setItems] = useState<Pago[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [ok, setOk] = useState<OkMsg | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);

  const load = useCallback(async () => {
    const r = await api<{ items: Pago[] }>('/pagos');
    setItems(porFechaDesc(r.items || []));
  }, []);

  useEffect(() => {
    setEsAdmin(getSession()?.org === 'AdministracionMSP');
    void load().catch(setErr);
  }, [load]);

  async function autorizar(id: string) {
    setErr(null);
    setOk(null);
    try {
      const pago = await api<Pago>(`/pagos/${id}/autorizar`, { method: 'POST', body: '{}' });
      setOk({
        funcional:
          'Pago autorizado. El banco ha sido notificado para ejecutar la transferencia según el desglose de participaciones.',
        tecnico: [
          `PagoContract:autorizarPago comprometida (${pago.id}).`,
          'CUSTODIA → AUTORIZADO.',
          `Evento PagoAutorizado (pagoId=${pago.id}, hitoId=${pago.hitoId}, importeTotal=${pago.importeTotal}, desglose=${JSON.stringify(pago.desglose ?? {})}).`,
          'El listener reenvía el payload a POST /mock/banco/pagos.',
          'El ledger es la fuente de verdad; el webhook es best-effort.',
          'Comprobar GET /mock/banco/pagos y el Explorer.',
        ].join('\n'),
      });
      await load();
    } catch (e) {
      setErr(e);
    }
  }

  async function rechazar(id: string) {
    setErr(null);
    setOk(null);
    try {
      await api(`/pagos/${id}/rechazar`, {
        method: 'POST',
        body: JSON.stringify({ motivo: 'rechazado por Administración' }),
      });
      setOk({ funcional: `rechazado ${id}` });
      await load();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <Shell>
      <h1 className="text-2xl font-bold">Pagos (escrow)</h1>
      <p className="mt-1 text-sm text-slate-500">CUSTODIA hasta autorización de Administración.</p>
      {ok && (
        <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
          <p>{ok.funcional}</p>
          {ok.tecnico && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-emerald-800/70">Detalle técnico</summary>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-2 text-[11px] leading-snug text-slate-100">
                {ok.tecnico}
              </pre>
            </details>
          )}
        </div>
      )}
      <ErrorBox error={err} />
      <ul className="mt-6 space-y-3">
        {items.map((p) => (
          <li key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm">{p.id}</p>
                {p.createdAt && (
                  <p className="text-xs text-slate-500">{formatFecha(p.createdAt)}</p>
                )}
              </div>
              <Badge estado={p.estado} />
            </div>
            <p className="mt-2 text-sm">
              hito {p.hitoId} · {p.importeTotal} € · {p.empresa}
            </p>
            {p.desglose && (
              <p className="mt-1 text-xs text-slate-500">
                {Object.entries(p.desglose)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(' · ')}
              </p>
            )}
            {p.estado === 'CUSTODIA' &&
              (esAdmin ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="rounded-md bg-ink px-3 py-1.5 text-sm text-white"
                    onClick={() => void autorizar(p.id)}
                  >
                    Autorizar
                  </button>
                  <button
                    className="rounded-md bg-slate-600 px-3 py-1.5 text-sm text-white"
                    onClick={() => void rechazar(p.id)}
                  >
                    Rechazar
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  En custodia — pendiente de autorización de Administración.
                </p>
              ))}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
