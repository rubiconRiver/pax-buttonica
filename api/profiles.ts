/**
 * Player profiles. There is no login (yet): anyone who can open the site can
 * read and edit them, so everything that arrives is validated and capped.
 *
 *   GET    /api/profiles            → { profiles: [{ id, updatedAt, deleted, ...fields }] }
 *   PUT    /api/profiles  {profile} → upsert; the newest updatedAt wins
 *   DELETE /api/profiles?id=…       → tombstone, so other browsers drop it too
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ID, ensureSchema, sql } from './_db.js';

const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'black'];
const MAX_PROFILES = 500;

type Sound = { kind: 'none' } | { kind: 'jingle'; id: string } | { kind: 'clip'; id: string; name: string };

function sound(raw: unknown): Sound | null {
  const s = raw as Record<string, unknown> | null;
  if (!s || typeof s !== 'object') return null;
  if (s.kind === 'none') return { kind: 'none' };
  if (s.kind === 'jingle' && typeof s.id === 'string' && /^[a-z0-9-]{1,30}$/.test(s.id)) return { kind: 'jingle', id: s.id };
  if (s.kind === 'clip' && typeof s.id === 'string' && ID.test(s.id)) return { kind: 'clip', id: s.id, name: String(s.name ?? 'clip').slice(0, 60) };
  return null;
}

function clean(raw: unknown) {
  const p = raw as Record<string, unknown> | null;
  if (!p || typeof p !== 'object') return null;
  const name = typeof p.name === 'string' ? p.name.trim().slice(0, 14) : '';
  const intro = sound(p.intro);
  const outro = sound(p.outro);
  if (typeof p.id !== 'string' || !ID.test(p.id) || !name || !intro || !outro) return null;
  if (typeof p.color !== 'string' || !COLORS.includes(p.color)) return null;
  const updatedAt = Number(p.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;
  return {
    id: p.id,
    updatedAt: Math.min(updatedAt, Date.now() + 60_000),
    data: {
      name,
      color: p.color,
      faction: String(p.faction ?? '').slice(0, 40),
      buttons: p.buttons === 3 ? 3 : 1,
      intro,
      outro,
      // How they like their light: optional, and only the values the app knows.
      ...(p.light === 'solid' || p.light === 'pulse' || p.light === 'heartbeat' ? { light: p.light } : {}),
      ...(typeof p.brightness === 'number' && Number.isFinite(p.brightness) ? { brightness: Math.min(1, Math.max(0.1, p.brightness)) } : {}),
      ...(typeof p.turnFx === 'string' && TURN_FX.includes(p.turnFx) ? { turnFx: p.turnFx } : {}),
      // Real buttons registered as theirs: device tags (hex), at most a handful.
      ...(Array.isArray(p.buttonIds) ? { buttonIds: p.buttonIds.filter((x): x is string => typeof x === 'string' && /^[0-9a-f]{6,24}$/.test(x)).slice(0, 8) } : {}),
    },
  };
}

/** Turn effects the app knows (src/engine/outputs.ts); anything else is dropped rather than stored. */
const TURN_FX = ['ring', 'ripple', 'sparkle', 'rainbow', 'none'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const rows = await sql`select id, data, updated_at, deleted from profiles order by updated_at desc limit ${MAX_PROFILES * 2}`;
      return res.status(200).json({
        profiles: rows.map((r) => ({ ...(r.deleted ? {} : (r.data as object)), id: r.id, updatedAt: Number(r.updated_at), deleted: r.deleted })),
      });
    }

    if (req.method === 'PUT') {
      const p = clean(req.body?.profile);
      if (!p) return res.status(400).json({ error: 'That profile is missing something.' });
      const [{ count }] = await sql`select count(*)::int as count from profiles where not deleted`;
      const [existing] = await sql`select 1 from profiles where id = ${p.id}`;
      if (!existing && count >= MAX_PROFILES) return res.status(507).json({ error: 'The profile list is full.' });
      await sql`
        insert into profiles (id, data, updated_at, deleted) values (${p.id}, ${JSON.stringify(p.data)}::jsonb, ${p.updatedAt}, false)
        on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at, deleted = false
        where profiles.updated_at <= excluded.updated_at`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id ?? '');
      if (!ID.test(id)) return res.status(400).json({ error: 'Bad id.' });
      await sql`update profiles set deleted = true, updated_at = ${Date.now()} where id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'The profile store is having a moment.' });
  }
}
