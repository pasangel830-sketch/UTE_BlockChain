'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { ErrorBox } from '@/components/ErrorBox';
import { LOGIN_ACCOUNTS } from '@/lib/orgs';
import { BrandLockup } from '@/components/Brand';

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
    <div className="login-stage flex min-h-screen flex-col">
      <div className="h-1.5 bg-gradient-to-r from-gold via-amberx to-ink" />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md animate-page-in rounded-2xl border border-gold/40 bg-paper p-8 shadow-official-lg"
        >
          <BrandLockup size="md" />
          <div className="gold-rule my-5 animate-hairline" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amberx">
            Convenio de colaboración
          </p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-ink">Acceso institucional</h1>
          <p className="mt-2 text-sm text-slate-600">
            UTE Blockchain Solutions y Ayuntamiento de Madrid · registro de obra pública
          </p>
          <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
            {LOGIN_ACCOUNTS.map((a) => (
              <li key={a.org}>
                <button
                  type="button"
                  className="rounded-md px-1 font-mono text-slate-600 underline-offset-2 hover:bg-cream hover:text-ink hover:underline"
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
          <label className="mt-6 block text-sm font-medium">Usuario</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <label className="mt-4 block text-sm font-medium">Contraseña</label>
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <ErrorBox error={err} />
          <button className="mt-6 w-full rounded-lg bg-ink py-2.5 font-semibold text-white hover:bg-[#12345a]">
            Acceder
          </button>
        </form>
      </div>
      <p className="pb-5 text-center text-[11px] uppercase tracking-[0.16em] text-gold/80">
        UTE Blockchain Solutions · Ayuntamiento de Madrid
      </p>
    </div>
  );
}
