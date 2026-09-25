import { AUTO_ACTIONS, applyEvent, core, createGame, newCode, replay, type GameEvent } from '../engine/engine';
import type { Action, GameOptions, GameState, PlayerSetup } from '../engine/types';
import { createStore, type Store } from './createStore';

/**
 * A game is the list of everything that happened to it. The state on screen is a replay of that list from how
 * the game began, so any point can be gone back to, every action is on record with its time, and the whole thing
 * is small enough to keep forever.
 */
export interface GameSlot {
  /** The game as it began: the starting point every replay runs from. */
  base: GameState | null;
  events: GameEvent[];
  /** Events cut off by undo or rewind, kept until something new happens so they can be put back. */
  future: GameEvent[];
  /** Bumped whenever events are cut, so anything mirroring the list knows to start over. */
  epoch: number;
  game: GameState | null;
}

export interface GameStore extends Store<GameSlot> {
  start(players: PlayerSetup[], options: GameOptions): void;
  /** Take over a game as it stands (from the site, from another laptop). */
  adopt(base: GameState, events: GameEvent[], game?: GameState): void;
  dispatch(action: Action): void;
  undo(): void;
  redo(): void;
  /** Back to just before event `index`; everything since is cut, except what the app did by itself. */
  rewind(index: number): void;
  clear(): void;
}

const EMPTY: GameSlot = { base: null, events: [], future: [], epoch: 0, game: null };

/** Rebuild the state after a cut. Sounds don't replay, and effect ids keep moving forward. */
function rebuilt(slot: GameSlot, events: GameEvent[]): GameState {
  const g = replay(slot.base!, events);
  return { ...g, fx: [], fxSeq: Math.max(g.fxSeq, slot.game?.fxSeq ?? 0) };
}

/** Undo and rewind cut real events but keep the app's own housekeeping, which would only happen again. */
function cut(slot: GameSlot, from: number): GameSlot {
  const kept = slot.events.slice(0, from).concat(slot.events.slice(from).filter((e) => e.auto));
  const gone = slot.events.slice(from).filter((e) => !e.auto);
  return { ...slot, events: kept, future: [...gone, ...slot.future], epoch: slot.epoch + 1, game: rebuilt(slot, kept) };
}

/** The last event undo would cut: real, and one that changed something. */
export function lastUndoable(events: GameEvent[]): number {
  for (let i = events.length - 1; i >= 0; i--) if (!events[i].auto && !events[i].noop) return i;
  return -1;
}

export function createGameStore(persistKey?: string): GameStore {
  const store = createStore<GameSlot>(EMPTY, persistKey, (raw) => {
    const slot = raw as Partial<GameSlot> & { past?: unknown };
    if (!slot?.game) return EMPTY;
    // Never replay old sounds after a reload.
    slot.game.fx = [];
    // Games saved before codes and device identities existed.
    if (!slot.game.code) slot.game.code = newCode();
    if (!slot.game.devices) slot.game.devices = {};
    // A game saved before the action log existed starts its log from where it is now.
    return { base: slot.base ?? slot.game, events: slot.events ?? [], future: slot.future ?? [], epoch: slot.epoch ?? 0, game: slot.game };
  });

  return {
    ...store,
    start(players, options) {
      const game = createGame(players, { ...options, code: options.code ?? newCode() }, Date.now());
      store.set({ base: game, events: [], future: [], epoch: 0, game });
    },
    adopt(base, events, game) {
      store.set({ base, events, future: [], epoch: 0, game: game ? { ...game, fx: [] } : replay(base, events) });
    },
    dispatch(action) {
      const slot = store.get();
      if (!slot.game) return;
      const at = 'at' in action && typeof action.at === 'number' ? action.at : Date.now();
      const event: GameEvent = { at, action };
      if (AUTO_ACTIONS.has(action.type)) event.auto = true;
      const next = applyEvent(slot.game, event, slot.events.length);
      if (!event.auto && core(next) === core(slot.game)) event.noop = true;
      // Something new happened: the cut-off future can no longer be put back.
      store.set({ ...slot, events: [...slot.events, event], future: event.auto || event.noop ? slot.future : [], game: next });
    },
    undo() {
      const slot = store.get();
      const i = lastUndoable(slot.events);
      if (!slot.game || i < 0) return;
      store.set(cut(slot, i));
    },
    redo() {
      const slot = store.get();
      if (!slot.game || !slot.future.length) return;
      const [next, ...rest] = slot.future;
      const events = [...slot.events, next];
      store.set({ ...slot, events, future: rest, epoch: slot.epoch + 1, game: rebuilt(slot, events) });
    },
    rewind(index) {
      const slot = store.get();
      if (!slot.game || index < 0 || index >= slot.events.length) return;
      store.set(cut(slot, index));
    },
    clear() {
      store.set(EMPTY);
    },
  };
}

/** The real game survives reloads — TI4 sessions are long. */
export const liveGame = createGameStore('pb.game.v4');
/** The demo is throwaway and never touches a game in progress. */
export const demoGame = createGameStore();
