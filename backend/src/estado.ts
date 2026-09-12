type Hito = { id?: string; estado?: string };
type Pago = { estado?: string; importeTotal?: number; hitoId?: string };
type Incidencia = { estado?: string };

export function agregarEstado(
  hitos: Hito[],
  pagos: Pago[],
  incidencias: Incidencia[],
): Record<string, number | string> {
  const hitoConPagoRechazado = new Set(
    pagos.filter((p) => p.estado === 'RECHAZADO' && p.hitoId).map((p) => p.hitoId),
  );
  const hitosVigentes = hitos.filter((h) => !hitoConPagoRechazado.has(h.id));
  const hitosCompletados = hitosVigentes.filter((h) => h.estado === 'COMPLETADO').length;
  const hitosRechazados = hitos.filter(
    (h) => h.estado === 'RECHAZADO' || hitoConPagoRechazado.has(h.id),
  ).length;
  const hitosTotal = hitosVigentes.length;
  const pagosCustodia = pagos.filter((p) => p.estado === 'CUSTODIA');
  const pagosAutorizados = pagos.filter((p) => p.estado === 'AUTORIZADO');
  const incidenciasAbiertas = incidencias.filter(
    (i) => i.estado === 'ABIERTA' || i.estado === 'EN_TRATAMIENTO',
  ).length;
  const incidenciasCerradas = incidencias.filter((i) => i.estado === 'CERRADA').length;
  const avancePct = hitosTotal === 0 ? 0 : Math.round((hitosCompletados / hitosTotal) * 100);
  return {
    id: 'obra',
    hitosTotal,
    hitosCompletados,
    hitosRechazados,
    pagosCustodia: pagosCustodia.length,
    pagosAutorizados: pagosAutorizados.length,
    importeCustodia: pagosCustodia.reduce((s, p) => s + Number(p.importeTotal || 0), 0),
    importeAutorizado: pagosAutorizados.reduce((s, p) => s + Number(p.importeTotal || 0), 0),
    incidenciasAbiertas,
    incidenciasCerradas,
    avancePct,
  };
}
