/**
 * Uploaded intro/outro sounds.
 *
 *   POST /api/clips?id=…&name=…   body: the audio file (Content-Type: audio/*), up to 4 MB
 *   GET  /api/clips?id=…          → the audio, cacheable forever (clips never change)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ID, ensureSchema, sql } from './_db.js';

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_CLIPS = 300;

// The body is an audio file, not JSON: read it ourselves.
export const config = { api: { bodyParser: false } };

async function readBody(req: VercelRequest): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BYTES) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensureSchema();
    const id = String(req.query.id ?? '');
    if (!ID.test(id)) return res.status(400).json({ error: 'Bad id.' });

    if (req.method === 'GET') {
      const [row] = await sql`select mime, encode(bytes, 'base64') as b64 from clips where id = ${id}`;
      if (!row) return res.status(404).json({ error: 'No such clip.' });
      res.setHeader('Content-Type', row.mime as string);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).send(Buffer.from(row.b64 as string, 'base64'));
    }

    if (req.method === 'POST') {
      const mime = String(req.headers['content-type'] ?? '').split(';')[0];
      if (!mime.startsWith('audio/')) return res.status(415).json({ error: 'Audio files only.' });
      const body = await readBody(req);
      if (!body) return res.status(413).json({ error: 'Keep clips under 4 MB.' });
      if (!body.length) return res.status(400).json({ error: 'Empty upload.' });
      const [{ count }] = await sql`select count(*)::int as count from clips`;
      if (count >= MAX_CLIPS) return res.status(507).json({ error: 'Clip storage is full.' });
      const name = String(req.query.name ?? 'clip').slice(0, 60);
      await sql`
        insert into clips (id, name, mime, bytes, created_at)
        values (${id}, ${name}, ${mime}, decode(${body.toString('base64')}, 'base64'), ${Date.now()})
        on conflict (id) do nothing`;
      return res.status(200).json({ ok: true, id });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'The clip store is having a moment.' });
  }
}
