#!/usr/bin/env node
// The Halloween show's whole back end: serves the page, lists the recordings in sounds/, and passes
// light commands on to the Hue bridge on the home network. Nothing leaves the house except the one
// optional "find my bridge" lookup. Run:  node halloween/server.mjs   then open http://localhost:8031
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || process.argv[2] || 8031);
const HUE_FILE = path.join(dir, '.hue.json');   // { ip, key }: the bridge's address and this laptop's key to it; not committed
const SOUNDS = path.join(dir, 'sounds');
const TYPES = { '.html': 'text/html; charset=utf-8', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.aac': 'audio/aac', '.flac': 'audio/flac' };
const AUDIO = new Set(Object.keys(TYPES).filter((e) => e !== '.html'));

let hue = {};
try { hue = JSON.parse(fs.readFileSync(HUE_FILE, 'utf8')); } catch {}
const saveHue = () => fs.writeFileSync(HUE_FILE, JSON.stringify(hue, null, 2));

// One request to the bridge. It has a self-signed certificate, so that check is off for this one host on the LAN.
function bridgeOnce(mod, ip, method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = mod.request({ host: ip, path: p, method, rejectUnauthorized: false, timeout: 4000, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, (r) => {
      let s = '';
      r.on('data', (c) => { s += c; });
      r.on('end', () => { try { resolve(JSON.parse(s)); } catch { reject(new Error('the bridge answered with something that is not JSON')); } });
    });
    req.on('timeout', () => req.destroy(new Error('the bridge did not answer')));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}
const bridge = (ip, method, p, body) => bridgeOnce(https, ip, method, p, body).catch(() => bridgeOnce(http, ip, method, p, body));

const readBody = (req) => new Promise((resolve) => { let s = ''; req.on('data', (c) => { s += c; }); req.on('end', () => { try { resolve(s ? JSON.parse(s) : null); } catch { resolve(null); } }); });
const json = (res, obj, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

function listSounds() {
  const out = {};
  let roles = [];
  try { roles = fs.readdirSync(SOUNDS, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch {}
  for (const d of roles) {
    out[d.name] = fs.readdirSync(path.join(SOUNDS, d.name)).filter((f) => AUDIO.has(path.extname(f).toLowerCase())).sort()
      .map((f) => `/sounds/${encodeURIComponent(d.name)}/${encodeURIComponent(f)}`);
  }
  return out;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);
  try {
    if (p === '/' || p === '/index.html') { res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' }); return res.end(fs.readFileSync(path.join(dir, 'index.html'))); }
    if (p === '/api/sounds') return json(res, listSounds());
    if (p === '/api/hue') return json(res, { ip: hue.ip ?? null, paired: Boolean(hue.key) });
    if (p === '/api/hue/find' && req.method === 'POST') {
      // Philips' own lookup: it answers with the bridges behind this house's internet address.
      const found = await fetch('https://discovery.meethue.com').then((r) => r.json()).catch(() => []);
      return json(res, { ips: (Array.isArray(found) ? found : []).map((b) => b.internalipaddress).filter(Boolean) });
    }
    if (p === '/api/hue/pair' && req.method === 'POST') {
      const { ip } = (await readBody(req)) ?? {};
      if (!/^[\d.]{7,15}$/.test(ip ?? '')) return json(res, { error: 'That is not an IP address.' }, 400);
      const ans = await bridge(ip, 'POST', '/api', { devicetype: 'halloween#laptop' });
      const key = ans?.[0]?.success?.username;
      if (!key) return json(res, { error: ans?.[0]?.error?.description ?? 'The bridge refused.' }, 409);
      hue = { ip, key }; saveHue();
      return json(res, { ok: true });
    }
    if (p === '/api/hue/forget' && req.method === 'POST') { hue = {}; fs.rmSync(HUE_FILE, { force: true }); return json(res, { ok: true }); }
    if (p.startsWith('/api/hue/bridge/')) {
      if (!hue.key) return json(res, { error: 'No bridge paired.' }, 409);
      const rest = p.slice('/api/hue/bridge/'.length);
      if (!/^[\w/]*$/.test(rest)) return json(res, { error: 'Bad path.' }, 400);
      return json(res, await bridge(hue.ip, req.method, `/api/${hue.key}/${rest}`, await readBody(req)));
    }
    if (p.startsWith('/sounds/')) {
      const file = path.normalize(path.join(dir, p));
      if (!file.startsWith(SOUNDS + path.sep) || !AUDIO.has(path.extname(file).toLowerCase()) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()], 'Cache-Control': 'no-store' });
      return fs.createReadStream(file).pipe(res);
    }
    res.writeHead(404); res.end('Not found');
  } catch (e) { json(res, { error: String(e.message ?? e) }, 502); }
});

// Only this laptop can reach it.
server.listen(PORT, '127.0.0.1', () => console.log(`Halloween show: http://localhost:${PORT}   (Ctrl-C to stop)`));
