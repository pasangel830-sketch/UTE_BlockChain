'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Badge } from '@/components/Badge';
import { ErrorBox } from '@/components/ErrorBox';
import { ExplorerPanel } from '@/components/ExplorerPanel';
import { api, getSession } from '@/lib/api';
import { profileOf, type OrgProfile } from '@/lib/orgs';

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
  const [err, setErr] = useState<unknown>(null);
  const [perfil, setPerfil] = useState<OrgProfile | null>(null);

  const load = useCallback(async () => {
    const [h, p] = await Promise.all([
      api<{ items: Hito[] }>('/hitos'),
      api<{ items: Pago[] }>('/pagos'),
    ]);
    setHitos(h.items || []);
    setPagos(p.items || []);
  }, []);

  useEffect(() => {
    setPerfil(profileOf(getSession()?.org));
    void load().catch(setErr);
  }, [load]);

  async function crear(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const h = await api<Hito>('/hitos', {
        method: 'POST',
        body: JSON.stringify({
          titulo,
          descripcion: 'demo día 7',
          empresa: perfil?.empresa,
          importe: Number(importe),
        }),
      });
      setMsg(`creado ${h.id}`);
      await load();
    } catch (e2) {
      setErr(e2);
    }
  }

  async function act(h: Hito, path: string) {
    setErr(null);
    try {
      await api(`/hitos/${h.id}/${path}`, { method: 'POST', body: '{}' });
      setMsg(`${path} ${h.id}`);
      await load();
    } catch (e) {
      setErr(e);
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
          {perfil?.empresa ? (
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
              <p className="w-full text-xs text-slate-500">
                El hito se registra a nombre de {perfil.empresa} ({perfil.oficio}).
              </p>
            </form>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Administración no registra obra propia: valida hitos y autoriza pagos. El alta de hitos la
              hacen las constructoras (Empresa A, B, C o D).
            </p>
          )}
          {msg && <p className="text-sm text-emerald-700">{msg}</p>}
          <ErrorBox error={err} />
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
