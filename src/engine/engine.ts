import { NAALU, cardByNumber } from './data';
import type { Action, DeviceInput, Fx, GameOptions, GameState, LogEntry, Player, PlayerSetup } from './types';

const MAX_LOG = 300;
const MAX_FX = 16;
/** Taps from the card's owner are ignored for this long after the card comes out. */
export const PRIMARY_GUARD_MS = 600;

/** How long every light celebrates the end of a round before scoring, unless the table says otherwise. */
export const DEFAULT_FANFARE_MS = 4000;

export const cardsPerPlayer = (playerCount: number) => (playerCount <= 4 ? 2 : 1);

/** Id of the simulated on-screen button at a given spot round the table. */
export const simDevice = (spot: number) => `sim-${spot}`;

// ── Construction ────────────────────────────────────────────────────────────

/** No 0/O, 1/I/L: codes get read aloud across a table. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;
export const cleanCode = (raw: string) =>
  raw.toUpperCase().split('').filter((ch) => CODE_ALPHABET.includes(ch)).join('').slice(0, CODE_LENGTH);
export const newCode = () => {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
};

export function createGame(setups: PlayerSetup[], options: GameOptions, at: number): GameState {
  const players: Player[] = setups.map((s) => ({
    ...s,
    vp: 0,
    secrets: [],
    extras: [],
    cards: [],
    usedCards: [],
    passed: false,
    timeMs: 0,
    turns: 0,
  }));
  const naalu = players.findIndex((p) => p.faction === NAALU);
  const g: GameState = {
    code: options.code ?? newCode(),
    phase: 'strategy',
    round: 0,
    vpTarget: options.vpTarget,
    players,
    speaker: options.speaker,
    zeroToken: naalu >= 0 ? naalu : null,
    custodiansRemoved: false,
    objectives: [],
    laws: [],
    idSeq: 0,
    primaryStage: options.primaryStage ?? true,
    pickOrder: [],
    pickIdx: 0,
    tradeGoods: Array(8).fill(0),
    active: null,
    actedThisTurn: false,
    strategyPlay: null,
    choosingCard: false,
    statusStep: 'tidy',
    scoringOrder: [],
    scoringIdx: 0,
    ready: [],
    fanfareMs: options.fanfareMs ?? DEFAULT_FANFARE_MS,
    scoreInOrder: options.scoreInOrder ?? true,
    agenda: null,
    winner: null,
    bindings: players.map((_, i) => (options.seating ? null : simDevice(i))),
    devices: {},
    seating: options.seating ? { next: 0, resume: false } : null,
    clockStartedAt: null,
    clockBanked: 0,
    paused: false,
    fx: [],
    fxSeq: 0,
    log: [],
    logSeq: 0,
  };
  startRound(g, at);
  return g;
}

// ── Queries ─────────────────────────────────────────────────────────────────

export function initiative(g: GameState, seat: number): number {
  if (g.zeroToken === seat) return 0;
  const cards = g.players[seat].cards;
  return cards.length ? Math.min(...cards) : 99;
}

/** Seats sorted by initiative, lowest first. */
export function initiativeOrder(g: GameState): number[] {
  return g.players.map((_, i) => i).sort((a, b) => initiative(g, a) - initiative(g, b) || a - b);
}

export function unusedCards(p: Player): number[] {
  return p.cards.filter((c) => !p.usedCards.includes(c));
}

export function cardHolder(g: GameState, card: number): number | null {
  const i = g.players.findIndex((p) => p.cards.includes(card));
  return i >= 0 ? i : null;
}

export function pendingAcks(g: GameState): number[] {
  if (!g.strategyPlay) return [];
  return g.strategyPlay.acks.flatMap((ok, i) => (ok ? [] : [i]));
}

export function currentPicker(g: GameState): number | null {
  return g.phase === 'strategy' ? g.pickOrder[g.pickIdx] ?? null : null;
}

export function currentVoter(g: GameState): number | null {
  return g.phase === 'agenda' && g.agenda ? g.agenda.order[g.agenda.idx] ?? null : null;
}

/** Whose turn it is to score, while the status phase goes round the table. */
export function currentScorer(g: GameState): number | null {
  return g.phase === 'status' && g.statusStep === 'scoring' ? g.scoringOrder[g.scoringIdx] ?? null : null;
}

/**
 * The order players act in right now: who chooses next in the strategy phase, initiative order for the action and
 * status phases, voting order in the agenda phase. Seat order while seats are still being claimed.
 */
export function turnOrder(g: GameState): number[] {
  const seats = g.players.map((_, i) => i);
  if (g.seating) return seats;
  switch (g.phase) {
    case 'strategy':
      return [...new Set(g.pickOrder)];
    case 'agenda':
      return g.agenda?.order ?? seats;
    default:
      return initiativeOrder(g);
  }
}

/**
 * Where each seat is drawn (seat → spot). A seat bound to a simulated button
 * lives where that button is; everyone else fills the free spots in order.
 * Unclaimed seats get -1 while claiming is in progress.
 */
export function seatSpots(g: GameState): number[] {
  const n = g.players.length;
  const spots: number[] = Array(n).fill(-1);
  const taken = new Set<number>();
  g.bindings.forEach((dev, seat) => {
    const m = dev?.match(/^sim-(\d+)$/);
    if (m && +m[1] < n && !taken.has(+m[1])) {
      spots[seat] = +m[1];
      taken.add(+m[1]);
    }
  });
  g.bindings.forEach((dev, seat) => {
    if (spots[seat] >= 0 || (!dev && g.seating)) return;
    for (let p = 0; p < n; p++) {
      if (!taken.has(p)) {
        spots[seat] = p;
        taken.add(p);
        break;
      }
    }
  });
  return spots;
}

/** Where a player's points come from. */
export function scoreBreakdown(g: GameState, seat: number) {
  const p = g.players[seat];
  const publics = g.objectives.filter((o) => o.scoredBy.includes(seat));
  const fromPublics = publics.reduce((t, o) => t + o.points, 0);
  const fromExtras = p.extras.reduce((t, e) => t + e.points, 0);
  return { publics, fromPublics, fromSecrets: p.secrets.length, fromExtras, total: Math.max(0, fromPublics + p.secrets.length + fromExtras) };
}

/** Live elapsed time of the running turn. */
export function turnElapsed(g: GameState, now: number): number {
  return g.clockBanked + (g.clockStartedAt != null ? Math.max(0, now - g.clockStartedAt) : 0);
}

/** Why the active player can't end their turn right now, or null if they can. */
export function endTurnBlocker(g: GameState): string | null {
  if (g.phase !== 'action' || g.active == null) return 'Not in the action phase';
  if (g.choosingCard) return 'Choose which strategy card first';
  if (g.strategyPlay?.stage === 'primary') return 'Finish the primary first — tap when done';
  const waiting = pendingAcks(g);
  if (waiting.length) {
    const names = waiting.map((s) => g.players[s].name).join(', ');
    return `Waiting on ${names}`;
  }
  return null;
}

// ── Helpers (mutate a draft) ────────────────────────────────────────────────

function fx(g: GameState, f: Omit<Fx, 'id'>) {
  g.fxSeq += 1;
  g.fx.push({ ...f, id: g.fxSeq });
  if (g.fx.length > MAX_FX) g.fx.splice(0, g.fx.length - MAX_FX);
}

function log(g: GameState, text: string, extra: Partial<LogEntry> = {}) {
  g.logSeq += 1;
  g.log.push({ id: g.logSeq, round: g.round, text, ...extra });
  if (g.log.length > MAX_LOG) g.log.splice(0, g.log.length - MAX_LOG);
}

function deny(g: GameState, seat: number, why: string) {
  fx(g, { kind: 'denied', seat, note: why });
  log(g, `${g.players[seat].name}: ${why}`, { seat, tone: 'warn' });
}

function clockStart(g: GameState, at: number) {
  g.clockBanked = 0;
  g.clockStartedAt = g.paused ? null : at;
}

function clockStop(g: GameState, at: number): number {
  const total = turnElapsed(g, at);
  g.clockBanked = 0;
  g.clockStartedAt = null;
  return total;
}

function startRound(g: GameState, _at: number) {
  g.round += 1;
  g.phase = 'strategy';
  g.active = null;
  g.actedThisTurn = false;
  g.strategyPlay = null;
  g.choosingCard = false;
  g.agenda = null;
  g.ready = [];
  for (const p of g.players) {
    p.cards = [];
    p.usedCards = [];
    p.passed = false;
  }
  const n = g.players.length;
  const once = Array.from({ length: n }, (_, i) => (g.speaker + i) % n);
  g.pickOrder = cardsPerPlayer(n) === 2 ? [...once, ...once] : once;
  g.pickIdx = 0;
  log(g, `Round ${g.round} — strategy phase. ${g.players[g.speaker].name} is speaker.`, { tone: 'info' });
  fx(g, { kind: 'phase', note: 'strategy' });
}

function startActionPhase(g: GameState, at: number) {
  // Unchosen cards collect a trade good.
  for (let c = 1; c <= 8; c++) if (cardHolder(g, c) == null) g.tradeGoods[c - 1] += 1;
  g.phase = 'action';
  log(g, 'Action phase begins.', { tone: 'info' });
  fx(g, { kind: 'phase', note: 'action' });
  beginTurn(g, initiativeOrder(g)[0], at);
}

function beginTurn(g: GameState, seat: number, at: number) {
  g.active = seat;
  g.actedThisTurn = false;
  g.strategyPlay = null;
  g.choosingCard = false;
  g.players[seat].turns += 1;
  clockStart(g, at);
  fx(g, { kind: 'turnStart', seat });
}

function nextSeat(g: GameState, after: number): number | null {
  const order = initiativeOrder(g);
  const start = order.indexOf(after);
  for (let k = 1; k <= order.length; k++) {
    const s = order[(start + k) % order.length];
    if (!g.players[s].passed) return s;
  }
  return null;
}

function finishTurn(g: GameState, at: number, how: 'end' | 'pass') {
  const seat = g.active!;
  g.players[seat].timeMs += clockStop(g, at);
  g.strategyPlay = null;
  g.choosingCard = false;
  fx(g, { kind: how === 'pass' ? 'pass' : 'turnEnd', seat });
  const next = nextSeat(g, seat);
  if (next == null) startStatusPhase(g);
  else beginTurn(g, next, at);
}

function startStatusPhase(g: GameState) {
  g.phase = 'status';
  g.active = null;
  g.ready = g.players.map(() => false);
  g.scoringOrder = g.scoreInOrder ? initiativeOrder(g) : [];
  g.scoringIdx = 0;
  log(g, 'Everyone has passed — status phase.', { tone: 'info' });
  fx(g, { kind: 'phase', note: 'status' });
  if (g.fanfareMs > 0) g.statusStep = 'fanfare';
  else startScoring(g);
}

/** After the celebration: scoring goes round in initiative order, or straight to the tidy-up if the table scores all at once. */
function startScoring(g: GameState) {
  if (!g.scoringOrder.length) {
    g.statusStep = 'tidy';
    return;
  }
  g.statusStep = 'scoring';
  log(g, `Scoring, in initiative order: ${g.scoringOrder.map((s) => g.players[s].name).join(', ')}.`, { tone: 'info' });
  fx(g, { kind: 'score', seat: g.scoringOrder[0] });
}

function fanfareDone(g: GameState) {
  if (g.phase !== 'status' || g.statusStep !== 'fanfare') return;
  startScoring(g);
}

/** The player whose turn it is to score is done: on to the next, or to the tidy-up. */
function scored(g: GameState, seat: number) {
  if (seat !== currentScorer(g)) return;
  fx(g, { kind: 'ack', seat });
  log(g, `${g.players[seat].name} is done scoring.`, { seat });
  g.scoringIdx += 1;
  const next = currentScorer(g);
  if (next != null) fx(g, { kind: 'score', seat: next });
  else {
    g.statusStep = 'tidy';
    log(g, 'Scoring is done — tidy up, then tap in.', { tone: 'info' });
  }
}

function skipScoring(g: GameState) {
  if (g.phase !== 'status' || g.statusStep === 'tidy') return;
  g.statusStep = 'tidy';
  log(g, 'On to the tidy-up.', { tone: 'warn' });
}

function startAgendaPhase(g: GameState) {
  const n = g.players.length;
  // Voting starts left of the speaker and ends with the speaker.
  const order = Array.from({ length: n }, (_, i) => (g.speaker + 1 + i) % n);
  g.phase = 'agenda';
  g.agenda = { n: 1, order, idx: 0 };
  log(g, 'Agenda phase — first agenda.', { tone: 'info' });
  fx(g, { kind: 'phase', note: 'agenda' });
  fx(g, { kind: 'turnStart', seat: order[0] });
}

function afterStatus(g: GameState, at: number) {
  if (g.custodiansRemoved) startAgendaPhase(g);
  else startRound(g, at);
}

// ── Intent handlers ─────────────────────────────────────────────────────────

function playCard(g: GameState, at: number, card?: number) {
  const seat = g.active;
  if (g.phase !== 'action' || seat == null) return;
  const p = g.players[seat];
  if (g.strategyPlay) return deny(g, seat, 'a strategy card is already in play');
  if (g.actedThisTurn) return deny(g, seat, 'already acted this turn');
  const unused = unusedCards(p);
  if (!unused.length) return deny(g, seat, 'no strategy card left to play');
  if (card == null && unused.length > 1) {
    g.choosingCard = true;
    return;
  }
  const chosen = card ?? unused[0];
  if (!unused.includes(chosen)) return deny(g, seat, `doesn't hold an unused ${cardByNumber(chosen).name}`);
  p.usedCards.push(chosen);
  g.choosingCard = false;
  g.actedThisTurn = true;
  g.strategyPlay = { card: chosen, by: seat, at, stage: g.primaryStage ? 'primary' : 'secondary', acks: g.players.map((_, i) => i === seat) };
  log(g, `${p.name} plays ${chosen} · ${cardByNumber(chosen).name}.`, { seat, card: chosen, tone: 'good' });
  fx(g, { kind: 'card', seat, card: chosen });
  if (!g.primaryStage) fx(g, { kind: 'alert', seat, card: chosen });
}

/** The card's owner has finished the primary: now everyone else gets their secondary. */
function primaryDone(g: GameState) {
  const sp = g.strategyPlay;
  if (!sp || sp.stage !== 'primary') return;
  sp.stage = 'secondary';
  log(g, `${g.players[sp.by].name} is done with the primary — secondaries are open.`, { seat: sp.by, card: sp.card });
  fx(g, { kind: 'alert', seat: sp.by, card: sp.card });
}

function ack(g: GameState, seat: number) {
  const sp = g.strategyPlay;
  if (!sp || sp.stage !== 'secondary' || sp.acks[seat]) return;
  sp.acks[seat] = true;
  fx(g, { kind: 'ack', seat });
  if (sp.acks.every(Boolean)) {
    log(g, `Everyone has responded to ${cardByNumber(sp.card).name}.`);
    fx(g, { kind: 'allAcked', seat: sp.by });
  }
}

function endTurn(g: GameState, at: number) {
  const seat = g.active;
  if (g.phase !== 'action' || seat == null) return;
  const blocker = endTurnBlocker(g);
  if (blocker) return deny(g, seat, blocker.charAt(0).toLowerCase() + blocker.slice(1));
  finishTurn(g, at, 'end');
}

function pass(g: GameState, at: number) {
  const seat = g.active;
  if (g.phase !== 'action' || seat == null) return;
  const p = g.players[seat];
  if (g.strategyPlay || g.actedThisTurn) return deny(g, seat, 'already acted this turn — hold to end it');
  if (unusedCards(p).length) return deny(g, seat, "can't pass with an unplayed strategy card");
  p.passed = true;
  g.choosingCard = false;
  log(g, `${p.name} passes.`, { seat });
  finishTurn(g, at, 'pass');
}

function ready(g: GameState, seat: number, at: number) {
  // Games saved before the status phase had steps have no step at all: they are tidying up.
  if (g.phase !== 'status' || (g.statusStep ?? 'tidy') !== 'tidy' || g.ready[seat]) return;
  g.ready[seat] = true;
  fx(g, { kind: 'ready', seat });
  if (g.ready.every(Boolean)) afterStatus(g, at);
}

function voteDone(g: GameState, at: number) {
  const a = g.agenda;
  if (g.phase !== 'agenda' || !a) return;
  fx(g, { kind: 'ack', seat: a.order[a.idx] });
  a.idx += 1;
  if (a.idx < a.order.length) {
    fx(g, { kind: 'turnStart', seat: a.order[a.idx] });
    return;
  }
  if (a.n === 1) {
    g.agenda = { ...a, n: 2, idx: 0 };
    log(g, 'Second agenda.', { tone: 'info' });
    fx(g, { kind: 'turnStart', seat: a.order[0] });
  } else {
    startRound(g, at);
  }
}

function pickCard(g: GameState, card: number, at: number) {
  const seat = currentPicker(g);
  if (seat == null || card < 1 || card > 8 || cardHolder(g, card) != null) return;
  const p = g.players[seat];
  p.cards.push(card);
  p.cards.sort((a, b) => a - b);
  const tg = g.tradeGoods[card - 1];
  g.tradeGoods[card - 1] = 0;
  log(g, `${p.name} takes ${card} · ${cardByNumber(card).name}${tg ? ` (+${tg} trade good${tg > 1 ? 's' : ''})` : ''}.`, { seat, card });
  fx(g, { kind: 'pick', seat, card });
  g.pickIdx += 1;
  if (g.pickIdx >= g.pickOrder.length) startActionPhase(g, at);
}

function handleInput(g: GameState, seat: number, input: DeviceInput, at: number) {
  if (seat < 0 || seat >= g.players.length) return;
  switch (g.phase) {
    case 'action': {
      const sp = g.strategyPlay;
      if (sp?.stage === 'secondary' && !sp.acks[seat] && (input === 'tap' || input === 'hold')) return ack(g, seat);
      if (seat !== g.active) return;
      if (sp?.stage === 'primary' && input === 'tap') {
        // A stray third tap right after the double-tap must not skip the primary.
        if (at - sp.at >= PRIMARY_GUARD_MS) primaryDone(g);
        return;
      }
      if (input === 'hold') return endTurn(g, at);
      if (input === 'double') {
        // Quietly ignore double-taps that can't mean "play my card".
        if (!sp && !g.actedThisTurn && !g.choosingCard) playCard(g, at);
        return;
      }
      if (input === 'strategy') return playCard(g, at);
      if (input === 'pass') return pass(g, at);
      if (sp) return;
      return fx(g, { kind: 'hint', seat, note: 'Hold to end your turn' });
    }
    case 'status':
      if (input !== 'tap' && input !== 'hold') return;
      if (g.statusStep === 'fanfare') return;
      if (g.statusStep === 'scoring') return scored(g, seat);
      return ready(g, seat, at);
    case 'agenda':
      if (seat === currentVoter(g) && (input === 'tap' || input === 'hold')) voteDone(g, at);
      return;
    case 'strategy':
      if (seat === currentPicker(g)) fx(g, { kind: 'hint', seat, note: 'Pick a card on the big screen' });
      return;
    default:
      return;
  }
}

// ── Seat claiming ───────────────────────────────────────────────────────────

function pause(g: GameState, at: number) {
  if (g.paused) return;
  g.paused = true;
  if (g.clockStartedAt != null) {
    g.clockBanked += Math.max(0, at - g.clockStartedAt);
    g.clockStartedAt = null;
  }
}

function resume(g: GameState, at: number) {
  if (!g.paused) return;
  g.paused = false;
  if (g.phase === 'action' && g.active != null) g.clockStartedAt = at;
}

function claim(g: GameState, dev: string, at: number) {
  const s = g.seating;
  if (!s || g.bindings.includes(dev)) return;
  const seat = s.next;
  g.bindings[seat] = dev;
  // Claiming by pressing is also an answer to "who are you?", if that player has a saved profile.
  if (g.players[seat].profileId) g.devices[dev] = g.players[seat].profileId!;
  log(g, `${g.players[seat].name} claims seat ${seat + 1}.`, { seat });
  fx(g, { kind: 'claim', seat });
  advanceSeating(g, at);
}

/** Move on to the next seat that still needs a button; finish when none do. */
function advanceSeating(g: GameState, at: number) {
  const s = g.seating;
  if (!s) return;
  while (s.next < g.players.length && g.bindings[s.next] != null) s.next += 1;
  if (s.next >= g.players.length) finishSeating(g, at);
}

/** A device that already knows whose it is (a phone whose owner said who they are) takes its seat directly. */
function bind(g: GameState, seat: number, dev: string, at: number) {
  if (seat < 0 || seat >= g.players.length || g.bindings[seat] === dev) return;
  g.bindings = g.bindings.map((b) => (b === dev ? null : b));
  g.bindings[seat] = dev;
  if (g.players[seat].profileId) g.devices[dev] = g.players[seat].profileId!;
  log(g, `${g.players[seat].name} joins on their own device.`, { seat });
  fx(g, { kind: 'claim', seat });
  advanceSeating(g, at);
}

function identify(g: GameState, dev: string, profileId: string | null, at: number) {
  g.devices[dev] = profileId;
  const seat = profileId ? g.players.findIndex((p) => p.profileId === profileId) : -1;
  if (seat >= 0 && g.bindings[seat] !== dev) bind(g, seat, dev, at);
  else if (seat < 0 && profileId === null) {
    // "Nobody in particular": the device gives up any seat it held.
    if (g.bindings.includes(dev)) g.bindings = g.bindings.map((b) => (b === dev ? null : b));
  }
}

function finishSeating(g: GameState, at: number) {
  const s = g.seating;
  if (!s) return;
  g.seating = null;
  if (s.resume) resume(g, at);
  log(g, 'Everyone is seated.', { tone: 'info' });
  fx(g, { kind: 'phase', note: g.phase });
}

// ── Reducer ─────────────────────────────────────────────────────────────────

/** One entry in a game's action log: what happened, and when. The whole game can be rebuilt from these. */
export interface GameEvent {
  at: number;
  action: Action;
  /** Housekeeping the app does by itself (a phone saying who it is, a renamed profile): kept through undo and rewind. */
  auto?: true;
  /** The action changed nothing that matters (a refused press): skipped by undo. */
  noop?: true;
}

export const AUTO_ACTIONS = new Set<Action['type']>(['UPDATE_PLAYER', 'BIND', 'IDENTIFY', 'FANFARE_DONE', 'SET_STATUS_FLOW']);

/** Everything except transient effects and the log: what makes an action "count". */
export const core = (g: GameState) => JSON.stringify({ ...g, fx: 0, fxSeq: 0, log: 0, logSeq: 0 });

/** Apply one event and tag the log lines it wrote with its index. */
export function applyEvent(g: GameState, e: GameEvent, index: number): GameState {
  const next = reduce(g, e.action);
  for (const line of next.log) if (line.id > g.logSeq) line.event = index;
  return next;
}

/** The game as it stands after these events, starting from how it began. */
export function replay(base: GameState, events: GameEvent[]): GameState {
  let g = base;
  events.forEach((e, i) => {
    g = applyEvent(g, e, i);
  });
  return g;
}

export function reduce(state: GameState, action: Action): GameState {
  const g = structuredClone(state);
  switch (action.type) {
    case 'INPUT':
      if (!g.seating) handleInput(g, action.seat, action.input, action.at);
      break;
    case 'DEVICE_INPUT': {
      if (g.seating) {
        if (action.input === 'tap' || action.input === 'hold') claim(g, action.dev, action.at);
        break;
      }
      const seat = g.bindings.indexOf(action.dev);
      if (seat >= 0) handleInput(g, seat, action.input, action.at);
      break;
    }
    case 'START_SEATING': {
      const wasRunning = !g.paused;
      pause(g, action.at);
      // Phones whose owners have said who they are keep their seats; everything else is up for grabs.
      g.bindings = g.bindings.map((b) => (b?.startsWith('web-') ? b : null));
      g.seating = { next: 0, resume: wasRunning };
      log(g, 'Seat claiming: press your button when your name is called.', { tone: 'info' });
      advanceSeating(g, action.at);
      break;
    }
    case 'BIND':
      bind(g, action.seat, action.dev, action.at);
      break;
    case 'IDENTIFY':
      identify(g, action.dev.slice(0, 40), action.profileId, action.at);
      break;
    case 'SET_ACTIVE': {
      if (g.phase !== 'action' || action.seat < 0 || action.seat >= g.players.length || g.seating) break;
      if (g.active != null) g.players[g.active].timeMs += clockStop(g, action.at);
      g.players[action.seat].passed = false;
      log(g, `Referee: the turn goes to ${g.players[action.seat].name}.`, { seat: action.seat, tone: 'warn' });
      beginTurn(g, action.seat, action.at);
      break;
    }
    case 'SET_PASSED': {
      const p = g.players[action.seat];
      if (!p || g.phase !== 'action' || p.passed === action.passed) break;
      if (action.passed && g.active === action.seat) {
        p.passed = true;
        g.choosingCard = false;
        g.strategyPlay = null;
        log(g, `Referee: ${p.name} passes.`, { seat: action.seat, tone: 'warn' });
        finishTurn(g, action.at, 'pass');
      } else {
        p.passed = action.passed;
        log(g, `Referee: ${p.name} ${action.passed ? 'has passed' : 'is back in the round'}.`, { seat: action.seat, tone: 'warn' });
      }
      break;
    }
    case 'CANCEL_PLAY': {
      const sp = g.strategyPlay;
      if (!sp) break;
      const p = g.players[sp.by];
      p.usedCards = p.usedCards.filter((c) => c !== sp.card);
      g.strategyPlay = null;
      g.actedThisTurn = false;
      log(g, `Referee: ${cardByNumber(sp.card).name} goes back to ${p.name}, unplayed.`, { seat: sp.by, card: sp.card, tone: 'warn' });
      break;
    }
    case 'SET_CARD_USED': {
      const p = g.players[action.seat];
      if (!p || !p.cards.includes(action.card) || p.usedCards.includes(action.card) === action.used) break;
      p.usedCards = action.used ? [...p.usedCards, action.card] : p.usedCards.filter((c) => c !== action.card);
      log(g, `Referee: ${cardByNumber(action.card).name} is marked ${action.used ? 'played' : 'unplayed'} for ${p.name}.`, { seat: action.seat, card: action.card, tone: 'warn' });
      break;
    }
    case 'GOTO': {
      if (g.seating || g.phase === 'finished') break;
      if (g.active != null) g.players[g.active].timeMs += clockStop(g, action.at);
      log(g, `Referee: jumping to ${action.phase === 'next-round' ? 'the next round' : `the ${action.phase} phase`}.`, { tone: 'warn' });
      if (action.phase === 'status') startStatusPhase(g);
      else if (action.phase === 'agenda') startAgendaPhase(g);
      else startRound(g, action.at);
      break;
    }
    case 'UPDATE_PLAYER': {
      const p = g.players[action.seat];
      if (p) Object.assign(p, action.patch);
      break;
    }
    case 'SKIP_SEATING': {
      if (!g.seating) break;
      const free = action.devices.filter((d) => !g.bindings.includes(d));
      g.bindings = g.bindings.map((b) => b ?? free.shift() ?? null);
      finishSeating(g, action.at);
      break;
    }
    case 'PICK_CARD':
      pickCard(g, action.card, action.at);
      break;
    case 'END_TURN':
      endTurn(g, action.at);
      break;
    case 'PLAY_CARD':
      playCard(g, action.at, action.card);
      break;
    case 'CANCEL_CHOICE':
      g.choosingCard = false;
      break;
    case 'PASS':
      pass(g, action.at);
      break;
    case 'ACK':
      ack(g, action.seat);
      break;
    case 'PRIMARY_DONE':
      primaryDone(g);
      break;
    case 'SET_PRIMARY_STAGE':
      g.primaryStage = action.on;
      break;
    case 'ACK_ALL':
      if (g.strategyPlay?.stage === 'primary') g.strategyPlay.stage = 'secondary';
      for (const s of pendingAcks(g)) ack(g, s);
      break;
    case 'READY':
      ready(g, action.seat, action.at);
      break;
    case 'READY_ALL':
      if (g.phase === 'status') g.statusStep = 'tidy';
      for (let s = 0; s < g.players.length; s++) if (g.phase === 'status') ready(g, s, action.at);
      break;
    case 'FANFARE_DONE':
      fanfareDone(g);
      break;
    case 'SCORED':
      scored(g, action.seat);
      break;
    case 'SKIP_SCORING':
      skipScoring(g);
      break;
    case 'SET_STATUS_FLOW':
      g.fanfareMs = Math.max(0, Math.min(30000, Math.round(action.fanfareMs)));
      g.scoreInOrder = action.scoreInOrder;
      break;
    case 'VOTE_DONE':
      voteDone(g, action.at);
      break;
    case 'ADVANCE':
      advance(g, action.at);
      break;
    case 'VP': {
      // The quick +/- on the roster: a manual correction, kept as its own line in the breakdown.
      const p = g.players[action.seat];
      const other = p.extras.find((e) => e.label === 'Other');
      if (other) other.points += action.delta;
      else p.extras.push({ label: 'Other', points: action.delta });
      p.extras = p.extras.filter((e) => e.points !== 0 || e.label !== 'Other');
      rescore(g, action.seat, action.at);
      break;
    }
    case 'REVEAL_OBJECTIVE': {
      const name = action.name.trim().slice(0, 60);
      if (!name || g.objectives.some((o) => o.name === name)) break;
      g.idSeq += 1;
      g.objectives.push({ id: `o${g.idSeq}`, stage: action.stage, name, text: action.text.trim().slice(0, 200), points: Math.max(1, Math.min(3, Math.round(action.points))), scoredBy: [], round: g.round });
      log(g, `Objective revealed: ${name}.`, { tone: 'info' });
      break;
    }
    case 'REMOVE_OBJECTIVE': {
      const o = g.objectives.find((x) => x.id === action.id);
      if (!o) break;
      g.objectives = g.objectives.filter((x) => x.id !== action.id);
      log(g, `${o.name} removed.`, { tone: 'warn' });
      for (const seat of o.scoredBy) rescore(g, seat, action.at, true);
      break;
    }
    case 'SCORE_OBJECTIVE': {
      const o = g.objectives.find((x) => x.id === action.id);
      if (!o || !g.players[action.seat] || o.scoredBy.includes(action.seat) === action.scored) break;
      o.scoredBy = action.scored ? [...o.scoredBy, action.seat] : o.scoredBy.filter((s) => s !== action.seat);
      log(g, `${g.players[action.seat].name} ${action.scored ? 'scores' : 'un-scores'} ${o.name}.`, { seat: action.seat, tone: action.scored ? 'good' : 'warn' });
      rescore(g, action.seat, action.at);
      break;
    }
    case 'SCORE_SECRET': {
      const p = g.players[action.seat];
      if (!p) break;
      p.secrets.push(action.label.trim().slice(0, 60));
      log(g, `${p.name} scores a secret objective${action.label.trim() ? `: ${action.label.trim()}` : ''}.`, { seat: action.seat, tone: 'good' });
      rescore(g, action.seat, action.at);
      break;
    }
    case 'UNSCORE_SECRET': {
      const p = g.players[action.seat];
      if (!p || action.index < 0 || action.index >= p.secrets.length) break;
      p.secrets.splice(action.index, 1);
      rescore(g, action.seat, action.at);
      break;
    }
    case 'ADD_EXTRA': {
      const p = g.players[action.seat];
      const points = Math.round(action.points);
      if (!p || !points) break;
      const label = action.label.trim().slice(0, 60) || 'Other';
      p.extras.push({ label, points });
      log(g, `${p.name}: ${points > 0 ? '+' : ''}${points} for ${label}.`, { seat: action.seat, tone: points > 0 ? 'good' : 'warn' });
      rescore(g, action.seat, action.at);
      break;
    }
    case 'REMOVE_EXTRA': {
      const p = g.players[action.seat];
      if (!p || action.index < 0 || action.index >= p.extras.length) break;
      p.extras.splice(action.index, 1);
      rescore(g, action.seat, action.at);
      break;
    }
    case 'ADD_LAW': {
      const name = action.name.trim().slice(0, 60);
      if (!name) break;
      g.idSeq += 1;
      g.laws.push({ id: `l${g.idSeq}`, name, note: action.note.trim().slice(0, 200) });
      log(g, `Law passed: ${name}.`, { tone: 'info' });
      break;
    }
    case 'REMOVE_LAW':
      g.laws = g.laws.filter((l) => l.id !== action.id);
      break;
    case 'SET_SPEAKER':
      if (g.speaker !== action.seat) {
        g.speaker = action.seat;
        log(g, `${g.players[action.seat].name} takes the speaker token.`, { seat: action.seat });
      }
      break;
    case 'SET_ZERO_TOKEN':
      g.zeroToken = action.seat;
      break;
    case 'SET_CUSTODIANS':
      g.custodiansRemoved = action.removed;
      log(g, action.removed ? 'Custodians removed — the agenda phase is unlocked.' : 'Custodians restored.', { tone: 'info' });
      break;
    case 'PAUSE':
      pause(g, action.at);
      break;
    case 'RESUME':
      resume(g, action.at);
      break;
  }
  return g;
}

/** Recount a player's points after anything that touches them, and notice a win. */
function rescore(g: GameState, seat: number, at: number, quiet = false) {
  const p = g.players[seat];
  const before = p.vp;
  p.vp = scoreBreakdown(g, seat).total;
  if (!quiet && p.vp !== before) {
    log(g, `${p.name} is on ${p.vp} of ${g.vpTarget}.`, { seat, tone: p.vp > before ? 'good' : 'warn' });
  }
  if (p.vp >= g.vpTarget && g.phase !== 'finished') {
    if (g.active != null) g.players[g.active].timeMs += clockStop(g, at);
    g.phase = 'finished';
    g.winner = seat;
    g.active = null;
    g.strategyPlay = null;
    g.seating = null;
    log(g, `${p.name} claims the throne!`, { seat, tone: 'good' });
    fx(g, { kind: 'win', seat });
  }
}

/** Moderator override: shove the game to the next logical step. */
function advance(g: GameState, at: number) {
  switch (g.phase) {
    case 'strategy':
      if (g.players.every((p) => p.cards.length > 0)) startActionPhase(g, at);
      break;
    case 'action':
      if (g.active != null) g.players[g.active].timeMs += clockStop(g, at);
      startStatusPhase(g);
      break;
    case 'status':
      afterStatus(g, at);
      break;
    case 'agenda':
      startRound(g, at);
      break;
    default:
      break;
  }
}
