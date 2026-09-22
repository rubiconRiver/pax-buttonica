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
  /** Rooms as api/room.ts keeps them: what the host last wrote, and the phones' inbox. */
  rooms = new Map<string, { key: string; data: any; updatedAt: number }>();
  inbox: { seq: number; code: string; data: any }[] = [];
  games = new Map<string, { code: string | null; game: any; updatedAt: number }>();
  requests: { method: string; url: string; body?: any }[] = [];
  online = true;
  private seq = 0;

  async install(context: BrowserContext) {
    await context.route('**/api/profiles**', (r) => this.handle(r, 'profiles'));
    await context.route('**/api/clips**', (r) => this.handle(r, 'clips'));
    await context.route('**/api/room**', (r) => this.room(r));
    await context.route('**/api/game**', (r) => this.game(r));
  }

  private async room(route: Route) {
    const req = route.request();
    if (!this.online) return route.abort('internetdisconnected');
    const url = new URL(req.url());
    const code = (url.searchParams.get('code') ?? '').toUpperCase();
    const key = url.searchParams.get('key');
    const method = req.method();
    this.requests.push({ method, url: req.url(), body: method === 'GET' ? undefined : req.postDataJSON() });
    const room = this.rooms.get(code);
    if (method === 'PUT') {
      if (room && room.key !== key) return route.fulfill({ status: 403, json: { error: 'That code belongs to another table.' } });
      this.rooms.set(code, { key: key!, data: req.postDataJSON(), updatedAt: Date.now() });
      return route.fulfill({ json: { ok: true } });
    }
    if (method === 'GET' && key) {
      if (!room) return route.fulfill({ status: 404, json: { error: 'No room with that code.' } });
      if (room.key !== key) return route.fulfill({ status: 403, json: { error: 'That code belongs to another table.' } });
      const after = Number(url.searchParams.get('after') ?? 0);
      return route.fulfill({ json: { inbox: this.inbox.filter((m) => m.code === code && m.seq > after).map(({ seq, data }) => ({ seq, data })) } });
    }
    if (method === 'GET') {
      if (!room) return route.fulfill({ status: 404, json: { error: 'No room with that code.' } });
      const dev = url.searchParams.get('dev')!;
      return route.fulfill({ json: { table: room.data.table ?? null, profiles: room.data.profiles ?? [], phone: room.data.phones?.[dev] ?? null, updatedAt: room.updatedAt } });
    }
    if (method === 'POST') {
      if (!room) return route.fulfill({ status: 404, json: { error: 'No room with that code.' } });
      this.inbox.push({ seq: ++this.seq, code, data: req.postDataJSON() });
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ status: 405, json: { error: 'method' } });
  }

  private async game(route: Route) {
    const req = route.request();
    if (!this.online) return route.abort('internetdisconnected');
    const url = new URL(req.url());
    const key = url.searchParams.get('key')!;
    const method = req.method();
    this.requests.push({ method, url: req.url(), body: method === 'PUT' ? req.postDataJSON() : undefined });
    if (method === 'GET') {
      const code = (url.searchParams.get('code') ?? '').toUpperCase();
      if (code) {
        const found = [...this.games.entries()].filter(([, g]) => g.code === code).sort((a, b) => b[1].updatedAt - a[1].updatedAt)[0];
        if (!found) return route.fulfill({ status: 404, json: { error: 'No game with that code.' } });
        const [owner, g] = found;
        if (owner !== key) {
          this.games.delete(owner);
          this.games.set(key, g);
          for (const r of this.rooms.values()) if (r.key === owner) r.key = key;
        }
        return route.fulfill({ json: { game: g.game, code, updatedAt: g.updatedAt } });
      }
      const g = this.games.get(key);
      if (!g) return route.fulfill({ status: 404, json: { error: 'No saved game.' } });
      return route.fulfill({ json: { game: g.game, code: g.code, updatedAt: g.updatedAt } });
    }
    if (method === 'PUT') {
      const b = req.postDataJSON();
      const room = b.code ? this.rooms.get(b.code) : undefined;
      if (room && room.key !== key) return route.fulfill({ status: 403, json: { error: 'This game was picked up on another laptop.' } });
      this.games.set(key, { code: b.code ?? null, game: b.game, updatedAt: Date.now() });
      return route.fulfill({ json: { ok: true, updatedAt: Date.now() } });
    }
    if (method === 'DELETE') {
      this.games.delete(key);
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ status: 405, json: { error: 'method' } });
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
