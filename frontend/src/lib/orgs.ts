export type OrgProfile = {
  org: string;
  username: string;
  label: string;
  oficio: string;
  /** Valor que espera el chaincode en el campo `empresa`. Administración no ejecuta obra. */
  empresa: string | null;
  lote: string | null;
  pct: number | null;
};

export const ORG_PROFILES: Record<string, OrgProfile> = {
  EmpresaAMSP: {
    org: 'EmpresaAMSP',
    username: 'empresaA',
    label: 'Empresa A',
    oficio: 'Cimentación / obra gruesa',
    empresa: 'EmpresaA',
    lote: 'obra-gruesa-solar',
    pct: 35,
  },
  EmpresaCMSP: {
    org: 'EmpresaCMSP',
    username: 'empresaC',
    label: 'Empresa C',
    oficio: 'Cimentación / obra gruesa (socia A)',
    empresa: 'EmpresaC',
    lote: 'obra-gruesa-solar',
    pct: 20,
  },
  EmpresaBMSP: {
    org: 'EmpresaBMSP',
    username: 'empresaB',
    label: 'Empresa B',
    oficio: 'Quirófanos / instalaciones',
    empresa: 'EmpresaB',
    lote: 'quirofanos-tech',
    pct: 25,
  },
  EmpresaDMSP: {
    org: 'EmpresaDMSP',
    username: 'empresaD',
    label: 'Empresa D',
    oficio: 'Quirófanos / instalaciones (socia B)',
    empresa: 'EmpresaD',
    lote: 'quirofanos-tech',
    pct: 20,
  },
  AdministracionMSP: {
    org: 'AdministracionMSP',
    username: 'administracion',
    label: 'Administración',
    oficio: 'Ayuntamiento — autoriza pagos',
    empresa: null,
    lote: null,
    pct: null,
  },
};

export const LOGIN_ACCOUNTS = Object.values(ORG_PROFILES);

/** MSP con peer arrancado en la red diaria (`make up-dev`). */
export const ORGS_PEER_DIARIO = ['EmpresaAMSP', 'AdministracionMSP'];

export const SOCIOS_LOTE: Record<string, string[]> = {
  'obra-gruesa-solar': ['EmpresaAMSP', 'EmpresaCMSP'],
  'quirofanos-tech': ['EmpresaBMSP', 'EmpresaDMSP'],
};

export function profileOf(org: string | undefined | null): OrgProfile | null {
  if (!org) return null;
  return ORG_PROFILES[org] ?? null;
}

export function profileLabel(org: string | undefined | null): string {
  const p = profileOf(org);
  if (!p) return org || '';
  const parts = [p.label, p.lote ? `${p.oficio} (${p.lote})` : p.oficio];
  if (p.pct !== null) parts.push(`${p.pct} %`);
  return parts.join(' · ');
}

/** El propio nodo de esta org no arranca con `make up-dev`; entra por el peer de Empresa A. */
export function orgSinPeerDiario(org: string | null | undefined): boolean {
  return Boolean(org) && !ORGS_PEER_DIARIO.includes(org as string);
}

export function sociosLabel(lote: string | null | undefined, union = ' o '): string {
  return (SOCIOS_LOTE[lote ?? ''] ?? [])
    .map((o) => ORG_PROFILES[o]?.label ?? o)
    .join(union);
}

/** Escribir la PDC de este lote necesita `make pdc-up`: ningún socio tiene peer en la red diaria. */
export function lotePdcApagada(lote: string | null | undefined): boolean {
  if (!lote) return false;
  const socios = SOCIOS_LOTE[lote] ?? [];
  return !socios.some((o) => ORGS_PEER_DIARIO.includes(o));
}
