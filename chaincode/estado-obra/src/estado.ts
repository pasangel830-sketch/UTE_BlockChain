export interface EstadoObra {
  id: string;
  hitosTotal: number;
  hitosCompletados: number;
  hitosRechazados: number;
  pagosCustodia: number;
  pagosAutorizados: number;
  importeCustodia: number;
  importeAutorizado: number;
  incidenciasAbiertas: number;
  incidenciasCerradas: number;
  avancePct: number;
  updatedAt: string;
}

export const ESTADO_VACIO: Omit<EstadoObra, 'updatedAt'> = {
  id: 'obra',
  hitosTotal: 0,
  hitosCompletados: 0,
  hitosRechazados: 0,
  pagosCustodia: 0,
  pagosAutorizados: 0,
  importeCustodia: 0,
  importeAutorizado: 0,
  incidenciasAbiertas: 0,
  incidenciasCerradas: 0,
  avancePct: 0,
};
