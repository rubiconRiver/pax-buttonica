/**
 * Pax Buttonica button standard, draft v0 — wire types.
 * The human-readable spec lives in docs/BUTTON_STANDARD.md; keep the two in step.
 *
 * Transport: newline-delimited JSON over USB serial (115200 baud) between the
 * browser and the hub. The hub relays each message to/from buttons over ESP-NOW.
 */
import type { DeviceOutput, LedMode } from '../engine/outputs';
import type { DeviceInput } from '../engine/types';
import type { Note, Wave } from '../audio/jingles';

export const PROTOCOL_VERSION = 0;

export interface DeviceCaps {
  /** Number of physical buttons. Button 0 is always the big one. */
  btn: number;
  /** 'rgb' = one colour for the whole dome, 'ring' = addressable pixels, 'none'. */
  led: 'rgb' | 'ring' | 'none';
  /** 'tones' = can play note lists, 'none' = silent (the host plays sounds instead). */
  audio: 'tones' | 'none';
}

export type Gesture = 'tap' | 'double' | 'hold';

export type FromDevice =
  | { t: 'hub'; v: number; fw: string }
  | { t: 'hello'; dev: string; fw: string; caps: DeviceCaps }
  | { t: 'btn'; dev: string; b: number; e: Gesture }
  | { t: 'bat'; dev: string; mv: number }
  | { t: 'lost'; dev: string };

export type ToDevice =
  | { t: 'led'; dev: string; c: string; m: LedMode }
  | { t: 'snd'; dev: string; w: Wave; n: Note[] }
  | { t: 'fx'; dev: string; k: 'ack' | 'denied' | 'confirm' }
  | { t: 'cfg'; dev: string; hold: number; flash?: number }
  | { t: 'id'; dev: string };

/**
 * Button roles. A one-button device only ever sends b:0; devices with more
 * buttons get shortcuts. Unknown indexes are ignored, so extra buttons are
 * harmless until the standard gives them a job.
 */
export function inputFor(b: number, e: Gesture): DeviceInput | null {
  if (b === 0) return e;
  if (e !== 'tap') return null;
  if (b === 1) return 'strategy';
  if (b === 2) return 'pass';
  return null;
}

export const ledFrame = (dev: string, o: DeviceOutput): ToDevice => ({
  t: 'led',
  dev,
  c: o.color.replace('#', ''),
  m: o.mode,
});
