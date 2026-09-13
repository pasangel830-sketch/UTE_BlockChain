import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import { config } from './config';

export type EvidenciaMeta = {
  id: string;
  parentId: string;
  incidenciaId: string;
  nombre: string;
  sha256: string;
  size: number;
  mime: string;
  org: string;
  at: string;
  storedAs: string;
};

export type EvidenciaPublica = Omit<EvidenciaMeta, 'storedAs'>;

type Indice = Record<string, EvidenciaMeta[]>;

function indexPath(): string {
  return path.join(config.uploadDir, 'index.json');
}

function assertDriver(): void {
  if (config.storageDriver !== 'local' && config.storageDriver !== 'gcs') {
    throw new Error(`STORAGE_DRIVER no soportado: ${config.storageDriver}`);
  }
  if (config.storageDriver === 'gcs' && !config.gcsBucket) {
    throw new Error('GCS_BUCKET obligatorio con STORAGE_DRIVER=gcs');
  }
}

let gcsStorage: Storage | undefined;

function gcsBucket() {
  if (!gcsStorage) {
    gcsStorage = new Storage();
  }
  return gcsStorage.bucket(config.gcsBucket);
}

async function putBlob(storedAs: string, buf: Buffer, mime: string): Promise<void> {
  if (config.storageDriver === 'gcs') {
    await gcsBucket().file(storedAs).save(buf, {
      resumable: false,
      contentType: mime || 'application/octet-stream',
    });
    return;
  }
  const dest = path.join(config.uploadDir, storedAs);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buf);
}

async function getBlob(storedAs: string): Promise<Buffer | null> {
  if (config.storageDriver === 'gcs') {
    try {
      const [buf] = await gcsBucket().file(storedAs).download();
      return buf;
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 404) {
        return null;
      }
      throw err;
    }
  }
  const root = path.resolve(config.uploadDir);
  const abs = path.resolve(root, storedAs);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    return null;
  }
  try {
    return await fs.readFile(abs);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

export async function saveLocal(filename: string, buf: Buffer): Promise<string> {
  assertDriver();
  const storedAs = filename.replace(/^\/+/, '');
  await putBlob(storedAs, buf, 'application/octet-stream');
  if (config.storageDriver === 'gcs') {
    return `gs://${config.gcsBucket}/${storedAs}`;
  }
  return path.join(config.uploadDir, storedAs);
}

export function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function nombreSeguro(original: string): string {
  const base = path.basename(original).replace(/[^a-zA-Z0-9._-]/g, '_');
  return (base || 'evidencia').slice(0, 80);
}

export function idIncidenciaSeguro(id: string): string | null {
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(id)) {
    return null;
  }
  return id;
}

function parentDe(meta: Partial<EvidenciaMeta>): string {
  return meta.parentId || meta.incidenciaId || '';
}

function publica(meta: EvidenciaMeta): EvidenciaPublica {
  const parentId = parentDe(meta);
  const { storedAs: _omit, ...rest } = meta;
  return { ...rest, parentId, incidenciaId: parentId };
}

async function leerIndice(): Promise<Indice> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw) as Indice;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

async function escribirIndice(idx: Indice): Promise<void> {
  await fs.mkdir(config.uploadDir, { recursive: true });
  await fs.writeFile(indexPath(), JSON.stringify(idx, null, 2));
}

export async function guardarEvidencia(
  parentId: string,
  originalname: string,
  buf: Buffer,
  mime: string,
  org: string,
): Promise<EvidenciaPublica> {
  assertDriver();
  const iid = idIncidenciaSeguro(parentId);
  if (!iid) {
    throw new Error('incidenciaId inválido');
  }
  const nombre = nombreSeguro(originalname);
  const id = `E-${Date.now()}`;
  const storedAs = path.posix.join(iid, `${id}-${nombre}`);
  await putBlob(storedAs, buf, mime || 'application/octet-stream');
  const meta: EvidenciaMeta = {
    id,
    parentId: iid,
    incidenciaId: iid,
    nombre,
    sha256: sha256Hex(buf),
    size: buf.length,
    mime: mime || 'application/octet-stream',
    org,
    at: new Date().toISOString(),
    storedAs,
  };
  const idx = await leerIndice();
  idx[iid] = [...(idx[iid] || []), meta];
  await escribirIndice(idx);
  return publica(meta);
}

export async function listarEvidencias(parentId: string): Promise<EvidenciaPublica[]> {
  const iid = idIncidenciaSeguro(parentId);
  if (!iid) {
    return [];
  }
  const idx = await leerIndice();
  return (idx[iid] || [])
    .map(publica)
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export async function listarIndiceEvidencias(): Promise<Record<string, EvidenciaPublica[]>> {
  const idx = await leerIndice();
  const out: Record<string, EvidenciaPublica[]> = {};
  for (const [id, items] of Object.entries(idx)) {
    out[id] = (items || [])
      .map(publica)
      .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  }
  return out;
}

export async function leerEvidencia(
  parentId: string,
  evidenciaId: string,
): Promise<{ meta: EvidenciaPublica; body: Buffer } | null> {
  const iid = idIncidenciaSeguro(parentId);
  const eid = idIncidenciaSeguro(evidenciaId);
  if (!iid || !eid) {
    return null;
  }
  const idx = await leerIndice();
  const meta = (idx[iid] || []).find((e) => e.id === eid);
  if (!meta) {
    return null;
  }
  const body = await getBlob(meta.storedAs);
  if (!body) {
    return null;
  }
  return { meta: publica(meta), body };
}
