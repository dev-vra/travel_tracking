import { Analise, AnaliseResumo } from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  criarAnalise: (texto: string) =>
    req<{ id: string; status: string }>('/analises', {
      method: 'POST',
      body: JSON.stringify({ texto }),
    }),
  listar: () => req<AnaliseResumo[]>('/analises'),
  obter: (id: string) => req<Analise>(`/analises/${id}`),
};
