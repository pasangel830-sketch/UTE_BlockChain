'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Badge } from '@/components/Badge';
import { api } from '@/lib/api';

type Inc = {
  id: string;
  titulo: string;
  empresa: string;
  lote: string;
  estado: string;
};

export default function IncidenciasPage() {
  const [items, setItems] = useState<Inc[]>([]);
  const [titulo, setTitulo] = useState('Fisura forjado');
  const [detalle, setDetalle] = useState('precio partida confidencial');
  const [coste, setCoste] = useState('1200');
  const [privado, setPrivado] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const r = await api<{ items: Inc[] }>('/incidencias');
    setItems(r.items || []);
  }, []);

  useEffect(() => {
    void load().catch((e) => setErr((e as Error).message));
  }, [load]);

  async function crear(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const inc = await api<Inc>('/incidencias', {
      method: 'POST',
      body: JSON.stringify({
        titulo,
        empresa: 'EmpresaA',
        lote: 'obra-gruesa-solar',
        detalle,
        costeEstimado: Number(coste),
        notasTecnicas: 'PDC A/C',
      }),
    });
    setMsg(`creada ${inc.id}`);
    await load();
  }

  async function act(id: string, path: string) {
    setErr('');
    try {
      await api(`/incidencias/${id}/${path}`, { method: 'POST', body: JSON.stringify({ motivo: 'cierre' }) });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function verPrivado(id: string) {
    setErr('');
    try {
      const d = await api<{ detalle: string; costeEstimado: number }>(`/incidencias/${id}/privado`);
      setPrivado((p) => ({ ...p, [id]: `${d.detalle} (${d.costeEstimado} €)` }));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <Shell>
      <h1 className="text-2xl font-bold">Incidencias</h1>
      <p className="mt-1 text-sm text-slate-500">
        Público en el canal. Detalle en PDC <code>obra-gruesa-solar</code> (A o C).
      </p>
      <form onSubmit={crear} className="mt-4 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2">
        <input className="rounded-lg border px-3 py-2" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <input className="rounded-lg border px-3 py-2" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
        <input className="rounded-lg border px-3 py-2" value={coste} onChange={(e) => setCoste(e.target.value)} />
        <button className="rounded-lg bg-ink px-4 py-2 text-white">Crear incidencia</button>
      </form>
      {msg && <p className="mt-2 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      <ul className="mt-6 space-y-3">
        {items.map((i) => (
          <li key={i.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{i.titulo}</p>
              <Badge estado={i.estado} />
            </div>
            <p className="font-mono text-xs text-slate-500">
              {i.id} · {i.lote}
            </p>
            {privado[i.id] && <p className="mt-2 text-sm text-violet-800">{privado[i.id]}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-md bg-slate-200 px-3 py-1 text-sm" onClick={() => void verPrivado(i.id)}>
                Ver PDC
              </button>
              {i.estado === 'ABIERTA' && (
                <button className="rounded-md bg-amberx px-3 py-1 text-sm text-white" onClick={() => void act(i.id, 'tratar')}>
                  Tratar
                </button>
              )}
              {i.estado === 'EN_TRATAMIENTO' && (
                <button className="rounded-md bg-ink px-3 py-1 text-sm text-white" onClick={() => void act(i.id, 'cerrar')}>
                  Cerrar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
