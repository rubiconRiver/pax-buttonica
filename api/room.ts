/**
 * Phones as buttons, through the site. The direct phone-to-laptop link (WebRTC) needs a network path that many
 * Wi-Fi networks don't allow, so this is the way that always works: about a second of lag, nothing clever.
 *
 *   PUT  /api/room?code=ABCD&key=…            host: { table, profiles, phones: { [dev]: { state, me, oops } } }
 *   GET  /api/room?code=ABCD&key=…&after=N    host: { inbox: [{ seq, data }] }   (presses and hellos since N)
 *   GET  /api/room?code=ABCD&dev=…            phone: { table, profiles, phone, updatedAt }
 *   POST /api/room?code=ABCD                  phone: a message for the host ({ dev, t, … })
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CODE, KEY, ensureSchema, sql } from './_db.js';

const DEV = /^[A-Za-z0-9:_-]{4,40}$/;
const MAX_ROOM_BYTES = 200_000;
const MAX_MESSAGE_BYTES = 4_000;
const KINDS = new Set(['hello', 'btn', 'iam', 'create', 'leave', 'edit', 'clip']);
const INBOX_TTL_MS = 5 * 60 * 1000;
const STALE_MS = 3 * 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await ensureSchema();
    const code = String(req.query.code ?? '').toUpperCase();
    if (!CODE.test(code)) return res.status(400).json({ error: 'Bad code.' });
    const key = String(req.query.key ?? '');
    const now = Date.now();

    if (req.method === 'PUT') {
      const body = JSON.stringify(req.body ?? null);
      if (!KEY.test(key) || !req.body || typeof req.body !== 'object' || body.length > MAX_ROOM_BYTES) return res.status(400).json({ error: 'Bad room.' });
      const rows = await sql`
        insert into rooms (code, key, data, updated_at) values (${code}, ${key}, ${body}::jsonb, ${now})
        on conflict (code) do update set data = excluded.data, updated_at = excluded.updated_at
        where rooms.key = excluded.key or rooms.updated_at < ${now - STALE_MS}
        returning code`;
      if (!rows.length) return res.status(403).json({ error: 'That code belongs to another table.' });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET' && key) {
      if (!KEY.test(key)) return res.status(400).json({ error: 'Bad key.' });
      const [room] = await sql`select key from rooms where code = ${code}`;
      if (!room) return res.status(404).json({ error: 'No room with that code.' });
      if (room.key !== key) return res.status(403).json({ error: 'That code belongs to another table.' });
      const after = Math.max(0, Number(req.query.after) || 0);
      const rows = await sql`select seq, data from room_inbox where code = ${code} and seq > ${after} order by seq limit 200`;
      if (Math.random() < 0.05) await sql`delete from room_inbox where at < ${now - INBOX_TTL_MS}`;
      return res.status(200).json({ inbox: rows.map((r) => ({ seq: Number(r.seq), data: r.data })) });
    }

    if (req.method === 'GET') {
      const dev = String(req.query.dev ?? '');
      if (!DEV.test(dev)) return res.status(400).json({ error: 'Bad device.' });
      const [room] = await sql`select data, updated_at from rooms where code = ${code}`;
      if (!room || Number(room.updated_at) < now - STALE_MS) return res.status(404).json({ error: 'No room with that code.' });
      const data = room.data as { table?: unknown; profiles?: unknown; phones?: Record<string, unknown> };
      return res.status(200).json({ table: data.table ?? null, profiles: data.profiles ?? [], phone: data.phones?.[dev] ?? null, updatedAt: Number(room.updated_at) });
    }

    if (req.method === 'POST') {
      const msg = req.body as Record<string, unknown> | null;
      const body = JSON.stringify(msg ?? null);
      if (!msg || typeof msg !== 'object' || body.length > MAX_MESSAGE_BYTES) return res.status(400).json({ error: 'Bad message.' });
      if (typeof msg.dev !== 'string' || !DEV.test(msg.dev) || typeof msg.t !== 'string' || !KINDS.has(msg.t)) return res.status(400).json({ error: 'Bad message.' });
      const [room] = await sql`select updated_at from rooms where code = ${code}`;
      if (!room || Number(room.updated_at) < now - STALE_MS) return res.status(404).json({ error: 'No room with that code.' });
      await sql`insert into room_inbox (code, data, at) values (${code}, ${body}::jsonb, ${now})`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'The room is having a moment.' });
  }
}
