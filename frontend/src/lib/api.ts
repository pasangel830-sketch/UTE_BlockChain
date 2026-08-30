export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
  const headers: Record<string, string> = {
    ...(init.body ? { 'content-type': 'application/json' } : {}),
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

export async function login(username: string, password: string): Promise<string> {
  const data = await api<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  return data.token;
}
