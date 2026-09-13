export function Badge({ estado }: { estado: string }) {
  const color: Record<string, string> = {
    PENDIENTE: 'bg-slate-200 text-slate-800',
    EN_EJECUCION: 'bg-sky-100 text-sky-900',
    VALIDACION: 'border border-gold/50 bg-cream text-[#7A5A2A]',
    COMPLETADO: 'bg-emerald-100 text-emerald-900',
    RECHAZADO: 'bg-rose-100 text-rose-900',
    RECHAZADA: 'bg-rose-100 text-rose-900',
    CUSTODIA: 'bg-ink/10 text-ink',
    AUTORIZADO: 'bg-emerald-100 text-emerald-900',
    ABIERTA: 'border border-gold/50 bg-cream text-[#7A5A2A]',
    EN_TRATAMIENTO: 'bg-sky-100 text-sky-900',
    CERRADA: 'bg-slate-200 text-slate-800',
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${color[estado] || 'bg-slate-100'}`}
    >
      {estado}
    </span>
  );
}
