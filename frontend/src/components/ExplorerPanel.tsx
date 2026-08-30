'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Tx = {
  txId: string;
  type?: string;
  fn?: string;
  chaincode?: string;
  creatorMsp?: string;
  endorsers?: string[];
  timestamp?: string;
};
type Block = {
  number: number;
  txCount: number;
  receivedAt: string;
  previousHash?: string;
  dataHash?: string;
  txs?: Tx[];
};
type Snap = { height: number; channel: string; blocks: Block[] };

function short(v: string, head = 10, tail = 6): string {
  return v.length <= head + tail + 1 ? v : `${v.slice(0, head)}…${v.slice(-tail)}`;
}

function Copiable({ value }: { value: string }) {
  return (
    <button
      type="button"
      title={value}
      className="font-mono text-xs text-slate-600 underline-offset-2 hover:underline"
      onClick={() => void navigator.clipboard?.writeText(value)}
    >
      {short(value)}
    </button>
  );
}

function BlockDetail({ b }: { b: Block }) {
  return (
    <div className="border-t border-slate-200 px-3 py-2 text-xs">
      <dl className="grid grid-cols-[7rem_1fr] gap-x-2 gap-y-1 text-slate-500">
        <dt>dataHash</dt>
        <dd>{b.dataHash ? <Copiable value={b.dataHash} /> : '—'}</dd>
        <dt>previousHash</dt>
        <dd>{b.previousHash ? <Copiable value={b.previousHash} /> : '—'}</dd>
      </dl>
      <ul className="mt-2 space-y-2">
        {(b.txs || []).map((t) => (
          <li key={t.txId} className="rounded-md bg-white px-2 py-2 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <Copiable value={t.txId} />
              {(t.chaincode || t.fn) && (
                <span className="font-medium text-ink">
                  {t.chaincode || '?'}.{t.fn || '?'}
                </span>
              )}
              {t.timestamp && <span className="text-slate-400">{t.timestamp.slice(11, 19)}</span>}
            </div>
            <p className="mt-1 text-slate-500">
              creador {t.creatorMsp || '—'}
              {t.type && t.type !== 'ENDORSER_TRANSACTION' ? ` · ${t.type}` : ''}
            </p>
            <p className="text-slate-500">
              endosos (peers): {t.endorsers?.length ? t.endorsers.join(', ') : '—'}
            </p>
          </li>
        ))}
        {!b.txs?.length && <li className="text-slate-400">sin detalle de transacciones</li>}
      </ul>
      <p className="mt-2 text-slate-400">orderers Raft (no se listan por bloque)</p>
    </div>
  );
}

export function ExplorerPanel({ compact = false }: { compact?: boolean }) {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const s = await api<Snap>('/explorer');
        if (!stop) {
          setSnap(s);
          setErr('');
        }
      } catch (e) {
        if (!stop) setErr((e as Error).message);
      }
    };
    void tick();
    const id = setInterval(tick, 3000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Explorer</h2>
        <p className="text-xs text-slate-400">polling 3 s · {snap?.channel || '—'}</p>
      </div>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <p className="mb-3 font-mono text-2xl font-bold text-ink">
        altura {snap?.height ?? '…'}
      </p>
      <ul className={`space-y-2 ${compact ? 'max-h-64 overflow-y-auto' : ''}`}>
        {(snap?.blocks || []).slice(0, compact ? 8 : 20).map((b) =>
          compact ? (
            <li key={b.number} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-mono">#{b.number}</span>
              <span className="text-slate-500">{b.txCount} tx</span>
              <span className="text-xs text-slate-400">{b.receivedAt.slice(11, 19)}</span>
            </li>
          ) : (
            <li key={b.number} className="overflow-hidden rounded-lg bg-slate-50">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-100"
                onClick={() => setOpen(open === b.number ? null : b.number)}
              >
                <span className="font-mono">
                  {open === b.number ? '▾' : '▸'} #{b.number}
                </span>
                <span className="text-slate-500">{b.txCount} tx</span>
                <span className="text-xs text-slate-400">{b.receivedAt.slice(11, 19)}</span>
              </button>
              {open === b.number && <BlockDetail b={b} />}
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
