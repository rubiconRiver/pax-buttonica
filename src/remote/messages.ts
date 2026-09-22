/**
 * What a phone or a spectator reads off the site. A phone is a dumb device like any other: it shows the light the
 * game says it should show and reports tap / double / hold. It gets the whole game and works its own light out
 * with the same code the host uses.
 */
import { colorById } from '../engine/data';
import type { ExtraPoints, GameState, Law, Objective } from '../engine/types';

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
