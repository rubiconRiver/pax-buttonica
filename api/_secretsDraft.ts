/**
 * Secret objectives, dealt ahead of game night (/secrets). All of the rules, with no database and no clock of its
 * own, so the function in secrets.ts, the browser tests' stand-in and the unit tests all run the same code.
 *
 * Whoever sets a deal up gets three kinds of link: one of their own (the dashboard), one for each player, and one
 * for whoever pulls the cards from the deck. The promise is that the dashboard can do everything except see a card:
 *  - a player's link shows nothing until they ask, and then locks to the device that asked;
 *  - the puller's link works the same way, and the dashboard says when it was used;
 *  - the dashboard's own view is made here, in `view`, from names, states and times only.
 * So a peek through somebody else's link takes the link away from its owner, who will notice.
 */
import { SECRET_DECK } from './_secretsDeck.js';

export interface Card {
  id: string;
  name: string;
  text: string;
  phase?: string;
}

export interface Seat {
  name: string;
  token: string;
  /** Links this player had before being dealt again: dead, but they still say whose they were. */
  dead: string[];
  options: Card[];
  /** Ids of cards dealt to this seat before, so a new deal never repeats one. */
  past: string[];
  pick: string | null;
  device: string | null;
  openedAt: number | null;
  pickedAt: number | null;
  redeals: number;
}

export interface Draft {
  id: string;
  title: string;
  pok: boolean;
  createdAt: number;
  adminToken: string;
  revealToken: string;
  seats: Seat[];
  reveal: { device: string | null; at: number | null };
}

/** What the rules need from outside: the time, a fair die, and unguessable strings. */
export interface Env {
  now: number;
  /** A whole number from 0 up to, not including, n. */
  int(n: number): number;
  /** A random string of letters and digits. */
  token(length: number): string;
}

/** Something asked for that is not allowed: said to whoever asked, with an HTTP status. */
export class Refusal extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
const DEVICE = /^[A-Za-z0-9-]{8,64}$/;
const ID_LENGTH = 8;
const TOKEN_LENGTH = 22;

export const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The deck a deal draws from. */
export function deckFor(pok: boolean): Card[] {
  return SECRET_DECK.filter((c) => pok || c.set !== 'pok').map((c) => ({ id: slug(c.name), name: c.name, text: c.text, ...(c.phase ? { phase: c.phase } : {}) }));
}

function shuffled<T>(list: T[], env: Env): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = env.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A link is the deal's id and a secret: `<id>-<secret>`. Which secret it is says who is asking. */
export const keyOf = (draft: Pick<Draft, 'id'>, token: string) => `${draft.id}-${token}`;
export function parseKey(key: unknown): { id: string; token: string } | null {
  const m = typeof key === 'string' ? /^([a-z0-9]{8})-([A-Za-z0-9]{16,40})$/.exec(key) : null;
  return m ? { id: m[1], token: m[2] } : null;
}

export function createDraft(input: unknown, env: Env): Draft {
  const b = (input ?? {}) as { names?: unknown; title?: unknown; pok?: unknown };
  if (!Array.isArray(b.names)) throw new Refusal('Who is playing?');
  const names = b.names.map((n) => (typeof n === 'string' ? n.trim().replace(/\s+/g, ' ') : '')).filter(Boolean);
  if (names.length < MIN_PLAYERS) throw new Refusal(`A deal needs at least ${MIN_PLAYERS} players.`);
  if (names.length > MAX_PLAYERS) throw new Refusal(`No more than ${MAX_PLAYERS} players.`);
  if (names.some((n) => n.length > 24)) throw new Refusal('Names can be 24 letters at most.');
  const seen = new Set<string>();
  for (const n of names) {
    if (seen.has(n.toLowerCase())) throw new Refusal(`Two players are called ${n}. Tell them apart.`);
    seen.add(n.toLowerCase());
  }
  const pok = b.pok !== false;
  const deck = shuffled(deckFor(pok), env);
  if (deck.length < names.length * 2) throw new Refusal('The deck is too small for that many players.');
  const title = typeof b.title === 'string' ? b.title.trim().slice(0, 60) : '';
  return {
    id: env.token(ID_LENGTH).toLowerCase(),
    title,
    pok,
    createdAt: env.now,
    adminToken: env.token(TOKEN_LENGTH),
    revealToken: env.token(TOKEN_LENGTH),
    seats: names.map((name, i) => ({
      name,
      token: env.token(TOKEN_LENGTH),
      dead: [],
      options: [deck[i * 2], deck[i * 2 + 1]],
      past: [],
      pick: null,
      device: null,
      openedAt: null,
      pickedAt: null,
      redeals: 0,
    })),
    reveal: { device: null, at: null },
  };
}

export type Who = { role: 'admin' } | { role: 'reveal' } | { role: 'player'; seat: number } | { role: 'replaced'; seat: number };

export function whoIs(draft: Draft, token: string): Who | null {
  if (token === draft.adminToken) return { role: 'admin' };
  if (token === draft.revealToken) return { role: 'reveal' };
  const seat = draft.seats.findIndex((s) => s.token === token);
  if (seat >= 0) return { role: 'player', seat };
  const old = draft.seats.findIndex((s) => s.dead.includes(token));
  return old >= 0 ? { role: 'replaced', seat: old } : null;
}

export type SeatState = 'sealed' | 'choosing' | 'picked';
const stateOf = (s: Seat): SeatState => (s.pick ? 'picked' : s.device ? 'choosing' : 'sealed');

export interface AdminView {
  role: 'admin';
  title: string;
  createdAt: number;
  deck: number;
  seats: { name: string; key: string; state: SeatState; openedAt: number | null; pickedAt: number | null; redeals: number }[];
  reveal: { key: string; at: number | null };
}
export interface PlayerView {
  role: 'player';
  title: string;
  name: string;
  /** `elsewhere`: opened on another device. `replaced`: this link was swapped for a new one. */
  state: SeatState | 'elsewhere' | 'replaced';
  options?: Card[];
  pick?: string | null;
}
export interface RevealView {
  role: 'reveal';
  title: string;
  state: 'sealed' | 'open' | 'elsewhere';
  at: number | null;
  seats: { name: string; state: SeatState; card?: Card }[];
}
export type View = AdminView | PlayerView | RevealView;

const okDevice = (dev: unknown): dev is string => typeof dev === 'string' && DEVICE.test(dev);

/** What a link shows, to the device asking. The only place a card leaves the deal. */
export function view(draft: Draft, who: Who, dev: unknown): View {
  if (who.role === 'admin') {
    return {
      role: 'admin',
      title: draft.title,
      createdAt: draft.createdAt,
      deck: deckFor(draft.pok).length,
      seats: draft.seats.map((s) => ({ name: s.name, key: keyOf(draft, s.token), state: stateOf(s), openedAt: s.openedAt, pickedAt: s.pickedAt, redeals: s.redeals })),
      reveal: { key: keyOf(draft, draft.revealToken), at: draft.reveal.at },
    };
  }
  if (who.role === 'reveal') {
    const mine = !!draft.reveal.device && draft.reveal.device === dev;
    return {
      role: 'reveal',
      title: draft.title,
      state: !draft.reveal.device ? 'sealed' : mine ? 'open' : 'elsewhere',
      at: draft.reveal.at,
      seats: draft.seats.map((s) => {
        const card = mine && s.pick ? s.options.find((c) => c.id === s.pick) : undefined;
        return { name: s.name, state: stateOf(s), ...(card ? { card } : {}) };
      }),
    };
  }
  const s = draft.seats[who.seat];
  const base = { role: 'player' as const, title: draft.title, name: s.name };
  if (who.role === 'replaced') return { ...base, state: 'replaced' };
  if (!s.device) return { ...base, state: 'sealed' };
  if (s.device !== dev) return { ...base, state: 'elsewhere' };
  return { ...base, state: stateOf(s), options: s.options, pick: s.pick };
}

export type Op = { op: 'open' } | { op: 'pick'; card: unknown } | { op: 'redeal'; seat: unknown } | { op: 'reveal' };

/** Something a link's holder does. Returns the deal as it then stands; the one passed in is left alone. */
export function apply(draft: Draft, who: Who, op: Op, dev: unknown, env: Env): Draft {
  const next: Draft = structuredClone(draft);
  if (op.op === 'redeal') {
    if (who.role !== 'admin') throw new Refusal('Only the dashboard can deal again.', 403);
    const s = next.seats[typeof op.seat === 'number' ? op.seat : -1];
    if (!s) throw new Refusal('No such player.');
    const taken = new Set([...next.seats.flatMap((x) => x.options.map((c) => c.id)), ...s.past]);
    const pool = shuffled(deckFor(next.pok).filter((c) => !taken.has(c.id)), env);
    if (pool.length < 2) throw new Refusal('The deck has run out of fresh cards for this player.');
    s.past.push(...s.options.map((c) => c.id));
    s.dead.push(s.token);
    s.token = env.token(TOKEN_LENGTH);
    s.options = [pool[0], pool[1]];
    s.pick = null;
    s.device = null;
    s.openedAt = null;
    s.pickedAt = null;
    s.redeals += 1;
    return next;
  }
  if (!okDevice(dev)) throw new Refusal('This browser did not say which device it is.');
  if (op.op === 'reveal') {
    if (who.role !== 'reveal') throw new Refusal("Only the card puller's link can reveal.", 403);
    if (next.reveal.device && next.reveal.device !== dev) throw new Refusal('The picks have already been revealed on another device.', 409);
    if (!next.reveal.device) next.reveal = { device: dev, at: env.now };
    return next;
  }
  if (who.role === 'replaced') throw new Refusal('This link has been replaced by a new one.', 410);
  if (who.role !== 'player') throw new Refusal("Only a player's own link can do that.", 403);
  const s = next.seats[who.seat];
  if (op.op === 'open') {
    if (s.device && s.device !== dev) throw new Refusal('This link has already been opened on another device.', 409);
    if (!s.device) {
      s.device = dev;
      s.openedAt = env.now;
    }
    return next;
  }
  if (op.op === 'pick') {
    if (s.device !== dev) throw new Refusal('Open the link on this device first.', 409);
    if (!s.options.some((c) => c.id === op.card)) throw new Refusal('That is not one of your two cards.');
    if (s.pick && s.pick !== op.card) throw new Refusal('You have already chosen.', 409);
    if (!s.pick) {
      s.pick = op.card as string;
      s.pickedAt = env.now;
    }
    return next;
  }
  throw new Refusal('Unknown request.');
}
