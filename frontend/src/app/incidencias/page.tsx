'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Badge } from '@/components/Badge';
import { ErrorBox } from '@/components/ErrorBox';
import { api, getSession } from '@/lib/api';
import { lotePdcApagada, orgSinPeerDiario, profileOf, sociosLabel, type OrgProfile } from '@/lib/orgs';

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
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState('');
  const [perfil, setPerfil] = useState<OrgProfile | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ items: Inc[] }>('/incidencias');
    setItems(r.items || []);
  }, []);

  useEffect(() => {
    setPerfil(profileOf(getSession()?.org));
    void load().catch(setErr);
  }, [load]);

  async function crear(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const inc = await api<Inc>('/incidencias', {
        method: 'POST',
        body: JSON.stringify({
          titulo,
          empresa: perfil?.empresa,
          lote: perfil?.lote,
          detalle,
          costeEstimado: Number(coste),
          notasTecnicas: `PDC ${perfil?.lote ?? ''}`,
        }),
      });
      setMsg(`creada ${inc.id}`);
      await load();
    } catch (e2) {
      setErr(e2);
    }
  }

  async function act(id: string, path: string) {
    setErr(null);
    try {
      await api(`/incidencias/${id}/${path}`, { method: 'POST', body: JSON.stringify({ motivo: 'cierre' }) });
      await load();
    } catch (e) {
      setErr(e);
    }
  }

  async function verPrivado(id: string) {
    setErr(null);
    try {
      const d = await api<{ detalle: string; costeEstimado: number }>(`/incidencias/${id}/privado`);
      setPrivado((p) => ({ ...p, [id]: `${d.detalle} (${d.costeEstimado} €)` }));
    } catch (e) {
      setErr(e);
    }
  }

  const pdcApagada = lotePdcApagada(perfil?.lote);

  return (
    <Shell>
      <h1 className="text-2xl font-bold">Incidencias</h1>
      <p className="mt-1 text-sm text-slate-500">
        {perfil?.lote ? (
          <>
            Público en el canal. Detalle en PDC <code>{perfil.lote}</code> ({sociosLabel(perfil.lote)}).
          </>
        ) : (
          <>
            Público en el canal. El detalle vive en la PDC de cada lote; Administración solo ve el hash
            que prueba que existe y que no ha cambiado.
          </>
        )}
      </p>
      {pdcApagada && (
        <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Red diaria: los nodos de B, C y D están apagados. Puedes consultar hitos e incidencias; para
          registrar datos privados de <code>{perfil?.lote}</code> hace falta <code>make pdc-up</code>.
        </p>
      )}
      {!pdcApagada && orgSinPeerDiario(perfil?.org) && perfil?.lote && (
        <p className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
          Red diaria: el nodo de {perfil.label} está apagado. Las altas del lote{' '}
          <code>{perfil.lote}</code> salen igual, porque las endosa el nodo de{' '}
          {sociosLabel(perfil.lote, ' / ')}, socio de la misma colección privada.
        </p>
      )}
      {perfil?.empresa && perfil.lote ? (
        <form onSubmit={crear} className="mt-4 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2">
          <input className="rounded-lg border px-3 py-2" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <input className="rounded-lg border px-3 py-2" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
          <input className="rounded-lg border px-3 py-2" value={coste} onChange={(e) => setCoste(e.target.value)} />
          <button className="rounded-lg bg-ink px-4 py-2 text-white">Crear incidencia</button>
          <p className="md:col-span-2 text-xs text-slate-500">
            Se registrará a nombre de {perfil.empresa} en el lote <code>{perfil.lote}</code>.
          </p>
        </form>
      ) : (
        <p className="mt-4 rounded-xl border bg-white p-4 text-sm text-slate-600">
          Administración no abre incidencias de lote: no es socia de ninguna colección privada. Puede
          consultar la lista pública y comprobar que el hash del detalle está en el canal.
        </p>
      )}
      {msg && <p className="mt-2 text-sm text-emerald-700">{msg}</p>}
      <ErrorBox error={err} />
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
