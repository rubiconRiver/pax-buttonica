/**
 * The game in progress, kept on the site as well as in the host's browser, so it survives a cleared browser and can
 * be picked up on another laptop.
 *
 *   PUT    /api/game?key=…              { game, code? }  the host's copy; the key is the browser's secret
 *   GET    /api/game?key=…              → { game, code, updatedAt }
 *   GET    /api/game?code=ABCD&key=…    pick a game up by its room code: it now belongs to this key
 *   DELETE /api/game?key=…              the game ended
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CODE, KEY, ensureSchema, sql } from './_db.js';

const MAX_BYTES = 400_000;
const STALE_MS = 14 * 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await ensureSchema();
    const key = String(req.query.key ?? '');
    if (!KEY.test(key)) return res.status(400).json({ error: 'Bad key.' });
    const now = Date.now();

    if (req.method === 'GET') {
      const code = String(req.query.code ?? '').toUpperCase();
      if (code) {
        if (!CODE.test(code)) return res.status(400).json({ error: 'Bad code.' });
        // Picking up from another laptop: the newest game that had this room code changes hands.
        const [row] = await sql`select key, data, updated_at from games where code = ${code} and updated_at > ${now - STALE_MS} order by updated_at desc limit 1`;
        if (!row) return res.status(404).json({ error: 'No game with that code.' });
        if (row.key !== key) {
          await sql`delete from games where key = ${key}`;
          await sql`delete from games where key = ${row.key}`;
          await sql`insert into games (key, code, data, updated_at) values (${key}, ${code}, ${JSON.stringify(row.data)}::jsonb, ${now})`;
          // The room and the published table come along, so phones keep working without a new code.
          await sql`update rooms set key = ${key} where code = ${code}`;
          await sql`update tables set key = ${key} where code = ${code}`;
        }
        return res.status(200).json({ game: (row.data as { game: unknown }).game, code, updatedAt: Number(row.updated_at) });
      }
      const [row] = await sql`select code, data, updated_at from games where key = ${key}`;
      if (!row || Number(row.updated_at) < now - STALE_MS) return res.status(404).json({ error: 'No saved game.' });
      return res.status(200).json({ game: (row.data as { game: unknown }).game, code: row.code, updatedAt: Number(row.updated_at) });
    }

    if (req.method === 'PUT') {
      const b = req.body as { game?: unknown; code?: unknown } | null;
      const body = JSON.stringify({ game: b?.game ?? null });
      if (!b || typeof b !== 'object' || !b.game || typeof b.game !== 'object' || body.length > MAX_BYTES) return res.status(400).json({ error: 'Bad game.' });
      const code = typeof b.code === 'string' && CODE.test(b.code.toUpperCase()) ? b.code.toUpperCase() : null;
      if (code) {
        // The room code says which laptop the game belongs to now; a laptop it was picked up from may not overwrite it.
        const [room] = await sql`select key from rooms where code = ${code}`;
        if (room && room.key !== key) return res.status(403).json({ error: 'This game was picked up on another laptop.' });
      }
      await sql`delete from games where updated_at < ${now - STALE_MS}`;
      await sql`
        insert into games (key, code, data, updated_at) values (${key}, ${code}, ${body}::jsonb, ${now})
        on conflict (key) do update set code = excluded.code, data = excluded.data, updated_at = excluded.updated_at`;
      return res.status(200).json({ ok: true, updatedAt: now });
    }

    if (req.method === 'DELETE') {
      await sql`delete from games where key = ${key}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'The game store is having a moment.' });
  }
}
