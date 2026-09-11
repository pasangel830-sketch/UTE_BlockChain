'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Badge } from '@/components/Badge';
import { ErrorBox } from '@/components/ErrorBox';
import { ExplorerPanel } from '@/components/ExplorerPanel';
import { api, apiBlob, apiUpload, formatFecha, getSession, porFechaDesc } from '@/lib/api';
import { profileOf, type OrgProfile } from '@/lib/orgs';

type Hito = {
  id: string;
  titulo: string;
  empresa: string;
  importe: number;
  estado: string;
  hashEvidencia?: string;
  createdAt?: string;
};
type Pago = { id: string; hitoId: string; importeTotal: number; estado: string; createdAt?: string };
type Ev = {
  id: string;
  nombre: string;
  sha256: string;
  size: number;
  mime: string;
  at: string;
};

export default function HitosPage() {
  const [hitos, setHitos] = useState<Hito[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [evidencias, setEvidencias] = useState<Record<string, Ev[]>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [titulo, setTitulo] = useState('Cimentación lote A');
  const [importe, setImporte] = useState('10000');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [perfil, setPerfil] = useState<OrgProfile | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const [h, p, ev] = await Promise.all([
      api<{ items: Hito[] }>('/hitos'),
      api<{ items: Pago[] }>('/pagos'),
      api<{ porPadre: Record<string, Ev[]> }>('/evidencias').catch(() => ({ porPadre: {} })),
    ]);
    setHitos(porFechaDesc(h.items || []));
    setPagos(porFechaDesc(p.items || []));
    setEvidencias(
      Object.fromEntries(
        Object.entries(ev.porPadre || {}).map(([id, items]) => [id, porFechaDesc(items || [])]),
      ),
    );
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

  async function completar(h: Hito, file: File) {
    setErr(null);
    setBusy(h.id);
    try {
      const r = await apiUpload<{ evidencia?: Ev }>(`/hitos/${h.id}/completar`, file);
      const sha = r.evidencia?.sha256?.slice(0, 12);
      setMsg(sha ? `completar ${h.id} · evidencia ${sha}…` : `completar ${h.id}`);
      setFiles((prev) => ({ ...prev, [h.id]: null }));
      await load();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy('');
    }
  }

  async function descargar(hitoId: string, ev: Ev) {
    setErr(null);
    try {
      const blob = await apiBlob(`/hitos/${hitoId}/evidencias/${ev.id}`);
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

  function nextAction(estado: string): [string, string] | null {
    if (estado === 'PENDIENTE') return ['iniciar', 'Iniciar'];
    if (estado === 'EN_EJECUCION') return ['validar', 'Validar'];
    return null;
  }

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <h1 className="page-title">Hitos y pagos</h1>
          <div className="gold-rule animate-hairline" />
          {perfil?.empresa ? (
            <form onSubmit={crear} className="card flex flex-wrap gap-3 p-4">
              <input
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
              />
              <input
                className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
              />
              <button className="rounded-lg bg-ink px-4 py-2 text-white">Crear hito</button>
              <p className="w-full text-xs text-slate-500">
                El hito se registra a nombre de {perfil.empresa} ({perfil.oficio}).
              </p>
            </form>
          ) : (
            <p className="card p-4 text-sm text-slate-600">
              Administración no registra ni avanza obra: consulta el estado público y autoriza o
              rechaza pagos. El alta y el avance de hitos los hacen las constructoras.
            </p>
          )}
          {msg && <p className="text-sm text-emerald-700">{msg}</p>}
          <ErrorBox error={err} />
          <ul className="space-y-3">
            {hitos.map((h) => {
              const nxt = nextAction(h.estado);
              const pago = pagos.find((p) => p.hitoId === h.id);
              const puedeCompletar = h.estado === 'VALIDACION' && perfil?.empresa === h.empresa;
              const acta = files[h.id];
              return (
                <li key={h.id} className="card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{h.titulo}</p>
                      <p className="font-mono text-xs text-slate-500">{h.id}</p>
                      {h.createdAt && (
                        <p className="text-xs text-slate-500">{formatFecha(h.createdAt)}</p>
                      )}
                    </div>
                    <Badge estado={h.estado} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {h.empresa} · {h.importe} €
                    {pago && (
                      <>
                        {' '}
                        · pago <span className="font-mono">{pago.id}</span> <Badge estado={pago.estado} />
                        {pago.createdAt && <> · {formatFecha(pago.createdAt)}</>}
                      </>
                    )}
                  </p>
                  {h.hashEvidencia && (
                    <p className="mt-2 text-xs text-slate-600">
                      hash ledger{' '}
                      <code className="rounded bg-slate-100 px-1 py-0.5 font-mono" title={h.hashEvidencia}>
                        {h.hashEvidencia.slice(0, 16)}…
                      </code>
                      <button className="ml-2 underline" type="button" onClick={() => copiar(h.hashEvidencia!)}>
                        copiar
                      </button>
                    </p>
                  )}
                  {h.estado === 'COMPLETADO' && (evidencias[h.id] || []).length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {(evidencias[h.id] || []).map((ev) => (
                        <li key={ev.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="font-medium text-slate-800">{ev.nombre}</span>
                          {ev.at && <span>{formatFecha(ev.at)}</span>}
                          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono" title={ev.sha256}>
                            {ev.sha256.slice(0, 16)}…
                          </code>
                          <button className="underline" type="button" onClick={() => copiar(ev.sha256)}>
                            copiar
                          </button>
                          <button className="underline" type="button" onClick={() => void descargar(h.id, ev)}>
                            descargar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {nxt && perfil?.empresa === h.empresa && (
                    <button
                      className="mt-3 rounded-md bg-amberx px-3 py-1.5 text-sm font-medium text-white"
                      onClick={() => void act(h, nxt[0])}
                    >
                      {nxt[1]}
                    </button>
                  )}
                  {puedeCompletar && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="flex flex-col gap-1 text-sm text-slate-600">
                        Evidencia de cierre (foto o PDF, máx. 5 MB)
                        <input
                          type="file"
                          accept="image/*,.pdf,application/pdf"
                          className="rounded-lg border px-3 py-2 text-sm"
                          onChange={(e) =>
                            setFiles((prev) => ({ ...prev, [h.id]: e.target.files?.[0] ?? null }))
                          }
                        />
                      </label>
                      <button
                        className="rounded-md bg-amberx px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                        disabled={!acta || busy === h.id}
                        onClick={() => acta && void completar(h, acta)}
                      >
                        {busy === h.id ? 'Completando…' : 'Completar'}
                      </button>
                      <p className="w-full text-xs text-slate-500">
                        El archivo no entra en la cadena; el hash sí, junto al pago.
                      </p>
                    </div>
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
