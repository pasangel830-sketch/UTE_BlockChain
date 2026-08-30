type Hito = { estado?: string };
type Pago = { estado?: string; importeTotal?: number };
type Incidencia = { estado?: string };

export function agregarEstado(
  hitos: Hito[],
  pagos: Pago[],
  incidencias: Incidencia[],
): Record<string, number | string> {
  const hitosCompletados = hitos.filter((h) => h.estado === 'COMPLETADO').length;
  const hitosRechazados = hitos.filter((h) => h.estado === 'RECHAZADO').length;
  const hitosTotal = hitos.length;
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
