/**
 * Phones as buttons. A phone is just another dumb device: it shows the light it
 * is told to show and reports tap / double / hold. It speaks the same vocabulary
 * as the hardware standard, carried over a WebRTC data channel instead of ESP-NOW.
 */
import type { LedMode } from '../engine/outputs';
import { colorById } from '../engine/data';
import type { ExtraPoints, GameState, Law, Objective, SoundRef } from '../engine/types';

/** Just enough of a profile to pick yourself out of a list. */
export interface ProfileCard {
  id: string;
  name: string;
  color: string;
}

/** What a player sees and edits about themselves from their phone. */
export interface MyProfile extends ProfileCard {
  intro: SoundRef;
  outro: SoundRef;
}

export const MAX_CLIP_TRANSFER = 4 * 1024 * 1024;

export type PhoneToHost =
  | { t: 'hello'; dev: string; profileId?: string | null }
  | { t: 'btn'; e: 'tap' | 'double' | 'hold' }
  /** "I'm this person." No password: it's a board game. */
  | { t: 'iam'; id: string }
  | { t: 'create'; name: string }
  | { t: 'leave' }
  | { t: 'edit'; patch: { name?: string; color?: string; intro?: SoundRef; outro?: SoundRef } }
  /** An uploaded sound: over the direct link the bytes come along; through the site the phone uploads it first and sends the id. */
  | { t: 'clip'; slot: 'intro' | 'outro'; name: string; mime?: string; data?: ArrayBuffer; id?: string };

/** What the host leaves for one phone on the site, when the phone can't reach the laptop directly. */
export interface RelayPhone {
  state?: PhoneFrame;
  /** undefined: the host hasn't said yet. */
  me?: MyProfile | null;
  oops?: { seq: number; message: string };
}

export interface RelayRoom {
  table: TableSnapshot | null;
  profiles: ProfileCard[];
  phones: Record<string, RelayPhone>;
}

/** Everything a player might want to check from their seat: the public state of the game, nothing hidden. */
export interface TableSnapshot {
  round: number;
  phase: string;
  vpTarget: number;
  active: number | null;
  speaker: number;
  custodiansRemoved: boolean;
  ready: boolean[];
  players: { name: string; color: string; faction: string; vp: number; cards: number[]; used: number[]; passed: boolean; secrets: string[]; extras: ExtraPoints[] }[];
  objectives: Objective[];
  laws: Law[];
}

export const snapshotOf = (g: GameState): TableSnapshot => ({
  round: g.round,
  phase: g.seating ? 'seating' : g.phase,
  vpTarget: g.vpTarget,
  active: g.active,
  speaker: g.speaker,
  custodiansRemoved: g.custodiansRemoved,
  ready: g.ready,
  players: g.players.map((p) => ({ name: p.name, color: colorById(p.color).led, faction: p.faction, vp: p.vp, cards: p.cards, used: p.usedCards, passed: p.passed, secrets: p.secrets, extras: p.extras })),
  objectives: g.objectives,
  laws: g.laws,
});

export type HostToPhone =
  | PhoneFrame
  | { t: 'table'; table: TableSnapshot }
  | { t: 'profiles'; list: ProfileCard[] }
  | { t: 'me'; profile: MyProfile | null }
  | { t: 'oops'; message: string };

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
