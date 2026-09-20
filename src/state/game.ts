import { createGame, reduce } from '../engine/engine';
import type { Action, GameOptions, GameState, PlayerSetup } from '../engine/types';
import { createStore, type Store } from './createStore';

const MAX_UNDO = 40;

export interface GameSlot {
  game: GameState | null;
  past: GameState[];
}

export interface GameStore extends Store<GameSlot> {
  start(players: PlayerSetup[], options: GameOptions): void;
  dispatch(action: Action): void;
  undo(): void;
  clear(): void;
}

/** Everything except transient effects and the log — used to decide what is worth an undo step. */
const core = (g: GameState) => JSON.stringify({ ...g, fx: 0, fxSeq: 0, log: 0, logSeq: 0 });

export function createGameStore(persistKey?: string): GameStore {
  const store = createStore<GameSlot>({ game: null, past: [] }, persistKey, (raw) => {
    const slot = raw as GameSlot;
    // Never replay old sounds after a reload.
    if (slot?.game) slot.game.fx = [];
    return { game: slot?.game ?? null, past: slot?.past ?? [] };
  });

  return {
    ...store,
    start(players, options) {
      store.set({ game: createGame(players, options, Date.now()), past: [] });
    },
    dispatch(action) {
      const { game, past } = store.get();
      if (!game) return;
      const next = reduce(game, action);
      const changed = core(next) !== core(game);
      store.set({ game: next, past: changed ? [...past, game].slice(-MAX_UNDO) : past });
    },
    undo() {
      const { game, past } = store.get();
      if (!game || !past.length) return;
      const prev = structuredClone(past[past.length - 1]);
      // Keep effect ids moving forward so nothing replays and nothing is skipped.
      prev.fxSeq = game.fxSeq;
      prev.fx = [];
      store.set({ game: prev, past: past.slice(0, -1) });
    },
    clear() {
      store.set({ game: null, past: [] });
    },
  };
}

/** The real game survives reloads — TI4 sessions are long. */
export const liveGame = createGameStore('pb.game.v3');
/** The demo is throwaway and never touches a game in progress. */
export const demoGame = createGameStore();
