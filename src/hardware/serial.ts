/**
 * EXPERIMENTAL — written against the draft standard, not yet tested on real
 * hardware (none exists yet). Web Serial needs Chrome or Edge, and HTTPS.
 */
import { levelsOf, type DeviceOutput, type TurnLook } from '../engine/outputs';
import type { DeviceInput } from '../engine/types';
import { createStore } from '../state/createStore';
import { settingsStore } from '../state/settings';
import { inputFor, ledFrame, type DeviceCaps, type FromDevice, type ToDevice } from './protocol';

// Minimal Web Serial typings (not yet in TypeScript's DOM lib).
interface SerialPortLike {
  open(opts: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}
interface SerialLike {
  requestPort(options?: { filters?: { usbVendorId: number }[] }): Promise<SerialPortLike>;
  /** Ports this site has been allowed before; they can be opened again without a chooser. */
  getPorts?(): Promise<SerialPortLike[]>;
}
const serial = (): SerialLike | undefined => (navigator as unknown as { serial?: SerialLike }).serial;
/** Espressif's USB vendor id: every Atom, and nothing else on the laptop, so the chooser doesn't list Bluetooth. */
const ESPRESSIF = 0x303a;

export const serialSupported = () => !!serial();

export interface HubDevice {
  dev: string;
  fw?: string;
  caps?: DeviceCaps;
  /** Battery millivolts, if the button reports them. */
  mv?: number;
  /** Signal strength at the hub, dBm. Around -50 is excellent; below about -80 is getting marginal. */
  dbm?: number;
  lost?: boolean;
}

export interface HubStatus {
  connected: boolean;
  hubFw?: string;
  /** Every button that has spoken since the hub was connected. */
  devices: HubDevice[];
  /** Recent traffic, newest last — for the test bench. */
  log: { id: number; dir: 'in' | 'out'; text: string }[];
  error?: string;
}

export const hubStatus = createStore<HubStatus>({ connected: false, devices: [], log: [] });

let port: SerialPortLike | null = null;
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
let onInput: ((dev: string, input: DeviceInput) => void) | null = null;
let logSeq = 0;
const lastFrames = new Map<string, string>();
/** Buttons whose last light said a hold means nothing right now (`h: 0`). */
const toldNoHold = new Set<string>();
const enc = new TextEncoder();

/** How each seat likes its button: the player's own taste on top of the table's. */
export interface SeatPrefs {
  look: TurnLook;
  /** Their share of the table's brightness, 0.1–1: it scales all three levels on their button. */
  bright: number;
}
/** What each button was last told about its taste, so a cfg only goes out when that changes. */
const prefs = new Map<string, SeatPrefs>();

/** Everything a button is configured with: hold and blink times and light levels for the table, look and brightness for its seat. */
function cfgFrame(dev: string): ToDevice {
  const settings = settingsStore.get();
  const { turn, waiting, effects } = levelsOf(settings);
  const mine = prefs.get(dev);
  const level = (x: number) => Math.max(1, Math.round(x * (mine?.bright ?? 1) * 100));
  return {
    t: 'cfg',
    dev,
    hold: settings.holdMs,
    flash: settings.flashMs,
    bright: level(turn),
    dim: level(waiting),
    fx: level(effects),
    pulse: mine?.look ?? settings.turnLight,
  };
}

/** Inputs are reported by device id; the game decides which seat that is. */
export function setInputHandler(fn: typeof onInput) {
  onInput = fn;
}

function record(dir: 'in' | 'out', text: string) {
  hubStatus.set((s) => ({ ...s, log: [...s.log, { id: ++logSeq, dir, text }].slice(-120) }));
}

export function sendToDevice(msg: ToDevice) {
  if (!writer) return;
  const line = JSON.stringify(msg);
  record('out', line);
  void writer.write(enc.encode(line + '\n'));
}

/** True if this device id is a real button on the hub that can play note lists itself. */
export function playsOwnSounds(dev: string | null): boolean {
  if (!dev || !writer) return false;
  return hubStatus.get().devices.some((d) => d.dev === dev && d.caps?.audio === 'tones' && !d.lost);
}

export const isOnHub = (dev: string | null) => !!dev && !!writer && hubStatus.get().devices.some((d) => d.dev === dev);

/** "0.3.10" is later than "0.3.9". */
const fwAtLeast = (fw: string, min: string) => {
  const a = fw.split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < b.length; i++) if ((a[i] || 0) !== b[i]) return (a[i] || 0) > b[i];
  return true;
};

/**
 * True if this button has already shown a refused hold by itself: it was told `h: 0`, and its firmware (0.3.9 on)
 * draws the refusal when the hold time is up. The host's own `denied` on top would only make it shake twice.
 */
export function refusedHoldItself(dev: string): boolean {
  const fw = hubStatus.get().devices.find((d) => d.dev === dev)?.fw;
  return toldNoHold.has(dev) && !!fw && fwAtLeast(fw, '0.3.9');
}

function patch(dev: string, next: Partial<HubDevice>) {
  const known = hubStatus.get().devices.some((d) => d.dev === dev);
  hubStatus.set((s) => ({
    ...s,
    devices: known ? s.devices.map((d) => (d.dev === dev ? { ...d, ...next } : d)) : [...s.devices, { dev, ...next }],
  }));
  if (!known) {
    lastFrames.delete(dev);
    sendToDevice(cfgFrame(dev));
  }
}

function handle(msg: FromDevice) {
  switch (msg.t) {
    case 'hub':
      hubStatus.set((s) => ({ ...s, hubFw: msg.fw }));
      break;
    case 'hello': {
      // A hello is either a heartbeat or a button that has just (re)booted and remembers nothing.
      // They look the same from here, so tell it everything again: settings now, its light on the next sync.
      const known = hubStatus.get().devices.some((d) => d.dev === msg.dev);
      lastFrames.delete(msg.dev);
      patch(msg.dev, { fw: msg.fw, caps: msg.caps, lost: false });
      if (known) sendToDevice(cfgFrame(msg.dev));
      break;
    }
    case 'bat':
      patch(msg.dev, { mv: msg.mv });
      break;
    case 'rssi':
      patch(msg.dev, { dbm: msg.dbm });
      break;
    case 'lost':
      patch(msg.dev, { lost: true });
      lastFrames.delete(msg.dev);
      break;
    case 'btn': {
      patch(msg.dev, { lost: false });
      const input = inputFor(msg.b, msg.e);
      if (input) onInput?.(msg.dev, input);
      break;
    }
  }
}

// Hold time, blink speed, light levels and the table's look follow the settings, live.
settingsStore.subscribe(() => {
  for (const d of hubStatus.get().devices) sendToDevice(cfgFrame(d.dev));
});

async function readLoop(p: SerialPortLike) {
  const reader = p.readable!.pipeThrough(new TextDecoderStream() as unknown as ReadableWritablePair<string, Uint8Array>).getReader();
  let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('{')) continue; // boot chatter from the hub
        record('in', line);
        try {
          handle(JSON.parse(line) as FromDevice);
        } catch {
          // ignore malformed lines
        }
      }
    }
  } catch (e) {
    hubStatus.set((s) => ({ ...s, error: String(e) }));
  } finally {
    hubStatus.set((s) => ({ ...s, connected: false }));
    port = null;
    writer = null;
  }
}

/**
 * Open a port for a moment and ask what's on it. A hub says so; a button says so too (and blinks). Anything else,
 * or silence, is null. The port is closed again either way.
 */
async function whatIs(p: SerialPortLike): Promise<'hub' | 'button' | null> {
  let answer: 'hub' | 'button' | null = null;
  try {
    await p.open({ baudRate: 115200 });
    const w = p.writable!.getWriter();
    await w.write(enc.encode('{"t":"hub?"}\n'));
    w.releaseLock();
    const reader = p.readable!.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const until = Date.now() + 1500;
    while (!answer && Date.now() < until) {
      const chunk = await Promise.race([reader.read(), new Promise<{ value?: Uint8Array; done: boolean }>((r) => setTimeout(() => r({ done: false }), until - Date.now()))]);
      if (chunk.done) break;
      if (!chunk.value) continue;
      buf += dec.decode(chunk.value);
      for (const line of buf.split('\n').slice(0, -1)) {
        try {
          const t = (JSON.parse(line.trim()) as { t?: string }).t;
          if (t === 'hub' || t === 'button') answer = t;
        } catch { /* boot chatter */ }
      }
      buf = buf.slice(buf.lastIndexOf('\n') + 1);
    }
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  } catch { /* busy, unplugged, or not ours */ }
  await p.close().catch(() => {});
  return answer;
}

async function openHub(p: SerialPortLike) {
  await p.open({ baudRate: 115200 });
  port = p;
  writer = p.writable!.getWriter();
  lastFrames.clear();
  toldNoHold.clear();
  prefs.clear();
  hubStatus.set({ connected: true, devices: [], log: [] });
  // Anything without a "dev" makes the hub announce itself, and buttons re-announce on their heartbeat.
  void writer.write(enc.encode('{"t":"hub?"}\n'));
  void readLoop(p);
}

/**
 * Connect to the hub. Atoms this site has been allowed before are tried first, silently: each is asked what it is
 * and the one that says "hub" is used, so a plugged-in hub connects with no chooser at all. Only if none of them is
 * the hub does the browser's chooser appear (which needs a click), and it lists Espressif chips only.
 * `silent` never shows the chooser: for connecting on page load.
 */
export async function connectHub({ silent = false } = {}) {
  const api = serial();
  if (!api || port) return;
  try {
    for (const p of (await api.getPorts?.()) ?? []) {
      if ((await whatIs(p)) === 'hub') {
        await openHub(p);
        return;
      }
    }
    if (silent) return;
    await openHub(await api.requestPort({ filters: [{ usbVendorId: ESPRESSIF }] }));
  } catch (e) {
    port = null;
    writer = null;
    if ((e as DOMException).name !== 'NotFoundError') hubStatus.set((s) => ({ ...s, error: String(e) }));
  }
}

const DARK: DeviceOutput = { color: '#000000', mode: 'off', reason: '' };

/**
 * Push light states to real buttons; only what changed goes over the wire.
 * `unclaimed` is what buttons without a seat should show (null = stay dark).
 * `seatPrefs`, per seat, is how that player likes their button drawn; a button without a seat follows the table.
 */
export function syncOutputs(bindings: (string | null)[], outputs: DeviceOutput[], unclaimed: DeviceOutput | null, seatPrefs: (SeatPrefs | undefined)[] = []) {
  if (!writer) return;
  for (const { dev, lost } of hubStatus.get().devices) {
    if (lost) continue;
    const seat = bindings.indexOf(dev);
    const mine = seat >= 0 ? seatPrefs[seat] : undefined;
    const was = prefs.get(dev);
    if (mine?.look !== was?.look || mine?.bright !== was?.bright) {
      if (mine) prefs.set(dev, mine);
      else prefs.delete(dev);
      sendToDevice(cfgFrame(dev));
    }
    const o = seat >= 0 ? outputs[seat] : unclaimed ?? DARK;
    const key = `${o.color}|${o.mode}|${o.hold !== false}`;
    if (lastFrames.get(dev) === key) continue;
    lastFrames.set(dev, key);
    if (o.hold === false) toldNoHold.add(dev);
    else toldNoHold.delete(dev);
    sendToDevice(ledFrame(dev, o, settingsStore.get().flashMs));
  }
}
