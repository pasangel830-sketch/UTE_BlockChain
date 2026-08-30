import { OrgMsp } from './config';

export const LOTES = ['obra-gruesa-solar', 'quirofanos-tech'] as const;
export type Lote = (typeof LOTES)[number];

export type PerfilOrg = {
  org: OrgMsp;
  label: string;
  rol: string;
  empresa: string | null;
  lote: Lote | null;
};

export const PERFILES: Record<OrgMsp, PerfilOrg> = {
  EmpresaAMSP: {
    org: 'EmpresaAMSP',
    label: 'Empresa A',
    rol: 'constructora',
    empresa: 'EmpresaA',
    lote: 'obra-gruesa-solar',
  },
  EmpresaBMSP: {
    org: 'EmpresaBMSP',
    label: 'Empresa B',
    rol: 'constructora',
    empresa: 'EmpresaB',
    lote: 'quirofanos-tech',
  },
  EmpresaCMSP: {
    org: 'EmpresaCMSP',
    label: 'Empresa C',
    rol: 'constructora',
    empresa: 'EmpresaC',
    lote: 'obra-gruesa-solar',
  },
  EmpresaDMSP: {
    org: 'EmpresaDMSP',
    label: 'Empresa D',
    rol: 'constructora',
    empresa: 'EmpresaD',
    lote: 'quirofanos-tech',
  },
  AdministracionMSP: {
    org: 'AdministracionMSP',
    label: 'Administración',
    rol: 'ayuntamiento',
    empresa: null,
    lote: null,
  },
};

export const SOCIOS_LOTE: Record<Lote, OrgMsp[]> = {
  'obra-gruesa-solar': ['EmpresaAMSP', 'EmpresaCMSP'],
  'quirofanos-tech': ['EmpresaBMSP', 'EmpresaDMSP'],
};

/** MSP con peer arrancado en la red diaria (`make up-dev`). El resto exige `make pdc-up`. */
export const ORGS_PEER_DIARIO: OrgMsp[] = ['EmpresaAMSP', 'AdministracionMSP'];

export function perfilDe(org: string | undefined | null): PerfilOrg | null {
  if (!org) return null;
  return PERFILES[org as OrgMsp] ?? null;
}

export function etiquetaOrg(org: string | undefined | null): string {
  return perfilDe(org)?.label ?? org ?? 'Tu sesión';
}

export function esLote(lote: unknown): lote is Lote {
  return typeof lote === 'string' && (LOTES as readonly string[]).includes(lote);
}

export function sociosDe(lote: Lote): OrgMsp[] {
  return SOCIOS_LOTE[lote];
}

export function etiquetaSocios(lote: Lote, union = ' o '): string {
  return sociosDe(lote)
    .map((o) => PERFILES[o].label)
    .join(union);
}

/** Orgs a las que pedir endoso al escribir en la colección privada de un lote. */
export function endosantesDeLote(lote: Lote): string[] {
  return [...sociosDe(lote).slice(0, 1), 'AdministracionMSP'];
}

/** Ningún socio del lote tiene peer en la red diaria: escribir su PDC exige `make pdc-up`. */
export function loteSinPeerDiario(lote: Lote): boolean {
  return !sociosDe(lote).some((o) => ORGS_PEER_DIARIO.includes(o));
}

export const RESUMEN_SOCIOS = LOTES.map(
  (l) =>
    `${l} (${sociosDe(l)
      .map((o) => PERFILES[o].label.replace('Empresa ', ''))
      .join(' y ')})`,
).join(', ');
