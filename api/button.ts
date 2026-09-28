/**
 * What the tag on a real button links to. The URL on a button's NFC tag or QR code is /b/<tag> (its address in
 * hex); the page asks here what is known about that button and decides where to send the phone.
 *
 *   GET /api/button?id=<tag> → { id, owner: { id, name } | null, game: { code, seat, name, profileId, round, phase } | null }
 *
 * `owner` is whoever has the tag on their profile. `game` is the freshest unfinished game the button is bound in,
 * or failing that one its owner is playing in.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSchema, sql } from './_db.js';

const tag = (dev: string) => dev.replace(/[^0-9a-z]/gi, '').toLowerCase();
const TAG = /^[0-9a-f]{6,24}$/;
/** A game nobody has touched for this long is over, whatever its phase says. */
const STALE_MS = 12 * 3600_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await ensureSchema();
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only.' });
    const id = tag(String(req.query.id ?? ''));
    if (!TAG.test(id)) return res.status(400).json({ error: 'Bad button id.' });

    const owners = await sql`select id, data from profiles where deleted = false and data->'buttonIds' ? ${id} limit 1`;
    const owner = owners[0] ? { id: String(owners[0].id), name: String(owners[0].data?.name ?? '') } : null;

    const games = await sql`select code, record, updated_at from game_states order by updated_at desc limit 40`;
    let game: Record<string, unknown> | null = null;
    for (const g of games) {
      const updatedAt = typeof g.updated_at === 'number' ? g.updated_at : new Date(g.updated_at).getTime();
      if (Number.isFinite(updatedAt) && updatedAt < Date.now() - STALE_MS) break;
      const state = g.record?.state;
      if (!state || state.phase === 'finished') continue;
      const players: { name: string; profileId?: string }[] = state.players ?? [];
      const bound = (state.bindings ?? []).findIndex((b: unknown) => typeof b === 'string' && tag(b) === id);
      const seat = bound >= 0 ? bound : owner ? players.findIndex((p) => p.profileId === owner.id) : -1;
      if (seat < 0) continue;
      game = { code: g.code, seat, name: players[seat].name, profileId: players[seat].profileId ?? null, round: state.round, phase: state.phase };
      break;
    }
    return res.status(200).json({ id, owner, game });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
