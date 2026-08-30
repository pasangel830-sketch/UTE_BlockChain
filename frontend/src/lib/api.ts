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
    const err = data as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
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
