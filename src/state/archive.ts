/**
 * Finished games, kept in this browser so their logs can be downloaded later: every action with its time,
 * and how the game began, which is all that's needed to rebuild the whole game or work out any statistic.
 */
import type { GameEvent } from '../engine/engine';
import type { GameState } from '../engine/types';
import { createStore } from './createStore';
import type { GameSlot } from './game';

export interface ArchivedGame {
  code: string;
  startedAt: number;
  endedAt: number;
  players: string[];
  rounds: number;
  winner: string | null;
  base: GameState;
  events: GameEvent[];
}

const KEEP = 10;
export const archiveStore = createStore<ArchivedGame[]>([], 'pb.archive.v1', (raw) => (Array.isArray(raw) ? (raw as ArchivedGame[]) : []));

export function archiveGame(slot: GameSlot) {
  const { base, events, game } = slot;
  if (!base || !game) return;
  const entry: ArchivedGame = {
    code: game.code,
    startedAt: events[0]?.at ?? Date.now(),
    endedAt: Date.now(),
    players: game.players.map((p) => p.name),
    rounds: game.round,
    winner: game.winner != null ? game.players[game.winner].name : null,
    base,
    events,
  };
  archiveStore.set((list) => [entry, ...list.filter((g) => g.code !== entry.code)].slice(0, KEEP));
}

export function forgetArchived(code: string) {
  archiveStore.set((list) => list.filter((g) => g.code !== code));
}

/** The log as a file: JSON, one object, everything a script needs. */
export function exportGame(game: { code: string; base: GameState; events: GameEvent[]; players: string[] }, final?: GameState | null) {
  const doc = {
    format: 'pax-buttonica-game-log/1',
    exportedAt: new Date().toISOString(),
    code: game.code,
    players: game.players,
    notes: 'Replay: state = base; for each event in order, state = reduce(state, event.action). Times are ms since the epoch. auto = the app did it by itself; noop = the action was refused or changed nothing.',
    base: game.base,
    events: game.events,
    ...(final ? { final } : {}),
  };
  const blob = new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pax-buttonica-${game.code}-${new Date(game.events[0]?.at ?? Date.now()).toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
