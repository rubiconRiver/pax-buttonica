/**
 * The game's copy on the site. The host laptop is the authority: it runs the rules, plays the sounds and drives
 * the buttons, and keeps working with the Wi-Fi down. This module keeps the site's copy of the game current
 * (a beat after every change) and reads back what phones have sent: presses, and who they are.
 *
 * One game, one code, one record. Phones, the table view and a laptop picking the game up all read that record.
 */
import { syncProfiles } from '../state/profileSync';
import { profilesStore } from '../state/profiles';
import { createStore } from '../state/createStore';
import { liveGame } from '../state/game';
import { settingsStore } from '../state/settings';
import type { GameState } from '../engine/types';
import { apiJson, hostKey } from './key';

/** What goes to the site: the whole state, plus the settings a phone needs to behave like a button. */
export interface GameRecord {
  state: GameState;
  settings: { holdMs: number; flashMs: number };
}

export interface PhonePresence {
  dev: string;
  profileId: string | null;
  seen: number;
}

export interface SyncStatus {
  code: string | null;
  /** Whether the site has the latest copy. 'taken': another laptop picked the game up; this copy no longer saves. */
  site: 'idle' | 'saving' | 'saved' | 'offline' | 'taken';
  seq: number;
  /** Phones heard from in the last little while. */
  phones: PhonePresence[];
}

export const syncStatus = createStore<SyncStatus>({ code: null, site: 'idle', seq: 0, phones: [] });

const WRITE_DEBOUNCE_MS = 150;
const READ_EVERY_MS = 500;
const PRESENCE_TTL_MS = 45_000;
const PROFILES_EVERY_MS = 5_000;

const seen = new Map<string, number>();
let writeTimer = 0;
let writing = false;
let writeAgain = false;
let lastWritten = '';
let readTimer = 0;
let readAfter = 0;
let lastProfiles = 0;
let started = false;
let unsubscribe: (() => void)[] = [];

const recordOf = (game: GameState): GameRecord => {
  const { holdMs, flashMs } = settingsStore.get();
  return { state: game, settings: { holdMs, flashMs } };
};

function listPhones() {
  const game = liveGame.get().game;
  const now = Date.now();
  for (const [dev, t] of seen) if (now - t > PRESENCE_TTL_MS) seen.delete(dev);
  const phones = [...seen].map(([dev, t]) => ({ dev, profileId: game?.devices[dev] ?? null, seen: t }));
  syncStatus.set((s) => ({ ...s, phones }));
}

// ── Writing ─────────────────────────────────────────────────────────────────

function scheduleWrite() {
  window.clearTimeout(writeTimer);
  writeTimer = window.setTimeout(() => void write(), WRITE_DEBOUNCE_MS);
}

async function write() {
  const game = liveGame.get().game;
  if (!game || syncStatus.get().site === 'taken') return;
  if (writing) {
    writeAgain = true;
    return;
  }
  const body = JSON.stringify(recordOf(game));
  if (body === lastWritten) return;
  writing = true;
  syncStatus.set((s) => ({ ...s, code: game.code, site: 'saving' }));
  try {
    const res = await apiJson<{ seq: number }>(`/api/game?code=${game.code}&key=${hostKey()}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
    if (!res) throw new Error('offline');
    lastWritten = body;
    syncStatus.set((s) => ({ ...s, site: 'saved', seq: res.seq }));
  } catch (err) {
    syncStatus.set((s) => ({ ...s, site: (err as { status?: number }).status === 403 ? 'taken' : 'offline' }));
  } finally {
    writing = false;
    if (writeAgain) {
      writeAgain = false;
      scheduleWrite();
    }
  }
}

// ── Reading what phones sent ────────────────────────────────────────────────

interface Inbound {
  dev: string;
  type: 'input' | 'identify' | 'hello';
  input?: 'tap' | 'double' | 'hold';
  profileId?: string | null;
}

async function read() {
  const game = liveGame.get().game;
  if (!game || syncStatus.get().site === 'taken') return;
  try {
    const res = await apiJson<{ actions: { seq: number; data: Inbound; at: number }[] }>(`/api/actions?code=${game.code}&key=${hostKey()}&after=${readAfter}`);
    if (!res) return;
    let unknownProfile = false;
    for (const { seq, data } of res.actions) {
      readAfter = Math.max(readAfter, seq);
      if (typeof data.dev !== 'string') continue;
      const dev = data.dev.slice(0, 40);
      seen.set(dev, Date.now());
      if (data.type === 'input' && data.input) liveGame.dispatch({ type: 'DEVICE_INPUT', dev, input: data.input, at: Date.now() });
      else if (data.type === 'identify') {
        const profileId = typeof data.profileId === 'string' ? data.profileId : null;
        if (profileId && !profilesStore.get().some((p) => p.id === profileId)) unknownProfile = true;
        liveGame.dispatch({ type: 'IDENTIFY', dev, profileId, at: Date.now() });
      }
    }
    listPhones();
    // Someone new, or someone who changed their sounds on their phone: fetch the profiles now rather than later.
    if (unknownProfile || (seen.size && Date.now() - lastProfiles > PROFILES_EVERY_MS)) {
      lastProfiles = Date.now();
      void syncProfiles();
    }
  } catch (err) {
    if ((err as { status?: number }).status === 403) syncStatus.set((s) => ({ ...s, site: 'taken' }));
    // otherwise: offline for a moment; the next read will try again
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

function begin(game: GameState) {
  seen.clear();
  readAfter = 0;
  lastWritten = '';
  syncStatus.set({ code: game.code, site: 'idle', seq: 0, phones: [] });
  window.clearInterval(readTimer);
  readTimer = window.setInterval(() => void read(), READ_EVERY_MS);
  scheduleWrite();
}

function end(code: string) {
  window.clearInterval(readTimer);
  window.clearTimeout(writeTimer);
  readTimer = 0;
  seen.clear();
  lastWritten = '';
  const was = syncStatus.get().site;
  syncStatus.set({ code: null, site: 'idle', seq: 0, phones: [] });
  if (was !== 'taken') void apiJson(`/api/game?code=${code}&key=${hostKey()}`, { method: 'DELETE' }).catch(() => {});
}

/**
 * Only the host screen syncs. Another tab in the same browser (a phone page, the demo) shares this browser's
 * storage and so has a copy of the game; it must not act as a second host and write over the site's copy.
 */
export function startSync() {
  if (started) return;
  started = true;
  let current = liveGame.get().game?.code ?? null;
  if (current) begin(liveGame.get().game!);
  unsubscribe.push(liveGame.subscribe(() => {
    const game = liveGame.get().game;
    const code = game?.code ?? null;
    if (code !== current) {
      if (current) end(current);
      current = code;
      if (game) begin(game);
      return;
    }
    if (game) scheduleWrite();
  }));
  // Hold time and blink speed are in the record too.
  unsubscribe.push(settingsStore.subscribe(() => liveGame.get().game && scheduleWrite()));
  const online = () => liveGame.get().game && scheduleWrite();
  window.addEventListener('online', online);
  const housekeeping = window.setInterval(() => {
    const s = syncStatus.get();
    if (s.site === 'offline' && liveGame.get().game) scheduleWrite();
    if (s.phones.length) listPhones();
  }, 10_000);
  unsubscribe.push(() => {
    window.removeEventListener('online', online);
    window.clearInterval(housekeeping);
    window.clearInterval(readTimer);
    window.clearTimeout(writeTimer);
    readTimer = 0;
    lastWritten = '';
    syncStatus.set({ code: null, site: 'idle', seq: 0, phones: [] });
  });
}

/** Leaving the host screen. The game stays in this browser; syncing resumes when the screen is back. */
export function stopSync() {
  if (!started) return;
  started = false;
  for (const fn of unsubscribe) fn();
  unsubscribe = [];
}

// ── Other laptops ───────────────────────────────────────────────────────────

export interface SavedGameSummary {
  code: string;
  seq: number;
  updatedAt: number;
  players: string[];
  round: number;
  phase: string;
}

/** Games this browser has saved to the site (its own data may have been cleared since). */
export const listMyGames = () => apiJson<{ games: SavedGameSummary[] }>(`/api/game?key=${hostKey()}`).then((r) => r?.games ?? []).catch(() => [] as SavedGameSummary[]);

/** Take a game over by its code. From now on it is this browser's; the laptop it came from stops saving. */
export async function pickUpGame(code: string): Promise<boolean> {
  try {
    const res = await apiJson<{ record: GameRecord }>(`/api/game?code=${code}&key=${hostKey()}&claim=1`, { method: 'POST' });
    if (!res?.record?.state) return false;
    liveGame.set({ game: { ...res.record.state, fx: [] }, past: [] });
    return true;
  } catch {
    return false;
  }
}
