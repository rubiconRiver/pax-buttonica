import { FACTION_GROUPS, PLAYER_COLORS } from '../engine/data';
import type { PlayerSetup, SoundRef } from '../engine/types';
import { createStore } from './createStore';

/**
 * A player's saved identity: their name, colour, usual faction and — crucially —
 * their sounds. Profiles live in the host laptop's browser. Players edit their
 * own from their phones while a room is open; there is no login (yet).
 */
export interface Profile extends Omit<PlayerSetup, 'profileId'> {
  id: string;
}

export type ProfilePatch = Partial<Omit<Profile, 'id'>>;

export const profilesStore = createStore<Profile[]>([], 'pb.profiles.v1', (raw) => (Array.isArray(raw) ? (raw as Profile[]) : []));

const INTROS = ['herald', 'war-drums', 'warp-in', 'council-bell', 'glitch', 'trade-wind'];
const OUTROS = ['stand-down', 'mic-drop', 'warp-out', 'sealed', 'over-to-you'];
const sorted = (list: Profile[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));

export const findProfile = (id: string | null | undefined) => (id ? profilesStore.get().find((p) => p.id === id) : undefined);

export function createProfile(name: string, from: ProfilePatch = {}): Profile {
  const n = profilesStore.get().length;
  const profile: Profile = {
    id: crypto.randomUUID(),
    faction: FACTION_GROUPS[0].factions[n % FACTION_GROUPS[0].factions.length],
    color: PLAYER_COLORS[n % PLAYER_COLORS.length].id,
    intro: { kind: 'jingle', id: INTROS[n % INTROS.length] },
    outro: { kind: 'jingle', id: OUTROS[n % OUTROS.length] },
    buttons: 1,
    ...from,
    name: name.trim().slice(0, 14),
  };
  profilesStore.set((list) => sorted([...list, profile]));
  return profile;
}

export function patchProfile(id: string, patch: ProfilePatch) {
  profilesStore.set((list) => sorted(list.map((p) => (p.id === id ? { ...p, ...patch, id } : p))));
}

export function deleteProfile(id: string) {
  profilesStore.set((list) => list.filter((p) => p.id !== id));
}

/** Only what a phone is allowed to change about a profile, with everything checked. */
export function sanitizePatch(raw: unknown, jingleIds: string[]): ProfilePatch {
  const out: ProfilePatch = {};
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.name === 'string' && r.name.trim()) out.name = r.name.trim().slice(0, 14);
  if (typeof r.color === 'string' && PLAYER_COLORS.some((c) => c.id === r.color)) out.color = r.color;
  for (const slot of ['intro', 'outro'] as const) {
    const s = r[slot] as SoundRef | undefined;
    if (s?.kind === 'none') out[slot] = { kind: 'none' };
    else if (s?.kind === 'jingle' && jingleIds.includes(s.id)) out[slot] = { kind: 'jingle', id: s.id };
  }
  return out;
}
