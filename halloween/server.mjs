#!/usr/bin/env node
// The Halloween show's whole back end: serves the page, lists the recordings in sounds/, and passes
// light commands on to the Hue bridge on the home network. Nothing leaves the house except the one
// optional "find my bridge" lookup. Run:  node halloween/server.mjs   then open http://localhost:8031
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGlow } from './glow.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || process.argv[2] || 8031);
// Everything remembered lives in one folder outside the repo, so it is the same whichever copy of the code is running and
// whichever window is looking: the bridge's key, the line of lamps, the show's settings. (A second argument names another
// folder: tests use that, so they can never touch the real lamps.)
const DATA = process.argv[3] || path.join(os.homedir(), 'Library', 'Application Support', 'PaxHalloween');
fs.mkdirSync(DATA, { recursive: true });
if (!process.argv[3]) for (const f of ['hue.json', 'glow.json']) { const old = path.join(dir, '.' + f); if (!fs.existsSync(path.join(DATA, f)) && fs.existsSync(old)) fs.copyFileSync(old, path.join(DATA, f)); }   // from before the folder existed
const HUE_FILE = path.join(DATA, 'hue.json');     // { ip, key }: the bridge's address and this laptop's key to it
const SHOW_FILE = path.join(DATA, 'show.json');   // the Halloween page's settings, kept here so every window has the same ones
const SOUNDS = path.join(dir, 'sounds');
const TYPES = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.aac': 'audio/aac', '.flac': 'audio/flac' };
const AUDIO = new Set(Object.keys(TYPES).filter((e) => e !== '.html' && e !== '.mjs'));

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

// Porch glow: ambient scenes on the lamps, played from here (glow.mjs).
// Pairing is once. The key never expires; only the bridge's address can change (the router hands it a new one). When the
// bridge stops answering, look it up again and keep whichever answers to our key, so nobody has to go and press its button.
let lookedAt = 0;
async function refind() {
  if (Date.now() - lookedAt < 30000) return false;
  lookedAt = Date.now();
  const found = await fetch('https://discovery.meethue.com').then((r) => r.json()).catch(() => []);
  for (const b of Array.isArray(found) ? found : []) {
    const ip = b.internalipaddress; if (!ip || ip === hue.ip) continue;
    const cfg = await bridge(ip, 'GET', `/api/${hue.key}/config`).catch(() => null);
    if (cfg?.whitelist) { hue.ip = ip; saveHue(); console.log(`The bridge moved to ${ip}.`); return true; }
  }
  return false;
}
async function hueCall(method, p, body) {
  if (!hue.key) throw new Error('No bridge paired.');
  try { return await bridge(hue.ip, method, `/api/${hue.key}/${p}`, body); }
  catch (e) { if (!(await refind())) throw e; return bridge(hue.ip, method, `/api/${hue.key}/${p}`, body); }
}
const glow = createGlow({ dir: DATA, call: hueCall });

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
    if (p === '/glow') { res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' }); return res.end(fs.readFileSync(path.join(dir, 'glow.html'))); }
    if (p === '/scenes.mjs') { res.writeHead(200, { 'Content-Type': TYPES['.mjs'], 'Cache-Control': 'no-store' }); return res.end(fs.readFileSync(path.join(dir, 'scenes.mjs'))); }
    if (p === '/api/glow') return json(res, { ...glow.status(), paired: Boolean(hue.key) });
    if (p === '/api/glow/start' && req.method === 'POST') { await glow.start(((await readBody(req)) ?? {}).scene); return json(res, glow.status()); }
    if (p === '/api/glow/stop' && req.method === 'POST') { await glow.stop(); return json(res, glow.status()); }
    if (p === '/api/glow/config' && req.method === 'POST') { glow.configure((await readBody(req)) ?? {}); return json(res, glow.status()); }
    if (p === '/api/state' && req.method === 'POST') { fs.writeFileSync(SHOW_FILE, JSON.stringify((await readBody(req)) ?? {}, null, 2)); return json(res, { ok: true }); }
    if (p === '/api/state') { let s = {}; try { s = JSON.parse(fs.readFileSync(SHOW_FILE, 'utf8')); } catch {} return json(res, s); }
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
      return json(res, await hueCall(req.method, rest, await readBody(req)));
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
