'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Badge } from '@/components/Badge';
import { api } from '@/lib/api';

type Pago = {
  id: string;
  hitoId: string;
  empresa: string;
  importeTotal: number;
  estado: string;
  desglose?: Record<string, number>;
};

export default function PagosPage() {
  const [items, setItems] = useState<Pago[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const r = await api<{ items: Pago[] }>('/pagos');
    setItems(r.items || []);
  }, []);

  useEffect(() => {
    void load().catch((e) => setErr((e as Error).message));
  }, [load]);

  async function autorizar(id: string) {
    setErr('');
    try {
      await api(`/pagos/${id}/autorizar`, { method: 'POST', body: '{}' });
      setMsg(`autorizado ${id}`);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <Shell>
      <h1 className="text-2xl font-bold">Pagos (escrow)</h1>
      <p className="mt-1 text-sm text-slate-500">CUSTODIA hasta autorización de Administración.</p>
      {msg && <p className="mt-2 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      <ul className="mt-6 space-y-3">
        {items.map((p) => (
          <li key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm">{p.id}</p>
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
            {p.estado === 'CUSTODIA' && (
              <button
                className="mt-3 rounded-md bg-ink px-3 py-1.5 text-sm text-white"
                onClick={() => void autorizar(p.id)}
              >
                Autorizar
              </button>
            )}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
