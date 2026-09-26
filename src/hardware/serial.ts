/**
 * EXPERIMENTAL — written against the draft standard, not yet tested on real
 * hardware (none exists yet). Web Serial needs Chrome or Edge, and HTTPS.
 */
import { clampBrightness, type DeviceOutput, type TurnLook } from '../engine/outputs';
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
  requestPort(): Promise<SerialPortLike>;
}
const serial = (): SerialLike | undefined => (navigator as unknown as { serial?: SerialLike }).serial;

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
const enc = new TextEncoder();

/** How each seat likes its button: the player's own taste on top of the table's. */
export interface SeatPrefs {
  look: TurnLook;
  /** Their share of the table's brightness, 0.1–1. */
  bright: number;
}
/** What each button was last told about its taste, so a cfg only goes out when that changes. */
const prefs = new Map<string, SeatPrefs>();

/** Everything a button is configured with: hold and blink times for the table, look and brightness for its seat. */
function cfgFrame(dev: string): ToDevice {
  const { holdMs, flashMs, turnLight, brightness } = settingsStore.get();
  const mine = prefs.get(dev);
  return {
    t: 'cfg',
    dev,
    hold: holdMs,
    flash: flashMs,
    bright: Math.round(clampBrightness(brightness) * (mine?.bright ?? 1) * 100),
    pulse: mine?.look ?? turnLight,
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

// Hold time, blink speed, brightness and the table's look follow the settings, live.
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

/** Must be called from a click: the browser shows its own port picker. */
export async function connectHub() {
  const api = serial();
  if (!api) return;
  try {
    port = await api.requestPort();
    await port.open({ baudRate: 115200 });
    writer = port.writable!.getWriter();
    lastFrames.clear();
    prefs.clear();
    hubStatus.set({ connected: true, devices: [], log: [] });
    // Anything without a "dev" makes the hub announce itself, and buttons re-announce on their heartbeat.
    void writer.write(enc.encode('{"t":"hub?"}\n'));
    void readLoop(port);
  } catch (e) {
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
    const key = `${o.color}|${o.mode}`;
    if (lastFrames.get(dev) === key) continue;
    lastFrames.set(dev, key);
    sendToDevice(ledFrame(dev, o, settingsStore.get().flashMs));
  }
}
