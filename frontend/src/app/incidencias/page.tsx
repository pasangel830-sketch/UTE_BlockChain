'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Badge } from '@/components/Badge';
import { ErrorBox } from '@/components/ErrorBox';
import { api, apiBlob, apiUpload, formatFecha, getSession, porFechaDesc, sha256Hex } from '@/lib/api';
import {
  lotePdcApagada,
  orgSinPeerDiario,
  ORGS_PEER_DIARIO,
  profileOf,
  sociosLabel,
  type OrgProfile,
} from '@/lib/orgs';

type Inc = {
  id: string;
  titulo: string;
  empresa: string;
  lote: string;
  estado: string;
  createdAt?: string;
};

type Ev = {
  id: string;
  nombre: string;
  sha256: string;
  size: number;
  mime: string;
  at: string;
};

export default function IncidenciasPage() {
  const [items, setItems] = useState<Inc[]>([]);
  const [titulo, setTitulo] = useState('Fisura forjado');
  const [detalle, setDetalle] = useState('precio partida confidencial');
  const [coste, setCoste] = useState('1200');
  const [altaFile, setAltaFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [privado, setPrivado] = useState<Record<string, string>>({});
  const [evidencias, setEvidencias] = useState<Record<string, Ev[]>>({});
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState('');
  const [perfil, setPerfil] = useState<OrgProfile | null>(null);
  const [vivos, setVivos] = useState<string[] | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const lote = profileOf(getSession()?.org)?.lote;
    const [r, ev] = await Promise.all([
      api<{ items: Inc[] }>('/incidencias'),
      lote
        ? api<{ porPadre: Record<string, Ev[]> }>('/evidencias').catch(() => ({ porPadre: {} }))
        : Promise.resolve({ porPadre: {} as Record<string, Ev[]> }),
    ]);
    const list = porFechaDesc(r.items || []);
    setItems(list);
    if (!lote) {
      setEvidencias({});
      return;
    }
    const ids = new Set(list.filter((i) => i.lote === lote).map((i) => i.id));
    setEvidencias(
      Object.fromEntries(
        Object.entries(ev.porPadre || {})
          .filter(([id]) => ids.has(id))
          .map(([id, items]) => [id, porFechaDesc(items || [])]),
      ),
    );
  }, []);

  useEffect(() => {
    setPerfil(profileOf(getSession()?.org));
    void load().catch(setErr);
    void api<{ peers: Record<string, boolean> }>('/red')
      .then((r) => setVivos(Object.keys(r.peers).filter((k) => r.peers[k])))
      .catch(() => setVivos(ORGS_PEER_DIARIO));
  }, [load]);

  async function crear(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy('crear');
    let creada: Inc | null = null;
    try {
      const hash = altaFile ? await sha256Hex(altaFile) : '';
      const notas = [
        `PDC ${perfil?.lote ?? ''}`,
        hash ? `hashEvidencia ${hash} ${altaFile?.name ?? ''}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      creada = await api<Inc>('/incidencias', {
        method: 'POST',
        body: JSON.stringify({
          titulo,
          empresa: perfil?.empresa,
          lote: perfil?.lote,
          detalle,
          costeEstimado: Number(coste),
          notasTecnicas: notas,
        }),
      });
      if (altaFile) {
        const ev = await apiUpload<Ev>(`/incidencias/${creada.id}/evidencias`, altaFile);
        setAltaFile(null);
        setFileKey((k) => k + 1);
        setMsg(`creada ${creada.id} · evidencia ${ev.sha256.slice(0, 12)}…`);
      } else {
        setMsg(`creada ${creada.id}`);
      }
      await load();
    } catch (e2) {
      if (creada) {
        setMsg(`creada ${creada.id} (la evidencia no se ha subido; adjúntala en la ficha)`);
        await load().catch(() => undefined);
      }
      setErr(e2);
    } finally {
      setBusy('');
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
      const d = await api<{ detalle: string; costeEstimado: number; notasTecnicas?: string }>(
        `/incidencias/${id}/privado`,
      );
      const notas = d.notasTecnicas ? ` · ${d.notasTecnicas}` : '';
      setPrivado((p) => ({ ...p, [id]: `${d.detalle} (${d.costeEstimado} €)${notas}` }));
    } catch (e) {
      setErr(e);
    }
  }

  async function adjuntar(id: string, file: File) {
    setErr(null);
    setBusy(id);
    try {
      const ev = await apiUpload<Ev>(`/incidencias/${id}/evidencias`, file);
      setMsg(`adjunta ${ev.nombre} · ${ev.sha256.slice(0, 12)}…`);
      setEvidencias((prev) => ({ ...prev, [id]: [...(prev[id] || []), ev] }));
    } catch (e) {
      setErr(e);
    } finally {
      setBusy('');
    }
  }

  async function descargar(incId: string, ev: Ev) {
    setErr(null);
    try {
      const blob = await apiBlob(`/incidencias/${incId}/evidencias/${ev.id}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ev.nombre;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e);
    }
  }

  function copiar(texto: string) {
    void navigator.clipboard.writeText(texto).then(() => setMsg('hash copiado'));
  }

  const pdcApagada = lotePdcApagada(perfil?.lote, vivos);
  const puedeAdjuntar = (i: Inc) =>
    perfil?.empresa === i.empresa && (i.estado === 'ABIERTA' || i.estado === 'EN_TRATAMIENTO');
  const veEvidencias = (i: Inc) => Boolean(perfil?.lote && perfil.lote === i.lote);

  return (
    <Shell>
      <h1 className="text-2xl font-bold">Incidencias</h1>
      <p className="mt-1 text-sm text-slate-500">
        {perfil?.lote ? (
          <>
            Público en el canal. Detalle en PDC <code>{perfil.lote}</code> ({sociosLabel(perfil.lote)}).
            Las evidencias (foto o PDF) quedan fuera de la cadena; el hash SHA-256 es la prueba.
          </>
        ) : (
          <>
            Público en el canal. El detalle vive en la PDC de cada lote; Administración solo ve el hash
            que prueba que existe y que no ha cambiado. No accede a las evidencias.
          </>
        )}
      </p>
      {pdcApagada && (
        <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Red diaria: los nodos de B, C y D están apagados. Puedes consultar hitos e incidencias; para
          registrar datos privados de <code>{perfil?.lote}</code> hace falta <code>make pdc-up</code>.
        </p>
      )}
      {!pdcApagada && orgSinPeerDiario(perfil?.org, vivos) && perfil?.lote && (
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
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            Evidencia (foto o PDF, máx. 5 MB)
            <input
              key={fileKey}
              type="file"
              accept="image/*,.pdf,application/pdf"
              className="rounded-lg border px-3 py-2 text-sm"
              onChange={(e) => setAltaFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button className="rounded-lg bg-ink px-4 py-2 text-white" disabled={busy === 'crear'}>
            Crear incidencia
          </button>
          <p className="md:col-span-2 text-xs text-slate-500">
            Se registrará a nombre de {perfil.empresa} en el lote <code>{perfil.lote}</code>. El
            archivo no entra en Fabric; el hash sí va al detalle privado.
          </p>
        </form>
      ) : (
        <p className="mt-4 rounded-xl border bg-white p-4 text-sm text-slate-600">
          Administración no abre ni tramita incidencias de lote: no es socia de ninguna colección
          privada. Puede consultar la lista pública y comprobar que el hash del detalle está en el
          canal.
        </p>
      )}
      {msg && <p className="mt-2 text-sm text-emerald-700">{msg}</p>}
      <ErrorBox error={err} />
      <ul className="mt-6 space-y-3">
        {items.map((i) => (
          <li key={i.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{i.titulo}</p>
                {i.createdAt && (
                  <p className="text-xs text-slate-500">{formatFecha(i.createdAt)}</p>
                )}
              </div>
              <Badge estado={i.estado} />
            </div>
            <p className="font-mono text-xs text-slate-500">
              {i.id} · {i.empresa} · {i.lote}
            </p>
            {privado[i.id] && <p className="mt-2 text-sm text-violet-800">{privado[i.id]}</p>}
            {veEvidencias(i) && (evidencias[i.id] || []).length > 0 && (
              <ul className="mt-2 space-y-1">
                {(evidencias[i.id] || []).map((ev) => (
                  <li key={ev.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="font-medium text-slate-800">{ev.nombre}</span>
                    {ev.at && <span>{formatFecha(ev.at)}</span>}
                    <code className="rounded bg-slate-100 px-1 py-0.5 font-mono" title={ev.sha256}>
                      {ev.sha256.slice(0, 16)}…
                    </code>
                    <button className="underline" type="button" onClick={() => copiar(ev.sha256)}>
                      copiar
                    </button>
                    <button className="underline" type="button" onClick={() => void descargar(i.id, ev)}>
                      descargar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="rounded-md bg-slate-200 px-3 py-1 text-sm" onClick={() => void verPrivado(i.id)}>
                Ver PDC
              </button>
              {perfil?.empresa === i.empresa && i.estado === 'ABIERTA' && (
                <button className="rounded-md bg-amberx px-3 py-1 text-sm text-white" onClick={() => void act(i.id, 'tratar')}>
                  Tratar
                </button>
              )}
              {perfil?.empresa === i.empresa && i.estado === 'EN_TRATAMIENTO' && (
                <button className="rounded-md bg-ink px-3 py-1 text-sm text-white" onClick={() => void act(i.id, 'cerrar')}>
                  Cerrar
                </button>
              )}
              {puedeAdjuntar(i) && (
                <label className="cursor-pointer rounded-md bg-slate-200 px-3 py-1 text-sm">
                  {busy === i.id ? 'Subiendo…' : 'Adjuntar evidencia'}
                  <input
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    className="hidden"
                    disabled={busy === i.id}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void adjuntar(i.id, f);
                    }}
                  />
                </label>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
