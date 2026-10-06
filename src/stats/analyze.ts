import { applyEvent, type GameEvent } from '../engine/engine';
import type { GameState } from '../engine/types';

/** A downloaded game log (Settings → Download the game log; `exportGame` in src/state/archive.ts). */
export interface GameLog {
  format?: string;
  code: string;
  players: string[];
  base: GameState;
  events: GameEvent[];
  final?: GameState;
}

export interface Span { from: number; to: number }
export interface PhaseSpan extends Span { round: number; phase: GameState['phase']; step?: string }
export interface Turn extends Span { seat: number; round: number; paused: number; waiting: number; card?: number }
export interface Play { round: number; at: number; card: number; by: number; primaryMs: number | null; secondariesMs: number | null; responses: { seat: number; ms: number }[] }
export interface Refusal { seat: number | null; dev: string; why: string; n: number }

export interface PlayerStats {
  seat: number;
  name: string;
  turns: number;
  /** Their turns with the pauses taken out. */
  onClock: number;
  /** Of that, time spent waiting for the others to answer a strategy card they played. */
  waiting: number;
  paused: number;
  median: number;
  longest: number;
  /** Rounds in which they were the first to pass. */
  passedFirst: number;
  /** Answering other people's strategy cards. */
  response: { n: number; avg: number; slowest: number };
  scoring: { n: number; avg: number; longest: number };
  refused: number;
}

export interface GameStats {
  code: string;
  names: string[];
  start: number;
  end: number;
  total: number;
  rounds: number;
  turnCount: number;
  winner: number | null;
  phases: PhaseSpan[];
  /** How the wall clock splits up. */
  shares: { turns: number; waiting: number; paused: number; between: number; strategy: number; other: number };
  pauses: (Span & { round: number; phase: string; active: number | null })[];
  /** Stretches with nothing pressed, outside pauses. */
  gaps: (Span & { round: number; phase: string; active: number | null })[];
  turns: Turn[];
  plays: Play[];
  players: PlayerStats[];
  passes: { round: number; order: number[] }[];
  refusals: Refusal[];
  /** Per round: how long each phase ran, how many turns, and the average turn with pauses removed. */
  roundSummary: { round: number; strategy: number; action: number; status: number; agenda: number; turns: number; avgTurn: number; paused: number }[];
}

const GAP_MS = 4 * 60_000;

const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Why a press was refused, in words, from the log line the engine wrote, or from the situation. */
function reason(before: GameState, seat: number, input: string, line: string | null): string {
  if (line) return line.replace(/^[^:]+: /, '');
  if (before.phase === 'strategy') return 'Pressed during the strategy phase (cards are picked on the big screen)';
  if (before.phase === 'status') return 'Pressed during the status phase when nothing was being asked';
  if (before.phase === 'action' && before.active === seat) {
    if (input === 'tap') return 'Tapped on their own turn (a hold ends it; a double-tap plays the card)';
    if (input === 'double') return 'Double-tapped on their own turn when there was no card to play';
  }
  if (before.phase === 'action') return input === 'double' ? 'Double-tapped when it was not their turn' : `${input === 'hold' ? 'Held' : 'Tapped'} when it was not their turn`;
  return `${input} did nothing`;
}

export function analyzeLog(doc: GameLog): GameStats {
  const names = doc.players;
  const events = doc.events;
  if (!events.length) throw new Error('An empty log');
  let g = doc.base;
  const phases: PhaseSpan[] = [];
  let cur: PhaseSpan = { round: g.round, phase: g.phase, step: g.phase === 'status' ? g.statusStep : undefined, from: events[0].at, to: events[0].at };
  const pauses: GameStats['pauses'] = [];
  const gaps: GameStats['gaps'] = [];
  const turns: Turn[] = [];
  const plays: Play[] = [];
  const passes: GameStats['passes'] = [];
  const refusedMap = new Map<string, Refusal>();
  const scoring: { seat: number; ms: number }[] = [];
  let turn: Turn | null = null;
  let pausedAt: number | null = null;
  let secOpen: { at: number; acked: boolean[] } | null = null;
  let scorerSince: { seat: number; at: number } | null = null;
  let prevAt = events[0].at;

  events.forEach((e, i) => {
    const before = g;
    g = applyEvent(before, e, i);
    const a = e.action;

    if (e.at - prevAt > GAP_MS && pausedAt == null) gaps.push({ from: prevAt, to: e.at, round: before.round, phase: before.phase, active: before.active });
    prevAt = e.at;

    const key = `${g.round}/${g.phase}/${g.phase === 'status' ? g.statusStep : ''}`;
    if (key !== `${cur.round}/${cur.phase}/${cur.step ?? ''}`) {
      cur.to = e.at;
      phases.push(cur);
      cur = { round: g.round, phase: g.phase, step: g.phase === 'status' ? g.statusStep : undefined, from: e.at, to: e.at };
    }

    if (a.type === 'PAUSE' && pausedAt == null) pausedAt = e.at;
    if (a.type === 'RESUME' && pausedAt != null) {
      pauses.push({ from: pausedAt, to: e.at, round: before.round, phase: before.phase, active: before.active });
      if (turn) turn.paused += e.at - pausedAt;
      pausedAt = null;
    }

    if (e.noop && a.type === 'DEVICE_INPUT') {
      const seat = before.bindings.indexOf(a.dev);
      const line = g.log.at(-1);
      const why = reason(before, seat, a.input, line && line.id > before.logSeq ? line.text : null);
      const k = `${seat}|${a.dev}|${why}`;
      const r = refusedMap.get(k) ?? { seat: seat >= 0 ? seat : null, dev: a.dev, why, n: 0 };
      r.n += 1;
      refusedMap.set(k, r);
    }

    const sp = g.strategyPlay;
    const was = before.strategyPlay;
    if (sp && !was) {
      plays.push({ round: g.round, at: e.at, card: sp.card, by: sp.by, primaryMs: sp.stage === 'primary' ? null : 0, secondariesMs: null, responses: [] });
      if (turn) turn.card = sp.card;
      if (sp.stage === 'secondary') secOpen = { at: e.at, acked: [...sp.acks] };
    }
    if (sp && was && was.stage === 'primary' && sp.stage === 'secondary') {
      const p = plays.at(-1)!;
      p.primaryMs = e.at - p.at;
      secOpen = { at: e.at, acked: [...sp.acks] };
    }
    if (sp && secOpen && sp.stage === 'secondary') {
      const p = plays.at(-1)!;
      sp.acks.forEach((ok, seat) => {
        if (ok && !secOpen!.acked[seat]) {
          p.responses.push({ seat, ms: e.at - secOpen!.at });
          secOpen!.acked[seat] = true;
        }
      });
      if (sp.acks.every(Boolean) && p.secondariesMs == null) {
        p.secondariesMs = e.at - secOpen.at;
        if (turn) turn.waiting += p.secondariesMs;
      }
    }
    if (!sp) secOpen = null;

    if (a.type === 'PASS' && before.active != null && !before.players[before.active].passed && g.players[before.active]?.passed) {
      const r = passes.find((x) => x.round === before.round) ?? (passes.push({ round: before.round, order: [] }), passes.at(-1)!);
      r.order.push(before.active);
    }

    const scorer = g.phase === 'status' && g.statusStep === 'scoring' ? g.scoringOrder[g.scoringIdx] ?? null : null;
    const wasScorer = before.phase === 'status' && before.statusStep === 'scoring' ? before.scoringOrder[before.scoringIdx] ?? null : null;
    if (scorer !== wasScorer) {
      if (scorerSince && wasScorer === scorerSince.seat && a.type !== 'SKIP_SCORING') scoring.push({ seat: scorerSince.seat, ms: e.at - scorerSince.at });
      scorerSince = scorer != null ? { seat: scorer, at: e.at } : null;
    }

    if (before.active !== g.active || before.phase !== g.phase) {
      if (turn && before.phase === 'action' && before.active === turn.seat) {
        turn.to = e.at;
        turns.push(turn);
      }
      turn = g.phase === 'action' && g.active != null ? { seat: g.active, round: g.round, from: e.at, to: e.at, paused: 0, waiting: 0 } : null;
    }
  });
  cur.to = events.at(-1)!.at;
  phases.push(cur);

  const start = events[0].at;
  const end = events.at(-1)!.at;
  const total = end - start;
  const net = (t: Turn) => t.to - t.from - t.paused;
  const final = doc.final ?? g;

  const players: PlayerStats[] = names.map((name, seat) => {
    const mine = turns.filter((t) => t.seat === seat);
    const nets = mine.map(net);
    const responses = plays.flatMap((p) => p.responses.filter((r) => r.seat === seat).map((r) => r.ms));
    const scored = scoring.filter((s) => s.seat === seat).map((s) => s.ms);
    return {
      seat,
      name,
      turns: mine.length,
      onClock: sum(nets),
      waiting: sum(mine.map((t) => t.waiting)),
      paused: sum(mine.map((t) => t.paused)),
      median: median(nets),
      longest: Math.max(0, ...nets),
      passedFirst: passes.filter((p) => p.order[0] === seat).length,
      response: { n: responses.length, avg: responses.length ? sum(responses) / responses.length : 0, slowest: Math.max(0, ...responses) },
      scoring: { n: scored.length, avg: scored.length ? sum(scored) / scored.length : 0, longest: Math.max(0, ...scored) },
      refused: [...refusedMap.values()].filter((r) => r.seat === seat).reduce((a, r) => a + r.n, 0),
    };
  });

  const phaseTotal = (phase: GameState['phase'], round?: number) => sum(phases.filter((p) => p.phase === phase && (round == null || p.round === round)).map((p) => p.to - p.from));
  const rounds = Math.max(...phases.map((p) => p.round));
  const roundSummary = Array.from({ length: rounds }, (_, i) => {
    const r = i + 1;
    const mine = turns.filter((t) => t.round === r);
    return {
      round: r,
      strategy: phaseTotal('strategy', r),
      action: phaseTotal('action', r),
      status: phaseTotal('status', r),
      agenda: phaseTotal('agenda', r),
      turns: mine.length,
      avgTurn: mine.length ? sum(mine.map(net)) / mine.length : 0,
      paused: sum(pauses.filter((p) => p.round === r).map((p) => p.to - p.from)),
    };
  });

  const turnsNet = sum(turns.map(net));
  const waiting = sum(turns.map((t) => t.waiting));
  const paused = sum(pauses.map((p) => p.to - p.from));
  const between = phaseTotal('status') + phaseTotal('agenda');
  const strategy = phaseTotal('strategy');
  const other = Math.max(0, total - turnsNet - paused - between - strategy);

  return {
    code: doc.code,
    names,
    start,
    end,
    total,
    rounds,
    turnCount: turns.length,
    winner: final.winner,
    phases,
    shares: { turns: turnsNet - waiting, waiting, paused, between, strategy, other },
    pauses,
    gaps,
    turns,
    plays,
    players,
    passes,
    refusals: [...refusedMap.values()].sort((a, b) => b.n - a.n),
    roundSummary,
  };
}

// ── Formatting ──────────────────────────────────────────────────────────────

/** 1:51:05, 11:30 or 0:34. */
export function clock(ms: number): string {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** 12 h 49 m, 23 min, 34 s. */
export function spoken(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 90) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, '0')} m`;
}

export const timeOfDay = (t: number, tz = 'America/Regina') => new Date(t).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
export const dayOf = (t: number, tz = 'America/Regina') => new Date(t).toLocaleDateString('en-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });
