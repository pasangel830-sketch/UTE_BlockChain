export function Badge({ estado }: { estado: string }) {
  const color: Record<string, string> = {
    PENDIENTE: 'bg-slate-200 text-slate-800',
    EN_EJECUCION: 'bg-sky-100 text-sky-800',
    VALIDACION: 'bg-amber-100 text-amber-900',
    COMPLETADO: 'bg-emerald-100 text-emerald-800',
    RECHAZADO: 'bg-rose-100 text-rose-800',
    RECHAZADA: 'bg-rose-100 text-rose-800',
    CUSTODIA: 'bg-violet-100 text-violet-800',
    AUTORIZADO: 'bg-emerald-100 text-emerald-800',
    ABIERTA: 'bg-amber-100 text-amber-900',
    EN_TRATAMIENTO: 'bg-sky-100 text-sky-800',
    CERRADA: 'bg-slate-200 text-slate-800',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color[estado] || 'bg-slate-100'}`}>
      {estado}
    </span>
  );
}
