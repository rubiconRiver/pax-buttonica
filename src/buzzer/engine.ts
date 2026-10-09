/**
 * The buzzer quiz: a pure engine, like the game's. Players hold a button each, the host has one too (or the keyboard).
 * The host opens the floor; the first press after that wins it; a press before it is early and locks that button out
 * for a moment; a wrong answer locks its player out for the rest of the question and the floor reopens for the others.
 *
 * Time is whatever clock the caller stamps presses with (the page uses `performance.now()` at the moment the line
 * arrived over USB). The engine only ever compares them. Nothing in here touches the hub: `outputs()` says what every
 * button should show and the page sends it, the way `deriveOutputs` works for the game.
 */
import { PLAYER_COLORS } from '../engine/data';
import type { LedMode } from '../engine/outputs';

/** A press before the floor opens locks that button out for this long. */
export const EARLY_LOCK_MS = 1000;
/** Two presses this close cannot be ordered with confidence: the radio and the hub's serial line sit in between. */
export const PHOTO_FINISH_MS = 8;
/** The host's button, white. */
export const HOST_COLOR = '#e9f0ff';
/** A button nobody has claimed yet, while claiming is possible. */
const CLAIM_COLOR = '#ffffff';
/** The question's worth, by number key. */
export const VALUES = [100, 200, 300, 400, 500, 600, 800, 1000];

export interface Player {
  dev: string;
  name: string;
  color: string;
  score: number;
}

export interface Press {
  dev: string;
  /** Milliseconds after the floor opened. */
  after: number;
}

export type Phase = 'closed' | 'open' | 'won';

export interface BuzzerState {
  host: string | null;
  players: Player[];
  phase: Phase;
  /** The question's worth. */
  value: number;
  /** When the floor was last opened (the caller's clock); the presses are relative to it. */
  openedAt: number | null;
  /** Everyone who pressed since the floor opened, in order; the first is the winner. */
  presses: Press[];
  /** Buttons that pressed early: locked until this time. */
  early: Record<string, number>;
  /** Players who answered wrong this question: no second go. */
  out: string[];
  /** The last thing that happened, for the screen and the sounds. Cleared by the next action. */
  event: Event | null;
  /** Questions decided so far (correct or given up), for the heading. */
  question: number;
}

export type Event =
  | { kind: 'claimed'; dev: string; role: 'host' | 'player' }
  | { kind: 'opened' }
  | { kind: 'closed' }
  | { kind: 'buzz'; dev: string; after: number }
  | { kind: 'early'; dev: string }
  | { kind: 'late'; dev: string; after: number }
  | { kind: 'correct'; dev: string; value: number }
  | { kind: 'wrong'; dev: string; value: number; reopened: boolean }
  | { kind: 'next' };

export type Action =
  /** A press from a button (any gesture that means "pressed"), at the caller's clock. */
  | { type: 'PRESS'; dev: string; at: number }
  /** The host's button: a tap opens or closes the floor, a hold moves to the next question. */
  | { type: 'HOST_TAP'; at: number }
  | { type: 'OPEN'; at: number }
  | { type: 'CLOSE' }
  /** The winner was right: they score, the floor closes. */
  | { type: 'CORRECT' }
  /** The winner was wrong: they lose the value and sit this one out; the floor reopens if anyone is left. */
  | { type: 'WRONG'; at: number }
  /** Next question: floor closed, lockouts cleared. */
  | { type: 'NEXT' }
  | { type: 'SET_VALUE'; value: number }
  | { type: 'SCORE'; dev: string; delta: number }
  | { type: 'RENAME'; dev: string; name: string }
  | { type: 'SET_HOST'; dev: string | null }
  | { type: 'ADD_PLAYER'; dev: string }
  | { type: 'REMOVE_PLAYER'; dev: string }
  | { type: 'RESET_SCORES' };

export const initialState = (): BuzzerState => ({
  host: null,
  players: [],
  phase: 'closed',
  value: 200,
  openedAt: null,
  presses: [],
  early: {},
  out: [],
  event: null,
  question: 0,
});

/** The first player colour no one at the table has. */
export const nextColor = (players: Player[]): string => PLAYER_COLORS.find((c) => !players.some((p) => p.color === c.led))?.led ?? PLAYER_COLORS[0].led;

const playerOf = (s: BuzzerState, dev: string) => s.players.find((p) => p.dev === dev);

const closed = (s: BuzzerState): BuzzerState => ({ ...s, phase: 'closed', openedAt: null, presses: [] });

function open(s: BuzzerState, at: number): BuzzerState {
  return { ...s, phase: 'open', openedAt: at, presses: [], event: { kind: 'opened' } };
}

function press(s: BuzzerState, dev: string, at: number): BuzzerState {
  if (dev === s.host) return hostTap(s, at);
  const player = playerOf(s, dev);
  if (!player) {
    // An unknown button pressed while the floor is closed joins the table; mid-question it is nothing.
    if (s.phase !== 'closed') return s;
    if (!s.host) return { ...s, host: dev, event: { kind: 'claimed', dev, role: 'host' } };
    return addPlayer(s, dev);
  }
  if (s.phase === 'closed') {
    return { ...s, early: { ...s.early, [dev]: at + EARLY_LOCK_MS }, event: { kind: 'early', dev } };
  }
  const after = at - (s.openedAt ?? at);
  if (s.out.includes(dev) || (s.early[dev] ?? 0) > at) return s;
  if (s.presses.some((p) => p.dev === dev)) return s;
  const presses = [...s.presses, { dev, after }];
  if (s.phase === 'won') return { ...s, presses, event: { kind: 'late', dev, after } };
  return { ...s, phase: 'won', presses, event: { kind: 'buzz', dev, after } };
}

function hostTap(s: BuzzerState, at: number): BuzzerState {
  if (s.phase === 'closed') return open(s, at);
  if (s.phase === 'open') return { ...closed(s), event: { kind: 'closed' } };
  return s;
}

function addPlayer(s: BuzzerState, dev: string): BuzzerState {
  if (playerOf(s, dev) || dev === s.host) return s;
  const color = nextColor(s.players);
  const name = PLAYER_COLORS.find((c) => c.led === color)?.name ?? `Player ${s.players.length + 1}`;
  return { ...s, players: [...s.players, { dev, name, color, score: 0 }], event: { kind: 'claimed', dev, role: 'player' } };
}

export const winnerOf = (s: BuzzerState): Player | undefined => (s.phase === 'won' && s.presses[0] ? playerOf(s, s.presses[0].dev) : undefined);

export function reduce(s: BuzzerState, a: Action): BuzzerState {
  s = s.event ? { ...s, event: null } : s;
  switch (a.type) {
    case 'PRESS':
      return press(s, a.dev, a.at);
    case 'HOST_TAP':
      return hostTap(s, a.at);
    case 'OPEN':
      return s.phase === 'closed' ? open(s, a.at) : s;
    case 'CLOSE':
      return s.phase === 'open' ? { ...closed(s), event: { kind: 'closed' } } : s;
    case 'CORRECT': {
      const w = winnerOf(s);
      if (!w) return s;
      return {
        ...closed(s),
        players: s.players.map((p) => (p.dev === w.dev ? { ...p, score: p.score + s.value } : p)),
        out: [],
        question: s.question + 1,
        event: { kind: 'correct', dev: w.dev, value: s.value },
      };
    }
    case 'WRONG': {
      const w = winnerOf(s);
      if (!w) return s;
      const out = [...s.out, w.dev];
      const players = s.players.map((p) => (p.dev === w.dev ? { ...p, score: p.score - s.value } : p));
      const anyoneLeft = s.players.some((p) => !out.includes(p.dev));
      const next = anyoneLeft ? open({ ...s, players, out }, a.at) : { ...closed({ ...s, players }), out: [], question: s.question + 1 };
      return { ...next, event: { kind: 'wrong', dev: w.dev, value: s.value, reopened: anyoneLeft } };
    }
    case 'NEXT':
      return { ...closed(s), out: [], early: {}, question: s.phase === 'won' ? s.question + 1 : s.question, event: { kind: 'next' } };
    case 'SET_VALUE':
      return { ...s, value: a.value };
    case 'SCORE':
      return { ...s, players: s.players.map((p) => (p.dev === a.dev ? { ...p, score: p.score + a.delta } : p)) };
    case 'RENAME':
      return { ...s, players: s.players.map((p) => (p.dev === a.dev ? { ...p, name: a.name } : p)) };
    case 'SET_HOST':
      return { ...s, host: a.dev, players: s.players.filter((p) => p.dev !== a.dev) };
    case 'ADD_PLAYER':
      return addPlayer(s.host === a.dev ? { ...s, host: null } : s, a.dev);
    case 'REMOVE_PLAYER':
      return { ...s, players: s.players.filter((p) => p.dev !== a.dev), out: s.out.filter((d) => d !== a.dev) };
    case 'RESET_SCORES':
      return { ...s, players: s.players.map((p) => ({ ...p, score: 0 })), question: 0 };
  }
}

export interface Light {
  color: string;
  mode: LedMode;
}

/**
 * What every button should show, by device id, for the buttons the page knows about. Closed: the players dim, the
 * host dim white, a button nobody has claimed breathing white so it can be claimed. Open: every player who may
 * answer breathing, the host solid white. Won: the winner solid, everyone else dim, the host in the winner's colour.
 * Locked out (early, or wrong this question): off.
 */
export function outputs(s: BuzzerState, devices: string[], now: number): Map<string, Light> {
  const lights = new Map<string, Light>();
  const winner = winnerOf(s);
  for (const dev of devices) {
    if (dev === s.host) {
      lights.set(dev, s.phase === 'closed' ? { color: HOST_COLOR, mode: 'dim' } : s.phase === 'open' ? { color: HOST_COLOR, mode: 'solid' } : { color: winner?.color ?? HOST_COLOR, mode: 'solid' });
      continue;
    }
    const p = playerOf(s, dev);
    if (!p) {
      lights.set(dev, s.phase === 'closed' ? { color: CLAIM_COLOR, mode: 'pulse' } : { color: '#000000', mode: 'off' });
      continue;
    }
    const locked = s.out.includes(dev) || (s.early[dev] ?? 0) > now;
    if (locked) lights.set(dev, { color: p.color, mode: 'off' });
    else if (s.phase === 'open') lights.set(dev, { color: p.color, mode: 'pulse' });
    else if (s.phase === 'won') lights.set(dev, { color: p.color, mode: winner?.dev === dev ? 'solid' : 'dim' });
    else lights.set(dev, { color: p.color, mode: 'dim' });
  }
  return lights;
}

/** The part of the state worth keeping across a reload: who is who and the scores. */
export const toSaved = (s: BuzzerState) => ({ host: s.host, players: s.players, value: s.value, question: s.question });
export type Saved = ReturnType<typeof toSaved>;
export const fromSaved = (saved: Partial<Saved> | null | undefined): BuzzerState => ({
  ...initialState(),
  host: saved?.host ?? null,
  players: Array.isArray(saved?.players) ? saved.players.filter((p) => p && typeof p.dev === 'string').map((p) => ({ dev: p.dev, name: String(p.name ?? ''), color: String(p.color ?? PLAYER_COLORS[0].led), score: Number(p.score) || 0 })) : [],
  value: VALUES.includes(saved?.value as number) ? (saved!.value as number) : 200,
  question: Number(saved?.question) || 0,
});
