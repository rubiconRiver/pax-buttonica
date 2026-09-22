/** This browser's secret as a host: whoever holds it owns the room, the published table and the saved game. */
const KEY = 'pb.room.key.v1';

export function hostKey(): string {
  let key = localStorage.getItem(KEY);
  if (!key) localStorage.setItem(KEY, (key = crypto.randomUUID()));
  return key;
}

/** The dev server has no /api: anything that isn't JSON is "no site here", not an error. */
export async function apiJson<T = unknown>(url: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(url, init);
  if (!(res.headers.get('content-type') ?? '').includes('json')) return null;
  if (!res.ok) throw Object.assign(new Error(`${res.status} ${url}`), { status: res.status });
  return (await res.json()) as T;
}
