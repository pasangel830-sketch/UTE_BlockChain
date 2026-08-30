export const ESTADOS_INCIDENCIA = ['ABIERTA', 'EN_TRATAMIENTO', 'CERRADA', 'RECHAZADA'] as const;
export type EstadoIncidencia = (typeof ESTADOS_INCIDENCIA)[number];

export const LOTES = ['obra-gruesa-solar', 'quirofanos-tech'] as const;
export type Lote = (typeof LOTES)[number];

export const TRANSICIONES: Record<string, EstadoIncidencia[]> = {
  ABIERTA: ['EN_TRATAMIENTO', 'RECHAZADA'],
  EN_TRATAMIENTO: ['CERRADA', 'RECHAZADA'],
  CERRADA: [],
  RECHAZADA: [],
};

export const COLECCION_MSP: Record<Lote, readonly string[]> = {
  'obra-gruesa-solar': ['EmpresaAMSP', 'EmpresaCMSP'],
  'quirofanos-tech': ['EmpresaBMSP', 'EmpresaDMSP'],
};

export interface Incidencia {
  id: string;
  titulo: string;
  empresa: string;
  lote: Lote;
  estado: EstadoIncidencia;
  motivo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DetallePrivado {
  detalle: string;
  costeEstimado: number;
  notasTecnicas: string;
}

export function assertLote(lote: string): asserts lote is Lote {
  if (!(LOTES as readonly string[]).includes(lote)) {
    throw new Error(`lote inválido: ${lote}`);
  }
}

export function mspPuedeColeccion(msp: string, lote: Lote): boolean {
  return COLECCION_MSP[lote].includes(msp);
}
