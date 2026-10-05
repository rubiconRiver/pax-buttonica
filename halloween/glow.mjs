// Porch glow's engine: plays one scene (scenes.mjs) on the chosen Hue lamps, from the server, so no window has to be open.
// It asks the scene about one lamp at a time, round and round, and sends that lamp gliding to the answer; a full round takes
// the scene's `step`. That is a handful of commands a second, well inside what the bridge takes.
import fs from 'node:fs';
import path from 'node:path';
import { SCENES, tonight, sunset } from './scenes.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// `call(method, path, body)` talks to the bridge (and rejects when none is paired).
export function createGlow({ dir, call }) {
  const FILE = path.join(dir, 'glow.json');      // the line of lamps, what was chosen, and what is running: survives a restart
  const cfg = { lamps: [], bri: 70, speed: 100, schedule: { enabled: false, on: 'sunset', off: '23:00', scene: 'tonight' }, where: { lat: 52.13, lon: -106.67 }, running: null, snapshot: null };
  try { Object.assign(cfg, JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch {}
  const save = () => fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));

  let scene = null, timer = null, idx = 0, t0 = 0, reach = {}, reachAt = 0;
  const resolve = (id) => SCENES.find((s) => s.id === (id === 'tonight' ? tonight().id : id));

  async function start(id) {
    const sc = resolve(id);
    if (!sc) throw new Error('There is no scene by that name.');
    if (!cfg.lamps.length) throw new Error('No lamps chosen yet.');
    if (!cfg.snapshot) {                           // how the lamps were, to put back at the end
      const all = await call('GET', 'lights');
      if (!all || Array.isArray(all)) throw new Error('The bridge is not answering.');
      cfg.snapshot = Object.fromEntries(cfg.lamps.filter((i) => all[i]).map((i) => [i, all[i].state]));
    }
    scene = sc; cfg.running = id; save();
    t0 = Date.now(); idx = 0; loop();
  }
  function loop() {
    clearTimeout(timer);
    if (!scene || !cfg.lamps.length) return;
    const step = Math.max(scene.step, cfg.lamps.length * 0.15);      // never more than about seven commands a second
    stroke(step).catch(() => {});
    timer = setTimeout(loop, step * 1000 / cfg.lamps.length);
  }
  async function stroke(step) {
    const n = cfg.lamps.length, k = idx++ % n, id = cfg.lamps[k];
    if (Date.now() - reachAt > 60000) {            // a lamp that is switched off at the wall is left alone: asking after it slows the bridge
      reachAt = Date.now();
      const all = await call('GET', 'lights').catch(() => null);
      if (all && !Array.isArray(all)) reach = Object.fromEntries(Object.entries(all).map(([i, l]) => [i, l.state.reachable]));
    }
    if (reach[id] === false) return;
    const t = (Date.now() - t0) / 1000 * cfg.speed / 100 + step;
    const [h, s, v] = scene.at(n > 1 ? k / (n - 1) : 0.5, t, k, n);
    const bri = v * cfg.bri / 100, transitiontime = Math.round(step * 10);
    await call('PUT', `lights/${id}/state`, bri < 0.01 ? { on: false, transitiontime }
      : { on: true, hue: Math.round((((h % 360) + 360) % 360) / 360 * 65535), sat: Math.round(Math.min(1, Math.max(0, s)) * 254), bri: Math.max(1, Math.round(Math.min(1, bri) * 254)), transitiontime });
  }
  async function stop() {
    clearTimeout(timer); scene = null;
    const was = cfg.snapshot; cfg.running = null; cfg.snapshot = null; save();
    for (const [id, s] of Object.entries(was ?? {})) {
      const b = { on: s.on, transitiontime: 10 };
      if (s.on) { b.bri = s.bri; if (s.colormode === 'xy') b.xy = s.xy; else if (s.colormode === 'ct') b.ct = s.ct; else if (s.colormode === 'hs') { b.hue = s.hue; b.sat = s.sat; } }
      await call('PUT', `lights/${id}/state`, b).catch(() => {});
      await sleep(120);
    }
  }
  function configure(patch) {
    if (Array.isArray(patch.lamps)) cfg.lamps = patch.lamps.map(String);
    if (Number.isFinite(patch.bri)) cfg.bri = Math.min(100, Math.max(5, patch.bri));
    if (Number.isFinite(patch.speed)) { const t = (Date.now() - t0) * cfg.speed; cfg.speed = Math.min(400, Math.max(25, patch.speed)); t0 = Date.now() - t / cfg.speed; }   // no jump in the scene
    if (patch.schedule) Object.assign(cfg.schedule, patch.schedule);
    save();
    if (scene) loop();
  }

  // The schedule: on at a time (or at sunset), off at a time. It acts when the clock crosses into or out of that window, so
  // stopping by hand during the evening stays stopped, and a Mac that slept through the moment catches up when it wakes.
  const minutes = (hhmm, now) => { if (hhmm === 'sunset') { const s = sunset(now, cfg.where.lat, cfg.where.lon); return s ? s.getHours() * 60 + s.getMinutes() : 18 * 60; } const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const inWindow = (now = new Date()) => { const m = now.getHours() * 60 + now.getMinutes(), on = minutes(cfg.schedule.on, now), off = minutes(cfg.schedule.off, now); return on <= off ? m >= on && m < off : m >= on || m < off; };
  let was = inWindow();
  setInterval(() => {
    const now = inWindow();
    if (cfg.schedule.enabled && now && !was && !scene) start(cfg.schedule.scene).catch(() => {});
    if (cfg.schedule.enabled && !now && was && scene) stop();
    was = now;
  }, 20000).unref();
  // A scene that was running when the server stopped carries on.
  if (cfg.running) setTimeout(() => start(cfg.running).catch(() => {}), 3000);

  const status = () => {
    const s = sunset(new Date(), cfg.where.lat, cfg.where.lon);
    return { lamps: cfg.lamps, bri: cfg.bri, speed: cfg.speed, schedule: cfg.schedule, running: cfg.running, playing: scene?.id ?? null, tonight: tonight(), sunset: s ? `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}` : null };
  };
  return { start, stop, configure, status };
}
