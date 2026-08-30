'use client';

import { ApiError } from '@/lib/api';

/** Rechazos por regla de negocio: la red funcionó, dijo que no. Se pintan en ámbar. */
const RECHAZOS = new Set([
  'ROL_NO_AUTORIZADO',
  'PDC_NO_SOCIO',
  'PDC_SIN_ACCESO',
  'TRANSICION_INVALIDA',
  'DUPLICADO',
  'NO_ENCONTRADO',
  'DATO_INVALIDO',
  'CONFLICTO_CONCURRENCIA',
  'SESION_CADUCADA',
  'SIN_SESION',
  'CREDENCIALES',
]);

const TITULO: Record<string, string> = {
  ROL_NO_AUTORIZADO: 'Rechazado por separación de funciones',
  PDC_NO_SOCIO: 'Rechazado por la red: no eres socio del lote',
  PDC_SIN_ACCESO: 'Sin acceso a los datos privados de este lote',
  TRANSICION_INVALIDA: 'Transición de estado no permitida',
  DUPLICADO: 'Identificador ya usado',
  NO_ENCONTRADO: 'No está en el registro',
  CONFLICTO_CONCURRENCIA: 'Conflicto de concurrencia',
  PDC_SIN_PEER: 'Ahora no se puede: falta el nodo de un socio',
  RED_NO_DISPONIBLE: 'Ahora no se puede: la red no responde',
  ENDOSO_INSUFICIENTE: 'Ahora no se puede: faltan firmas',
};

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) {
    return null;
  }
  const api = error instanceof ApiError ? error : null;
  const codigo = api?.codigo ?? 'ERROR_INTERNO';
  const mensaje = error instanceof Error ? error.message : String(error);
  const esRechazo = RECHAZOS.has(codigo);
  const tono = esRechazo
    ? 'border-amber-300 bg-amber-50 text-amber-900'
    : 'border-rose-300 bg-rose-50 text-rose-900';

  return (
    <div className={`mt-3 rounded-xl border p-3 text-sm ${tono}`} role="alert">
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
        {TITULO[codigo] ?? 'No se ha podido completar'}
      </p>
      <p className="mt-1">{mensaje}</p>
      {api?.nota && <p className="mt-1 text-xs text-slate-500">{api.nota}</p>}
      {api?.detalle && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-slate-500">Detalle técnico</summary>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-2 text-[11px] leading-snug text-slate-100">
            {api.detalle}
          </pre>
        </details>
      )}
    </div>
  );
}
