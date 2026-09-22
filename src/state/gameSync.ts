/**
 * The game in progress is kept on the site as well as in this browser. Local first: play never waits for the
 * network. A copy goes up a second after each change; it comes back down when this browser has nothing (data
 * cleared, a new laptop) or when someone types the room code on another laptop to pick the game up.
 */
import type { GameState } from '../engine/types';
import { apiJson, hostKey } from '../remote/key';
import { roomStatus } from '../remote/host';
import { createStore } from './createStore';
import { liveGame } from './game';

export interface SavedGame {
  game: GameState;
  code: string | null;
  updatedAt: number;
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'taken';
export const saveStatus = createStore<SaveState>('idle');

const strip = (g: GameState) => JSON.stringify({ ...g, fx: [], clockStartedAt: null, clockBanked: 0 });
let lastSaved = '';
let timer = 0;
let started = false;

async function save() {
  timer = 0;
  const { game } = liveGame.get();
  if (!game) return;
  const body = strip(game);
  if (body === lastSaved || saveStatus.get() === 'taken') return;
  saveStatus.set('saving');
  try {
    // The clock is banked before it goes up, so a copy restored elsewhere doesn't charge the player for the gap.
    const at = Date.now();
    const banked = { ...game, fx: [], clockBanked: game.clockBanked + (game.clockStartedAt != null ? at - game.clockStartedAt : 0), clockStartedAt: game.clockStartedAt != null ? at : null };
    const res = await apiJson(`/api/game?key=${hostKey()}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: banked, code: roomStatus.get().code }) });
    if (!res) throw new Error('offline');
    lastSaved = body;
    saveStatus.set('saved');
  } catch (err) {
    // Another laptop picked this game up: this copy is history and must not overwrite theirs.
    saveStatus.set((err as { status?: number }).status === 403 ? 'taken' : 'offline');
  }
}

function forget() {
  lastSaved = '';
  saveStatus.set('idle');
  void apiJson(`/api/game?key=${hostKey()}`, { method: 'DELETE' }).catch(() => {});
}

export function startGameSync() {
  if (started) return;
  started = true;
  let hadGame = !!liveGame.get().game;
  liveGame.subscribe(() => {
    const has = !!liveGame.get().game;
    if (hadGame && !has) forget();
    hadGame = has;
    if (!has) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void save(), 1000);
  });
  window.addEventListener('online', () => liveGame.get().game && void save());
  roomStatus.subscribe(() => {
    // The room code is part of the record (it's how another laptop finds the game).
    if (liveGame.get().game) {
      lastSaved = '';
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void save(), 1000);
    }
  });
}

/** The game this browser last saved, if the site still has it. */
export const fetchSavedGame = () => apiJson<SavedGame>(`/api/game?key=${hostKey()}`).catch(() => null);

/** A game from another laptop, by its room code. From now on it is this browser's. */
export const pickUpGame = (code: string) => apiJson<SavedGame>(`/api/game?code=${code}&key=${hostKey()}`).catch(() => null);

/** Put a saved game on this table. Its clock starts again from now. */
export function restoreGame(saved: SavedGame) {
  saveStatus.set('idle');
  const g = saved.game;
  liveGame.set({ game: { ...g, fx: [], clockStartedAt: g.clockStartedAt != null && !g.paused ? Date.now() : null }, past: [] });
  lastSaved = strip(liveGame.get().game!);
  saveStatus.set('saved');
}
