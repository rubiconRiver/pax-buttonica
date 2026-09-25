/**
 * A game in progress. The host laptop is the authority (it runs the rules); this is the durable copy everyone
 * else reads: phones, the table view, a laptop picking the game up.
 *
 *   GET    /api/game?code=ABCD[&after=N]     → { seq, record, updatedAt }, or 204 if nothing changed since N
 *   GET    /api/game?code=ABCD&full=1        → the same plus base and every event: what a laptop needs to take over
 *   GET    /api/game?key=…                   → { games: [{ code, seq, updatedAt, players, round }] }   this host's games
 *   PUT    /api/game?code=ABCD&key=…         the host's copy. The first writer's key owns the code.
 *   POST   /api/game?code=ABCD&key=…&claim=1  → pick the game up: from now on it belongs to this key
 *   DELETE /api/game?code=ABCD&key=…         the game ended
 *
 * A record is { state, settings, base? }: the engine's whole state, the few settings phones need (hold time,
 * blink), and how the game began. The PUT also carries the action log: `events` are the ones the host hasn't
 * sent yet and `eventCount` is how many there are in all, so a rewind (fewer than before) is a truncation.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CODE, KEY, ensureSchema, sql } from './_db.js';

const MAX_BYTES = 400_000;
const STALE_MS = 14 * 24 * 60 * 60 * 1000;

async function events(code: string) {
  const rows = await sql`select i, at, action from game_events where code = ${code} order by i`;
  return rows.map((r) => {
    const { action, auto, noop } = r.action as { action: unknown; auto?: true; noop?: true };
    return { at: Number(r.at), action, ...(auto ? { auto: true } : {}), ...(noop ? { noop: true } : {}) };
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await ensureSchema();
    const code = String(req.query.code ?? '').toUpperCase();
    const key = String(req.query.key ?? '');
    const now = Date.now();
    if (code && !CODE.test(code)) return res.status(400).json({ error: 'Bad code.' });
    if (key && !KEY.test(key)) return res.status(400).json({ error: 'Bad key.' });

    if (req.method === 'GET' && !code) {
      if (!key) return res.status(400).json({ error: 'Code or key needed.' });
      const rows = await sql`select code, seq, record, updated_at from game_states where host_key = ${key} and updated_at > ${now - STALE_MS} order by updated_at desc limit 5`;
      return res.status(200).json({
        games: rows.map((r) => {
          const state = (r.record as { state: { players: { name: string }[]; round: number; phase: string } }).state;
          return { code: r.code, seq: Number(r.seq), updatedAt: Number(r.updated_at), players: state.players.map((p) => p.name), round: state.round, phase: state.phase };
        }),
      });
    }

    if (req.method === 'GET') {
      const [row] = await sql`select seq, record, updated_at from game_states where code = ${code}`;
      if (!row || Number(row.updated_at) < now - STALE_MS) return res.status(404).json({ error: 'No game with that code.' });
      const after = Number(req.query.after);
      if (Number.isFinite(after) && Number(row.seq) <= after) return res.status(204).end();
      if (req.query.full) return res.status(200).json({ seq: Number(row.seq), record: row.record, events: await events(code), updatedAt: Number(row.updated_at) });
      const { base: _base, ...slim } = row.record as { base?: unknown };
      return res.status(200).json({ seq: Number(row.seq), record: slim, updatedAt: Number(row.updated_at) });
    }

    if (!code || !key) return res.status(400).json({ error: 'Code and key needed.' });

    if (req.method === 'PUT') {
      const b = req.body as { state?: unknown; settings?: unknown; base?: unknown; events?: unknown; eventCount?: unknown } | null;
      if (!b || typeof b !== 'object' || !b.state || typeof b.state !== 'object') return res.status(400).json({ error: 'Bad record.' });
      const record = { state: b.state, settings: b.settings ?? {}, ...(b.base && typeof b.base === 'object' ? { base: b.base } : {}) };
      const body = JSON.stringify(record);
      const incoming = Array.isArray(b.events) ? (b.events as { at: unknown; action: unknown; auto?: unknown; noop?: unknown }[]) : [];
      const eventCount = Number.isInteger(b.eventCount) ? Math.max(0, b.eventCount as number) : null;
      if (body.length > MAX_BYTES || incoming.length > 5000 || JSON.stringify(incoming).length > MAX_BYTES) return res.status(400).json({ error: 'Too big.' });
      if (Math.random() < 0.02) await sql`delete from game_states where updated_at < ${now - STALE_MS}`;
      // How the game began is kept from the first write; later writes may leave it out.
      const rows = await sql`
        insert into game_states (code, host_key, seq, record, updated_at) values (${code}, ${key}, 1, ${body}::jsonb, ${now})
        on conflict (code) do update set
          seq = game_states.seq + 1,
          record = case when excluded.record ? 'base' then excluded.record else excluded.record || coalesce(jsonb_build_object('base', game_states.record->'base'), '{}'::jsonb) end,
          updated_at = excluded.updated_at
        where game_states.host_key = excluded.host_key or game_states.updated_at < ${now - STALE_MS}
        returning seq`;
      if (!rows.length) return res.status(403).json({ error: 'This game belongs to another laptop.' });
      if (eventCount != null) {
        const first = eventCount - incoming.length;
        await sql`delete from game_events where code = ${code} and i >= ${Math.max(0, first)}`;
        for (const [k, e] of incoming.entries()) {
          if (!e || typeof e !== 'object' || typeof e.at !== 'number' || !e.action) continue;
          const i = first + k;
          if (i < 0) continue;
          await sql`insert into game_events (code, i, at, action) values (${code}, ${i}, ${e.at}, ${JSON.stringify({ action: e.action, ...(e.auto ? { auto: true } : {}), ...(e.noop ? { noop: true } : {}) })}::jsonb) on conflict (code, i) do update set at = excluded.at, action = excluded.action`;
        }
      }
      return res.status(200).json({ ok: true, seq: Number(rows[0].seq) });
    }

    if (req.method === 'POST' && req.query.claim) {
      const [row] = await sql`select seq, record, updated_at from game_states where code = ${code}`;
      if (!row || Number(row.updated_at) < now - STALE_MS) return res.status(404).json({ error: 'No game with that code.' });
      await sql`update game_states set host_key = ${key} where code = ${code}`;
      return res.status(200).json({ seq: Number(row.seq), record: row.record, events: await events(code), updatedAt: Number(row.updated_at) });
    }

    if (req.method === 'DELETE') {
      const gone = await sql`delete from game_states where code = ${code} and host_key = ${key} returning code`;
      if (gone.length) await sql`delete from game_events where code = ${code}`;
      await sql`delete from game_actions where code = ${code}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'The game store is having a moment.' });
  }
}
