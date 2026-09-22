/**
 * A game in progress. The host laptop is the authority (it runs the rules); this is the durable copy everyone
 * else reads: phones, the table view, a laptop picking the game up.
 *
 *   GET    /api/game?code=ABCD[&after=N]     → { seq, record, updatedAt }, or 204 if nothing changed since N
 *   GET    /api/game?key=…                   → { games: [{ code, seq, updatedAt, players, round }] }   this host's games
 *   PUT    /api/game?code=ABCD&key=…  {record}  the host's copy. The first writer's key owns the code.
 *   POST   /api/game?code=ABCD&key=…&claim=1  → pick the game up: from now on it belongs to this key
 *   DELETE /api/game?code=ABCD&key=…         the game ended
 *
 * A record is { state, settings }: the engine's whole state, plus the few settings phones need (hold time, blink).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CODE, KEY, ensureSchema, sql } from './_db.js';

const MAX_BYTES = 400_000;
const STALE_MS = 14 * 24 * 60 * 60 * 1000;

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
      return res.status(200).json({ seq: Number(row.seq), record: row.record, updatedAt: Number(row.updated_at) });
    }

    if (!code || !key) return res.status(400).json({ error: 'Code and key needed.' });

    if (req.method === 'PUT') {
      const record = req.body as { state?: unknown; settings?: unknown } | null;
      const body = JSON.stringify(record ?? null);
      if (!record || typeof record !== 'object' || !record.state || typeof record.state !== 'object' || body.length > MAX_BYTES) return res.status(400).json({ error: 'Bad record.' });
      if (Math.random() < 0.02) await sql`delete from game_states where updated_at < ${now - STALE_MS}`;
      const rows = await sql`
        insert into game_states (code, host_key, seq, record, updated_at) values (${code}, ${key}, 1, ${body}::jsonb, ${now})
        on conflict (code) do update set seq = game_states.seq + 1, record = excluded.record, updated_at = excluded.updated_at
        where game_states.host_key = excluded.host_key or game_states.updated_at < ${now - STALE_MS}
        returning seq`;
      if (!rows.length) return res.status(403).json({ error: 'This game belongs to another laptop.' });
      return res.status(200).json({ ok: true, seq: Number(rows[0].seq) });
    }

    if (req.method === 'POST' && req.query.claim) {
      const [row] = await sql`select seq, record, updated_at from game_states where code = ${code}`;
      if (!row || Number(row.updated_at) < now - STALE_MS) return res.status(404).json({ error: 'No game with that code.' });
      await sql`update game_states set host_key = ${key} where code = ${code}`;
      return res.status(200).json({ seq: Number(row.seq), record: row.record, updatedAt: Number(row.updated_at) });
    }

    if (req.method === 'DELETE') {
      await sql`delete from game_states where code = ${code} and host_key = ${key}`;
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
