'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('empresaA');
  const [password, setPassword] = useState('empresaA');
  const [err, setErr] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await login(username, password);
      router.push('/hitos');
    } catch (ex) {
      setErr((ex as Error).message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-amberx">UTE Blockchain</p>
        <h1 className="mt-2 text-2xl font-bold">Entrar</h1>
        <p className="mt-1 text-sm text-slate-500">empresaA / empresaA · administracion / administracion</p>
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
        {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
        <button className="mt-6 w-full rounded-lg bg-ink py-2.5 font-semibold text-white hover:bg-slate-800">
          Acceder
        </button>
      </form>
    </div>
  );
}
