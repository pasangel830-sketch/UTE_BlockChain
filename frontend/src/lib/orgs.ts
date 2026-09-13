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

export function profileLines(org: string | undefined | null): { title: string; subtitle: string } {
  const p = profileOf(org);
  if (!p) return { title: org || '', subtitle: '' };

  const extra = p.oficio.match(/^(.*?)\s+(\([^)]+\))$/);
  const oficioMain = extra ? extra[1] : p.oficio;
  const oficioTag = extra?.[2];

  if (!p.lote && p.pct === null) {
    return { title: p.label, subtitle: p.oficio };
  }

  const bits: string[] = [];
  if (oficioTag) bits.push(oficioTag);
  if (p.lote) bits.push(`(${p.lote})`);
  const subtitle =
    p.pct !== null ? (bits.length ? `${bits.join(' ')} · ${p.pct} %` : `${p.pct} %`) : bits.join(' ');

  return { title: `${p.label} · ${oficioMain}`, subtitle };
}

export function profileLabel(org: string | undefined | null): string {
  const { title, subtitle } = profileLines(org);
  return subtitle ? `${title} ${subtitle}` : title;
}

/** El propio nodo de esta org no está vivo. `vivos` null = aún no se ha sondeado. */
export function orgSinPeerDiario(org: string | null | undefined, vivos: string[] | null): boolean {
  if (!org || !vivos) return false;
  return !vivos.includes(org);
}

export function sociosLabel(lote: string | null | undefined, union = ' o '): string {
  return (SOCIOS_LOTE[lote ?? ''] ?? [])
    .map((o) => ORG_PROFILES[o]?.label ?? o)
    .join(union);
}

/** Escribir la PDC de este lote necesita `make pdc-up`: ningún socio tiene peer vivo. */
export function lotePdcApagada(lote: string | null | undefined, vivos: string[] | null): boolean {
  if (!lote || !vivos) return false;
  const socios = SOCIOS_LOTE[lote] ?? [];
  return !socios.some((o) => vivos.includes(o));
}
