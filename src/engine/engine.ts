import { NAALU, cardByNumber } from './data';
import type { Action, DeviceInput, Fx, GameOptions, GameState, LogEntry, Player, PlayerSetup } from './types';

const MAX_LOG = 300;
const MAX_FX = 16;
/** Taps from the card's owner are ignored for this long after the card comes out. */
export const PRIMARY_GUARD_MS = 600;

export const cardsPerPlayer = (playerCount: number) => (playerCount <= 4 ? 2 : 1);

/** Id of the simulated on-screen button at a given spot round the table. */
export const simDevice = (spot: number) => `sim-${spot}`;

// ── Construction ────────────────────────────────────────────────────────────

export function createGame(setups: PlayerSetup[], options: GameOptions, at: number): GameState {
  const players: Player[] = setups.map((s) => ({
    ...s,
    vp: 0,
    cards: [],
    usedCards: [],
    passed: false,
    timeMs: 0,
    turns: 0,
  }));
  const naalu = players.findIndex((p) => p.faction === NAALU);
  const g: GameState = {
    phase: 'strategy',
    round: 0,
    vpTarget: options.vpTarget,
    players,
    speaker: options.speaker,
    zeroToken: naalu >= 0 ? naalu : null,
    custodiansRemoved: false,
    primaryStage: options.primaryStage ?? true,
    pickOrder: [],
    pickIdx: 0,
    tradeGoods: Array(8).fill(0),
    active: null,
    actedThisTurn: false,
    strategyPlay: null,
    choosingCard: false,
    ready: [],
    agenda: null,
    winner: null,
    bindings: players.map((_, i) => (options.seating ? null : simDevice(i))),
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
  log(g, 'Everyone has passed — status phase.', { tone: 'info' });
  fx(g, { kind: 'phase', note: 'status' });
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
  if (g.phase !== 'status' || g.ready[seat]) return;
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
      if (input === 'tap' || input === 'hold') ready(g, seat, at);
      return;
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
  log(g, `${g.players[seat].name} joins on their own device.`, { seat });
  fx(g, { kind: 'claim', seat });
  advanceSeating(g, at);
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
      for (let s = 0; s < g.players.length; s++) if (g.phase === 'status') ready(g, s, action.at);
      break;
    case 'VOTE_DONE':
      voteDone(g, action.at);
      break;
    case 'ADVANCE':
      advance(g, action.at);
      break;
    case 'VP': {
      const p = g.players[action.seat];
      const before = p.vp;
      p.vp = Math.max(0, Math.min(g.vpTarget, p.vp + action.delta));
      if (p.vp !== before) {
        log(g, `${p.name} ${p.vp > before ? 'scores' : 'loses'} a point (${p.vp}/${g.vpTarget}).`, {
          seat: action.seat,
          tone: p.vp > before ? 'good' : 'warn',
        });
      }
      if (p.vp >= g.vpTarget && g.phase !== 'finished') {
        if (g.active != null) g.players[g.active].timeMs += clockStop(g, action.at);
        g.phase = 'finished';
        g.winner = action.seat;
        g.active = null;
        g.strategyPlay = null;
        log(g, `${p.name} claims the throne!`, { seat: action.seat, tone: 'good' });
        fx(g, { kind: 'win', seat: action.seat });
      }
      break;
    }
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
