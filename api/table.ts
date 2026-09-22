/**
 * The public state of a game in progress, so anyone at the table can read the
 * objectives, scores and laws from their own browser — no direct link to the
 * host laptop needed.
 *
 *   PUT /api/table?code=ABCD&key=…   body: the snapshot. The first writer's key owns the code.
 *   GET /api/table?code=ABCD         → { table, updatedAt }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CODE, KEY, ensureSchema, sql } from './_db.js';

const MAX_BYTES = 60_000;
const STALE_MS = 3 * 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await ensureSchema();
    const code = String(req.query.code ?? '').toUpperCase();
    if (!CODE.test(code)) return res.status(400).json({ error: 'Bad code.' });

    if (req.method === 'GET') {
      const [row] = await sql`select data, updated_at from tables where code = ${code}`;
      if (!row) return res.status(404).json({ error: 'No table with that code.' });
      return res.status(200).json({ table: row.data, updatedAt: Number(row.updated_at) });
    }

    if (req.method === 'PUT') {
      const key = String(req.query.key ?? '');
      const body = JSON.stringify(req.body ?? null);
      if (!KEY.test(key) || !req.body || typeof req.body !== 'object' || body.length > MAX_BYTES) return res.status(400).json({ error: 'Bad snapshot.' });
      const now = Date.now();
      await sql`delete from tables where updated_at < ${now - STALE_MS}`;
      const rows = await sql`
        insert into tables (code, key, data, updated_at) values (${code}, ${key}, ${body}::jsonb, ${now})
        on conflict (code) do update set data = excluded.data, updated_at = excluded.updated_at
        where tables.key = excluded.key
        returning code`;
      if (!rows.length) return res.status(403).json({ error: 'That code belongs to another table.' });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'The table store is having a moment.' });
  }
}
