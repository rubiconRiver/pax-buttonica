/**
 * The obvious numbers from a downloaded game log (Settings → Download the game log, or Past games on the setup
 * screen). Replays the log through the real rules engine, so anything the table showed can be recomputed.
 *
 *   npx --yes tsx scripts/stats.ts pax-buttonica-ABCD-2026-10-03.json
 */
import { readFileSync } from 'node:fs';
import { applyEvent, type GameEvent } from '../src/engine/engine.ts';
import type { GameState } from '../src/engine/types.ts';

const file = process.argv[2];
if (!file) {
  console.error('usage: npx --yes tsx scripts/stats.ts <game-log.json>');
  process.exit(1);
}
const doc = JSON.parse(readFileSync(file, 'utf8')) as { code: string; players: string[]; base: GameState; events: GameEvent[] };
const names = doc.players;
const n = names.length;
const ms = (x: number) => `${Math.floor(x / 60000)}:${String(Math.floor((x % 60000) / 1000)).padStart(2, '0')}`;

// Walk the log, watching the state before and after each event.
const turns: { seat: number; from: number; to: number; round: number }[] = [];
const responses: { seat: number; card: number; by: number; ms: number }[] = [];
const primaries: { seat: number; card: number; ms: number }[] = [];
let referee = 0;
let refused = 0;
let g = doc.base;
let turnStart: { seat: number; at: number } | null = null;
let primaryStart: { by: number; card: number; at: number } | null = null;
let secondaryStart: { by: number; card: number; at: number; acked: boolean[] } | null = null;

doc.events.forEach((e, i) => {
  const before = g;
  g = applyEvent(before, e, i);
  if (e.noop) refused++;
  if (e.action.type.startsWith('SET_') && !['SET_SPEAKER', 'SET_CUSTODIANS', 'SET_ZERO_TOKEN', 'SET_PRIMARY_STAGE'].includes(e.action.type)) referee++;
  if (e.action.type === 'CANCEL_PLAY' || e.action.type === 'GOTO') referee++;

  // Turns: the active seat changed, or the action phase ended.
  if (before.active !== g.active || before.phase !== g.phase) {
    if (turnStart && before.phase === 'action' && before.active === turnStart.seat) turns.push({ seat: turnStart.seat, from: turnStart.at, to: e.at, round: before.round });
    turnStart = g.phase === 'action' && g.active != null ? { seat: g.active, at: e.at } : null;
  }
  // Strategy cards: how long the primary took, and how long each other player took to answer.
  const sp = g.strategyPlay;
  const was = before.strategyPlay;
  if (sp && !was) {
    if (sp.stage === 'primary') primaryStart = { by: sp.by, card: sp.card, at: e.at };
    else secondaryStart = { by: sp.by, card: sp.card, at: e.at, acked: [...sp.acks] };
  }
  if (sp && was && was.stage === 'primary' && sp.stage === 'secondary') {
    if (primaryStart) primaries.push({ seat: sp.by, card: sp.card, ms: e.at - primaryStart.at });
    primaryStart = null;
    secondaryStart = { by: sp.by, card: sp.card, at: e.at, acked: [...sp.acks] };
  }
  if (sp && secondaryStart && sp.stage === 'secondary') {
    sp.acks.forEach((ok, seat) => {
      if (ok && !secondaryStart!.acked[seat]) {
        responses.push({ seat, card: sp.card, by: sp.by, ms: e.at - secondaryStart!.at });
        secondaryStart!.acked[seat] = true;
      }
    });
  }
  if (!sp) secondaryStart = null;
});

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
console.log(`Game ${doc.code}: ${names.join(', ')} · ${doc.events.length} events · ${g.round} round${g.round === 1 ? '' : 's'} · ${g.winner != null ? `${names[g.winner]} won` : 'unfinished'}`);
console.log(`Played ${ms(doc.events.at(-1)!.at - doc.events[0].at)} of wall-clock time; ${referee} referee call${referee === 1 ? '' : 's'}; ${refused} refused presses.\n`);

console.log('Turns                 n    total    avg   longest');
for (let s = 0; s < n; s++) {
  const mine = turns.filter((t) => t.seat === s).map((t) => t.to - t.from);
  console.log(`${names[s].padEnd(20)} ${String(mine.length).padStart(3)}  ${ms(mine.reduce((a, b) => a + b, 0)).padStart(7)}  ${ms(avg(mine)).padStart(5)}  ${ms(Math.max(0, ...mine)).padStart(7)}`);
}

console.log('\nAnswering a strategy card (secondary)   n    avg   slowest');
for (let s = 0; s < n; s++) {
  const mine = responses.filter((r) => r.seat === s).map((r) => r.ms);
  console.log(`${names[s].padEnd(38)} ${String(mine.length).padStart(3)}  ${ms(avg(mine)).padStart(5)}  ${ms(Math.max(0, ...mine)).padStart(7)}`);
}

console.log('\nDoing the primary                      n    avg   longest');
for (let s = 0; s < n; s++) {
  const mine = primaries.filter((r) => r.seat === s).map((r) => r.ms);
  console.log(`${names[s].padEnd(38)} ${String(mine.length).padStart(3)}  ${ms(avg(mine)).padStart(5)}  ${ms(Math.max(0, ...mine)).padStart(7)}`);
}
