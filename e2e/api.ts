import type { BrowserContext, Route } from '@playwright/test';

export interface Row {
  id: string;
  name?: string;
  color?: string;
  updatedAt: number;
  deleted?: boolean;
  [k: string]: unknown;
}

/**
 * The site's database, in a dozen lines. It answers /api/profiles and /api/clips the way the real functions in
 * api/ do (same shapes, same newest-wins rule), and keeps a record of every request so tests can see the traffic.
 */
export class FakeApi {
  rows = new Map<string, Row>();
  clips = new Map<string, { type: string; bytes: number; name: string }>();
  requests: { method: string; url: string; body?: any }[] = [];
  online = true;

  async install(context: BrowserContext) {
    await context.route('**/api/profiles**', (r) => this.handle(r, 'profiles'));
    await context.route('**/api/clips**', (r) => this.handle(r, 'clips'));
  }

  put(row: Row) {
    this.rows.set(row.id, row);
  }

  private async handle(route: Route, what: 'profiles' | 'clips') {
    const req = route.request();
    const url = new URL(req.url());
    if (!this.online) return route.abort('internetdisconnected');
    const method = req.method();
    this.requests.push({ method, url: req.url(), body: method === 'PUT' ? req.postDataJSON() : undefined });

    if (what === 'clips') {
      if (method === 'POST') {
        this.clips.set(url.searchParams.get('id')!, { type: req.headers()['content-type'] ?? '', bytes: req.postDataBuffer()?.length ?? 0, name: url.searchParams.get('name') ?? '' });
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ status: 404, json: { error: 'not found' } });
    }

    if (method === 'GET') return route.fulfill({ json: { profiles: [...this.rows.values()] } });
    if (method === 'PUT') {
      const p = req.postDataJSON().profile as Row;
      const mine = this.rows.get(p.id);
      if (!mine || p.updatedAt > mine.updatedAt) this.rows.set(p.id, p);
      return route.fulfill({ json: { ok: true } });
    }
    if (method === 'DELETE') {
      const id = url.searchParams.get('id')!;
      // A tombstone newer than anything a browser could hold, whatever clock the browser is on.
      this.rows.set(id, { id, updatedAt: (this.rows.get(id)?.updatedAt ?? 0) + 1, deleted: true });
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ status: 405, json: { error: 'method' } });
  }

  named(name: string): Row | undefined {
    return [...this.rows.values()].find((r) => r.name === name && !r.deleted);
  }
}

export const profileRow = (id: string, name: string, color: string, updatedAt: number): Row => ({
  id,
  name,
  color,
  faction: 'The Nomad',
  intro: { kind: 'jingle', id: 'herald' },
  outro: { kind: 'jingle', id: 'sealed' },
  buttons: 1,
  updatedAt,
});
