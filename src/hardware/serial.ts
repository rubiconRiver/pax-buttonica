/**
 * EXPERIMENTAL — written against the draft standard, not yet tested on real
 * hardware (none exists yet). Web Serial needs Chrome or Edge, and HTTPS.
 */
import type { DeviceOutput } from '../engine/outputs';
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
    const { holdMs, flashMs } = settingsStore.get();
    sendToDevice({ t: 'cfg', dev, hold: holdMs, flash: flashMs });
  }
}

function handle(msg: FromDevice) {
  switch (msg.t) {
    case 'hub':
      hubStatus.set((s) => ({ ...s, hubFw: msg.fw }));
      break;
    case 'hello':
      patch(msg.dev, { fw: msg.fw, caps: msg.caps, lost: false });
      break;
    case 'bat':
      patch(msg.dev, { mv: msg.mv });
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

// Hold time and blink speed follow the settings, live.
settingsStore.subscribe(() => {
  const { holdMs, flashMs } = settingsStore.get();
  for (const d of hubStatus.get().devices) sendToDevice({ t: 'cfg', dev: d.dev, hold: holdMs, flash: flashMs });
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
 */
export function syncOutputs(bindings: (string | null)[], outputs: DeviceOutput[], unclaimed: DeviceOutput | null) {
  if (!writer) return;
  for (const { dev, lost } of hubStatus.get().devices) {
    if (lost) continue;
    const seat = bindings.indexOf(dev);
    const o = seat >= 0 ? outputs[seat] : unclaimed ?? DARK;
    const key = `${o.color}|${o.mode}`;
    if (lastFrames.get(dev) === key) continue;
    lastFrames.set(dev, key);
    sendToDevice(ledFrame(dev, o, settingsStore.get().flashMs));
  }
}
