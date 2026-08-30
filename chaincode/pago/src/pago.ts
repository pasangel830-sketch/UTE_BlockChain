export const ESTADOS_PAGO = ['CUSTODIA', 'AUTORIZADO', 'RECHAZADO'] as const;
export type EstadoPago = (typeof ESTADOS_PAGO)[number];

export const PARTICIPACIONES_DEFAULT: Record<string, number> = {
  EmpresaA: 35,
  EmpresaB: 25,
  EmpresaC: 20,
  EmpresaD: 20,
};

export interface Pago {
  id: string;
  hitoId: string;
  empresa: string;
  importeTotal: number;
  participaciones: Record<string, number>;
  desglose: Record<string, number>;
  estado: EstadoPago;
  createdAt: string;
  updatedAt: string;
}

export function repartir(importe: number, parts: Record<string, number>): Record<string, number> {
  const entries = Object.entries(parts);
  const totalPct = entries.reduce((s, [, p]) => s + p, 0);
  if (totalPct !== 100) {
    throw new Error(`participaciones deben sumar 100, suman ${totalPct}`);
  }
  const desglose: Record<string, number> = {};
  let allocated = 0;
  for (let i = 0; i < entries.length; i++) {
    const [org, pct] = entries[i];
    if (i === entries.length - 1) {
      desglose[org] = Math.round((importe - allocated) * 100) / 100;
    } else {
      const v = Math.round(importe * pct) / 100;
      desglose[org] = v;
      allocated += v;
    }
  }
  return desglose;
}
