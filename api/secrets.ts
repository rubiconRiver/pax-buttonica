/**
 * Secret objectives, dealt ahead of game night: the tool at /secrets. The rules are in _secretsDraft.ts; this
 * keeps the deals and answers the links.
 *
 *   POST /api/secrets { op: 'create', names, title?, pok? }      → { key }           the dashboard's link
 *   GET  /api/secrets?k=<key>&dev=<device>                       → what that link shows that device
 *   POST /api/secrets { op: 'open' | 'pick' | 'redeal' | 'reveal', k, dev, … } → the same, after doing it
 *
 * A deal is one row, rewritten whole. Two players choosing at the same moment would overwrite each other, so a
 * write only lands if the row is still the version that was read, and is tried again if not.
 */
import { randomBytes, randomInt } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSchema, sql } from './_db.js';
import { Refusal, apply, createDraft, keyOf, parseKey, view, whoIs, type Draft, type Env, type Op } from './_secretsDraft.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const env = (): Env => ({
  now: Date.now(),
  int: (n) => randomInt(n),
  token: (length) => Array.from(randomBytes(length), (b) => ALPHABET[b % ALPHABET.length]).join(''),
});

async function load(id: string): Promise<{ draft: Draft; version: number } | null> {
  const [row] = await sql`select data, version from secret_drafts where id = ${id}`;
  return row ? { draft: row.data as Draft, version: Number(row.version) } : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await ensureSchema();
    if (req.method === 'GET') {
      const key = parseKey(req.query.k);
      const found = key && (await load(key.id));
      const who = found && whoIs(found.draft, key.token);
      if (!found || !who) return res.status(404).json({ error: 'No such link.' });
      return res.status(200).json(view(found.draft, who, req.query.dev));
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST.' });
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (body.op === 'create') {
      for (let attempt = 0; attempt < 3; attempt++) {
        const draft = createDraft(body, env());
        const made = await sql`insert into secret_drafts (id, version, data, created_at) values (${draft.id}, 0, ${JSON.stringify(draft)}::jsonb, ${draft.createdAt}) on conflict (id) do nothing returning id`;
        if (made.length) return res.status(200).json({ key: keyOf(draft, draft.adminToken) });
      }
      return res.status(500).json({ error: 'Could not make a deal. Try again.' });
    }

    const key = parseKey(body.k);
    if (!key) return res.status(404).json({ error: 'No such link.' });
    for (let attempt = 0; attempt < 6; attempt++) {
      const found = await load(key.id);
      const who = found && whoIs(found.draft, key.token);
      if (!found || !who) return res.status(404).json({ error: 'No such link.' });
      const next = apply(found.draft, who, body as unknown as Op, body.dev, env());
      const saved = await sql`update secret_drafts set data = ${JSON.stringify(next)}::jsonb, version = version + 1 where id = ${key.id} and version = ${found.version} returning id`;
      // After dealing again the link that asked is still the dashboard's, so `who` holds either way.
      if (saved.length) return res.status(200).json(view(next, who, body.dev));
    }
    return res.status(503).json({ error: 'Busy. Try again.' });
  } catch (e) {
    if (e instanceof Refusal) return res.status(e.status).json({ error: e.message });
    return res.status(500).json({ error: String(e) });
  }
}
