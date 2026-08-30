'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Block = { number: number; txCount: number; receivedAt: string };
type Snap = { height: number; channel: string; blocks: Block[] };

export function ExplorerPanel({ compact = false }: { compact?: boolean }) {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [err, setErr] = useState('');

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
        {(snap?.blocks || []).slice(0, compact ? 8 : 20).map((b) => (
          <li key={b.number} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="font-mono">#{b.number}</span>
            <span className="text-slate-500">{b.txCount} tx</span>
            <span className="text-xs text-slate-400">{b.receivedAt.slice(11, 19)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
