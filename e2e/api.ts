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
  /** Games as api/game.ts keeps them, and the phones' inbox as api/actions.ts keeps it. */
  games = new Map<string, { hostKey: string; seq: number; record: any; updatedAt: number }>();
  events = new Map<string, { at: number; action: any; auto?: true; noop?: true }[]>();
  actions: { seq: number; code: string; data: any; at: number }[] = [];
  requests: { method: string; url: string; body?: any }[] = [];
  online = true;
  private seq = 0;

  async install(context: BrowserContext) {
    await context.route('**/api/profiles**', (r) => this.handle(r, 'profiles'));
    await context.route('**/api/clips**', (r) => this.handle(r, 'clips'));
    await context.route('**/api/game**', (r) => this.game(r));
    await context.route('**/api/actions**', (r) => this.inbox(r));
    await context.route('**/api/button**', (r) => this.button(r));
  }

  /** api/button.ts: whose a real button is, and which game it is in. */
  private async button(route: Route) {
    if (!this.online) return route.abort('internetdisconnected');
    const tag = (dev: string) => dev.replace(/[^0-9a-z]/gi, '').toLowerCase();
    const id = tag(new URL(route.request().url()).searchParams.get('id') ?? '');
    const row = [...this.rows.values()].find((r) => !r.deleted && Array.isArray(r.buttonIds) && (r.buttonIds as string[]).includes(id));
    const owner = row ? { id: row.id, name: row.name } : null;
    let game = null;
    for (const [code, g] of [...this.games.entries()].sort((a, b) => b[1].updatedAt - a[1].updatedAt)) {
      const state = g.record.state;
      if (state.phase === 'finished') continue;
      const bound = (state.bindings as (string | null)[]).findIndex((b) => b && tag(b) === id);
      const seat = bound >= 0 ? bound : owner ? state.players.findIndex((p: { profileId?: string }) => p.profileId === owner.id) : -1;
      if (seat < 0) continue;
      game = { code, seat, name: state.players[seat].name, profileId: state.players[seat].profileId ?? null, round: state.round, phase: state.phase };
      break;
    }
    return route.fulfill({ json: { id, owner, game } });
  }

  private async game(route: Route) {
    const req = route.request();
    if (!this.online) return route.abort('internetdisconnected');
    const url = new URL(req.url());
    const code = (url.searchParams.get('code') ?? '').toUpperCase();
    const key = url.searchParams.get('key');
    const method = req.method();
    this.requests.push({ method, url: req.url(), body: method === 'PUT' ? req.postDataJSON() : undefined });
    const g = this.games.get(code);
    if (method === 'GET' && !code) {
      const mine = [...this.games.entries()].filter(([, x]) => x.hostKey === key).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
      return route.fulfill({ json: { games: mine.map(([c, x]) => ({ code: c, seq: x.seq, updatedAt: x.updatedAt, players: x.record.state.players.map((p: { name: string }) => p.name), round: x.record.state.round, phase: x.record.state.phase })) } });
    }
    if (method === 'GET') {
      if (!g) return route.fulfill({ status: 404, json: { error: 'No game with that code.' } });
      const after = Number(url.searchParams.get('after'));
      if (Number.isFinite(after) && g.seq <= after) return route.fulfill({ status: 204, body: '' });
      if (url.searchParams.get('full')) return route.fulfill({ json: { seq: g.seq, record: g.record, events: this.events.get(code) ?? [], updatedAt: g.updatedAt } });
      const { base: _b, ...slim } = g.record;
      return route.fulfill({ json: { seq: g.seq, record: slim, updatedAt: g.updatedAt } });
    }
    if (method === 'PUT') {
      if (g && g.hostKey !== key) return route.fulfill({ status: 403, json: { error: 'This game belongs to another laptop.' } });
      const seq = (g?.seq ?? 0) + 1;
      const { events: incoming = [], eventCount, ...record } = req.postDataJSON();
      if (!record.base && g?.record.base) record.base = g.record.base;
      this.games.set(code, { hostKey: key!, seq, record, updatedAt: Date.now() });
      if (Number.isInteger(eventCount)) {
        const first = eventCount - incoming.length;
        const list = (this.events.get(code) ?? []).slice(0, Math.max(0, first));
        list.push(...incoming);
        this.events.set(code, list);
      }
      return route.fulfill({ json: { ok: true, seq } });
    }
    if (method === 'POST' && url.searchParams.get('claim')) {
      if (!g) return route.fulfill({ status: 404, json: { error: 'No game with that code.' } });
      g.hostKey = key!;
      return route.fulfill({ json: { seq: g.seq, record: g.record, events: this.events.get(code) ?? [], updatedAt: g.updatedAt } });
    }
    if (method === 'DELETE') {
      if (g && g.hostKey === key) {
        this.games.delete(code);
        this.events.delete(code);
      }
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ status: 405, json: { error: 'method' } });
  }

  private async inbox(route: Route) {
    const req = route.request();
    if (!this.online) return route.abort('internetdisconnected');
    const url = new URL(req.url());
    const code = (url.searchParams.get('code') ?? '').toUpperCase();
    const method = req.method();
    this.requests.push({ method, url: req.url(), body: method === 'POST' ? req.postDataJSON() : undefined });
    const g = this.games.get(code);
    if (!g) return route.fulfill({ status: 404, json: { error: 'No game with that code.' } });
    if (method === 'POST') {
      this.actions.push({ seq: ++this.seq, code, data: req.postDataJSON(), at: Date.now() });
      return route.fulfill({ json: { ok: true } });
    }
    if (method === 'GET') {
      const key = url.searchParams.get('key');
      if (g.hostKey !== key) return route.fulfill({ status: 403, json: { error: 'This game belongs to another laptop.' } });
      const after = Number(url.searchParams.get('after') ?? 0);
      return route.fulfill({ json: { actions: this.actions.filter((a) => a.code === code && a.seq > after).map(({ seq, data, at }) => ({ seq, data, at })) } });
    }
    return route.fulfill({ status: 405, json: { error: 'method' } });
  }

  /** The record for a code, as the site holds it. */
  state(code: string) {
    return this.games.get(code.toUpperCase())?.record?.state;
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
