/**
 * Keeps the profile list in this browser and the one in the database in step.
 * The local copy is always usable on its own — a game must survive the Wi-Fi
 * dropping — so this is best-effort: pull, merge by newest edit, push what's new.
 */
import { uploadPending } from '../audio/clips';
import { createStore } from './createStore';
import { deletedProfiles, profilesStore, sortProfiles, type Profile } from './profiles';

export type SyncState = 'starting' | 'synced' | 'offline';
export const syncStatus = createStore<SyncState>('starting');

type Row = Partial<Profile> & { id: string; updatedAt: number; deleted?: boolean };

/** What the database is known to have, so only real changes are sent. */
const known = new Map<string, number>();
let busy = false;
let again = false;

async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  // The dev server answers /api with the app's HTML: that's "no database here", not an error worth shouting about.
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) throw new Error(`sync ${res.status}`);
  return res.json();
}

export async function syncProfiles() {
  if (busy) {
    again = true;
    return;
  }
  busy = true;
  try {
    while (deletedProfiles.length) {
      const id = deletedProfiles[0];
      await api('DELETE', `/api/profiles?id=${id}`);
      known.delete(id);
      deletedProfiles.shift();
    }

    const { profiles: rows } = (await api('GET', '/api/profiles')) as { profiles: Row[] };
    const remote = new Map(rows.map((r) => [r.id, r]));
    let local = profilesStore.get();
    let changed = false;

    for (const r of rows) {
      known.set(r.id, r.updatedAt);
      const mine = local.find((p) => p.id === r.id);
      if (r.deleted) {
        if (mine && mine.updatedAt <= r.updatedAt) {
          local = local.filter((p) => p.id !== r.id);
          changed = true;
        }
      } else if (!mine || r.updatedAt > mine.updatedAt) {
        const { deleted: _gone, ...profile } = r;
        local = [...local.filter((p) => p.id !== r.id), profile as Profile];
        changed = true;
      }
    }
    if (changed) profilesStore.set(sortProfiles(local));

    for (const p of profilesStore.get()) {
      const theirs = remote.get(p.id);
      if (!theirs || p.updatedAt > theirs.updatedAt) {
        await api('PUT', '/api/profiles', { profile: p });
        known.set(p.id, p.updatedAt);
      }
    }
    void uploadPending();
    syncStatus.set('synced');
  } catch {
    syncStatus.set('offline');
  } finally {
    busy = false;
    if (again) {
      again = false;
      void syncProfiles();
    }
  }
}

let started = false;

export function startProfileSync() {
  if (started) return;
  started = true;
  void syncProfiles();

  // Local edits go up after a short pause, so dragging through a list of jingles is one request, not ten.
  let timer = 0;
  profilesStore.subscribe(() => {
    const dirty = deletedProfiles.length > 0 || profilesStore.get().some((p) => (known.get(p.id) ?? 0) < p.updatedAt);
    if (!dirty) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void syncProfiles(), 700);
  });

  // Edits made elsewhere (someone's phone at home, another laptop) arrive on the next look.
  window.setInterval(() => document.visibilityState === 'visible' && void syncProfiles(), 20_000);
  window.addEventListener('focus', () => void syncProfiles());
  window.addEventListener('online', () => void syncProfiles());
}
