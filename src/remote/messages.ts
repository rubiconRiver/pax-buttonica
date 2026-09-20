/**
 * Phones as buttons. A phone is just another dumb device: it shows the light it
 * is told to show and reports tap / double / hold. It speaks the same vocabulary
 * as the hardware standard, carried over a WebRTC data channel instead of ESP-NOW.
 */
import type { LedMode } from '../engine/outputs';

export type PhoneToHost = { t: 'hello'; dev: string } | { t: 'btn'; e: 'tap' | 'double' | 'hold' };

export interface PhoneFrame {
  t: 'state';
  /** null until this phone has claimed a seat. */
  name: string | null;
  color: string;
  mode: LedMode;
  reason: string;
  /** During seat claiming: whose turn it is to press. */
  calling: string | null;
  holdMs: number;
  flashMs: number;
  react: { id: number; kind: 'denied' | 'ack' | 'hint' | 'burst' } | null;
}

export const ROOM_PREFIX = 'paxbuttonica-';
/** No 0/O, 1/I/L: codes get read aloud across a table. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export const cleanCode = (raw: string) =>
  raw.toUpperCase().split('').filter((ch) => CODE_ALPHABET.includes(ch)).join('').slice(0, CODE_LENGTH);
