/**
 * What phones send to the host: presses, and who they are. The host reads them in order and applies them
 * through its rules engine; the result comes back to the phone in the next copy of the game.
 *
 *   POST /api/actions?code=ABCD            { dev, type: 'input', input } | { dev, type: 'identify', profileId } | { dev, type: 'hello' } | { dev, type: 'preview', fx }
 *   GET  /api/actions?code=ABCD&key=…&after=N   → { actions: [{ seq, data, at }], now }      host only; `at` and `now` on the site's clock
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CODE, KEY, ensureSchema, sql } from './_db.js';

const DEV = /^[A-Za-z0-9:_-]{4,40}$/;
const INPUTS = new Set(['tap', 'double', 'hold']);
const MAX_BYTES = 1_000;
const TTL_MS = 10 * 60 * 1000;

/** Turn effects a phone may ask its seat to preview (src/engine/outputs.ts). */
const TURN_FX = new Set(['ring', 'ripple', 'sparkle', 'rainbow', 'cop', 'explosion', 'fireworks', 'lightning', 'fire', 'siren', 'laser', 'comet', 'warp', 'confetti', 'disco', 'glitch', 'neon', 'alarm', 'thump', 'none']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await ensureSchema();
    const code = String(req.query.code ?? '').toUpperCase();
    if (!CODE.test(code)) return res.status(400).json({ error: 'Bad code.' });
    const now = Date.now();

    if (req.method === 'POST') {
      const m = req.body as Record<string, unknown> | null;
      if (!m || typeof m !== 'object' || JSON.stringify(m).length > MAX_BYTES) return res.status(400).json({ error: 'Bad action.' });
      if (typeof m.dev !== 'string' || !DEV.test(m.dev)) return res.status(400).json({ error: 'Bad device.' });
      let data: Record<string, unknown>;
      if (m.type === 'input' && typeof m.input === 'string' && INPUTS.has(m.input)) data = { dev: m.dev, type: 'input', input: m.input };
      else if (m.type === 'identify' && (m.profileId === null || (typeof m.profileId === 'string' && /^[A-Za-z0-9-]{8,40}$/.test(m.profileId)))) data = { dev: m.dev, type: 'identify', profileId: m.profileId };
      else if (m.type === 'hello') data = { dev: m.dev, type: 'hello' };
      else if (m.type === 'preview' && typeof m.fx === 'string' && TURN_FX.has(m.fx)) data = { dev: m.dev, type: 'preview', fx: m.fx };
      else return res.status(400).json({ error: 'Bad action.' });
      const [game] = await sql`select updated_at from game_states where code = ${code}`;
      if (!game) return res.status(404).json({ error: 'No game with that code.' });
      await sql`insert into game_actions (code, data, at) values (${code}, ${JSON.stringify(data)}::jsonb, ${now})`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      const key = String(req.query.key ?? '');
      if (!KEY.test(key)) return res.status(400).json({ error: 'Bad key.' });
      const [game] = await sql`select host_key from game_states where code = ${code}`;
      if (!game) return res.status(404).json({ error: 'No game with that code.' });
      if (game.host_key !== key) return res.status(403).json({ error: 'This game belongs to another laptop.' });
      const after = Math.max(0, Number(req.query.after) || 0);
      const rows = await sql`select seq, data, at from game_actions where code = ${code} and seq > ${after} order by seq limit 200`;
      if (Math.random() < 0.05) await sql`delete from game_actions where at < ${now - TTL_MS}`;
      return res.status(200).json({ actions: rows.map((r) => ({ seq: Number(r.seq), data: r.data, at: Number(r.at) })), now });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'The inbox is having a moment.' });
  }
}
