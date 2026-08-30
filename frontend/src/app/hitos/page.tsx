'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Badge } from '@/components/Badge';
import { ExplorerPanel } from '@/components/ExplorerPanel';
import { api } from '@/lib/api';

type Hito = {
  id: string;
  titulo: string;
  empresa: string;
  importe: number;
  estado: string;
};
type Pago = { id: string; hitoId: string; importeTotal: number; estado: string };

export default function HitosPage() {
  const [hitos, setHitos] = useState<Hito[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [titulo, setTitulo] = useState('Cimentación lote A');
  const [importe, setImporte] = useState('10000');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const [h, p] = await Promise.all([
      api<{ items: Hito[] }>('/hitos'),
      api<{ items: Pago[] }>('/pagos'),
    ]);
    setHitos(h.items || []);
    setPagos(p.items || []);
  }, []);

  useEffect(() => {
    void load().catch((e) => setErr((e as Error).message));
  }, [load]);

  async function crear(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const h = await api<Hito>('/hitos', {
      method: 'POST',
      body: JSON.stringify({
        titulo,
        descripcion: 'demo día 7',
        empresa: 'EmpresaA',
        importe: Number(importe),
      }),
    });
    setMsg(`creado ${h.id}`);
    await load();
  }

  async function act(h: Hito, path: string) {
    setErr('');
    try {
      await api(`/hitos/${h.id}/${path}`, { method: 'POST', body: '{}' });
      setMsg(`${path} ${h.id}`);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  function nextAction(estado: string): [string, string] | null {
    if (estado === 'PENDIENTE') return ['iniciar', 'Iniciar'];
    if (estado === 'EN_EJECUCION') return ['validar', 'Validar'];
    if (estado === 'VALIDACION') return ['completar', 'Completar'];
    return null;
  }

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <h1 className="text-2xl font-bold">Hitos y pagos</h1>
          <form onSubmit={crear} className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <input
              className="flex-1 rounded-lg border px-3 py-2"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
            <input
              className="w-32 rounded-lg border px-3 py-2"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
            />
            <button className="rounded-lg bg-ink px-4 py-2 text-white">Crear hito</button>
          </form>
          {msg && <p className="text-sm text-emerald-700">{msg}</p>}
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <ul className="space-y-3">
            {hitos.map((h) => {
              const nxt = nextAction(h.estado);
              const pago = pagos.find((p) => p.hitoId === h.id);
              return (
                <li key={h.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{h.titulo}</p>
                      <p className="font-mono text-xs text-slate-500">{h.id}</p>
                    </div>
                    <Badge estado={h.estado} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {h.empresa} · {h.importe} €
                    {pago && (
                      <>
                        {' '}
                        · pago <span className="font-mono">{pago.id}</span> <Badge estado={pago.estado} />
                      </>
                    )}
                  </p>
                  {nxt && (
                    <button
                      className="mt-3 rounded-md bg-amberx px-3 py-1.5 text-sm font-medium text-white"
                      onClick={() => void act(h, nxt[0])}
                    >
                      {nxt[1]}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <ExplorerPanel compact />
      </div>
    </Shell>
  );
}
