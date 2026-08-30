export const ESTADOS_HITO = [
  'PENDIENTE',
  'EN_EJECUCION',
  'VALIDACION',
  'COMPLETADO',
  'RECHAZADO',
] as const;

export type EstadoHito = (typeof ESTADOS_HITO)[number];

export const EMPRESAS = ['EmpresaA', 'EmpresaB', 'EmpresaC', 'EmpresaD'] as const;
export type Empresa = (typeof EMPRESAS)[number];

export interface Hito {
  id: string;
  titulo: string;
  descripcion: string;
  empresa: Empresa;
  importe: number;
  estado: EstadoHito;
  motivoRechazo?: string;
  createdAt: string;
  updatedAt: string;
}

export const TRANSICIONES: Record<string, EstadoHito[]> = {
  PENDIENTE: ['EN_EJECUCION'],
  EN_EJECUCION: ['VALIDACION'],
  VALIDACION: ['COMPLETADO', 'RECHAZADO'],
  COMPLETADO: [],
  RECHAZADO: [],
};
