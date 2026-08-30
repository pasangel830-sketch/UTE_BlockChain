'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { ErrorBox } from '@/components/ErrorBox';
import { LOGIN_ACCOUNTS } from '@/lib/orgs';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('empresaA');
  const [password, setPassword] = useState('empresaA');
  const [err, setErr] = useState<unknown>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await login(username, password);
      router.push('/hitos');
    } catch (ex) {
      setErr(ex);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-amberx">UTE Blockchain</p>
        <h1 className="mt-2 text-2xl font-bold">Entrar</h1>
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          {LOGIN_ACCOUNTS.map((a) => (
            <li key={a.org}>
              <button
                type="button"
                className="font-mono text-slate-600 underline-offset-2 hover:underline"
                onClick={() => {
                  setUsername(a.username);
                  setPassword(a.username);
                }}
              >
                {a.username} / {a.username}
              </button>
              <span className="ml-2">{a.oficio}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-lg bg-slate-100 p-2 text-[11px] leading-snug text-slate-600">
          Red diaria (<code>make up-dev</code>): solo hay nodo de Empresa A y de Administración. B, C y D
          entran y consultan todo; registrar datos privados de <code>quirofanos-tech</code> requiere{' '}
          <code>make pdc-up</code>.
        </p>
        <label className="mt-6 block text-sm font-medium">Usuario</label>
        <input
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <label className="mt-4 block text-sm font-medium">Contraseña</label>
        <input
          type="password"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <ErrorBox error={err} />
        <button className="mt-6 w-full rounded-lg bg-ink py-2.5 font-semibold text-white hover:bg-slate-800">
          Acceder
        </button>
      </form>
    </div>
  );
}
