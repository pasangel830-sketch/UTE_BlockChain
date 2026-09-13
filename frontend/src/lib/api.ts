export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function formatFecha(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function porFechaDesc<T extends { createdAt?: string; at?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.createdAt || b.at || '').localeCompare(a.createdAt || a.at || ''));
}

const TOKEN_KEY = 'ute-token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export type Session = { username: string; org: string };

export function decodeToken(token?: string | null): Record<string, unknown> | null {
  const t = token ?? getToken();
  if (!t) return null;
  const part = t.split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  const payload = decodeToken();
  if (!payload) return null;
  const { sub, org } = payload as { sub?: string; org?: string };
  if (!sub || !org) return null;
  return { username: sub, org };
}

/** Error de la API con el texto humano en `message` y el crudo de Fabric en `detalle`. */
export class ApiError extends Error {
  readonly detalle: string;
  readonly codigo: string;
  readonly nota?: string;
  readonly status: number;

  constructor(
    message: string,
    opts: { detalle?: string; codigo?: string; nota?: string; status: number },
  ) {
    super(message);
    this.name = 'ApiError';
    this.detalle = opts.detalle || '';
    this.codigo = opts.codigo || 'ERROR_INTERNO';
    this.nota = opts.nota;
    this.status = opts.status;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(init.body && !isForm ? { 'content-type': 'application/json' } : {}),
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const err = data as { error?: string; detalle?: string; codigo?: string; nota?: string };
    throw new ApiError(err.error || `HTTP ${res.status}`, {
      detalle: err.detalle,
      codigo: err.codigo,
      nota: err.nota,
      status: res.status,
    });
  }
  return data as T;
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  const err = data as { error?: string; detalle?: string; codigo?: string; nota?: string };
  throw new ApiError(err.error || `HTTP ${res.status}`, {
    detalle: err.detalle,
    codigo: err.codigo,
    nota: err.nota,
    status: res.status,
  });
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const token = getToken();
  const body = new FormData();
  body.append('file', file);
  const headers: Record<string, string> = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body });
  await throwIfNotOk(res);
  return (await res.json()) as T;
}

export async function apiBlob(path: string): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) {
    await throwIfNotOk(res);
  }
  return res.blob();
}

export async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function login(username: string, password: string): Promise<string> {
  const data = await api<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  return data.token;
}
