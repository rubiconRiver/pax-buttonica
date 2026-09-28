import { FACTION_GROUPS, PLAYER_COLORS } from '../engine/data';
import { deviceTag } from '../engine/engine';
import { clampBrightness, isTurnEffect, isTurnLook, type TurnEffect, type TurnLook } from '../engine/outputs';
import type { PlayerSetup, SoundRef } from '../engine/types';
import { createStore } from './createStore';

/**
 * A player's saved identity: their name, colour, usual faction and — crucially —
 * their sounds. Profiles are kept in the site's database and mirrored in this
 * browser, so a game still runs with the Wi-Fi off (see profileSync.ts).
 * There is no login (yet): it's a board game.
 */
export interface Profile extends Omit<PlayerSetup, 'profileId'> {
  id: string;
  /** Milliseconds since the epoch; the newest edit wins when browsers disagree. */
  updatedAt: number;
  /** How this player likes "your move" drawn on their button. Unset: whatever the host chose for the table. */
  light?: TurnLook;
  /** Their own button's brightness, as a share of the table's (0.1–1). Unset: the table's. */
  brightness?: number;
  /** What their button does the moment their turn starts. Unset: the table's. */
  turnFx?: TurnEffect;
  /** Real buttons that are theirs (device tags, see `deviceTag`): registered by scanning the tag on the button. */
  buttonIds?: string[];
}

export const BUTTON_TAG = /^[0-9a-f]{6,24}$/;
export const MAX_BUTTONS = 8;

export type ProfilePatch = Partial<Omit<Profile, 'id' | 'updatedAt'>>;

export const profilesStore = createStore<Profile[]>([], 'pb.profiles.v1', (raw) =>
  Array.isArray(raw) ? (raw as Profile[]).map((p) => ({ ...p, updatedAt: p.updatedAt ?? Date.now() })) : [],
);

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
    updatedAt: Date.now(),
  };
  profilesStore.set((list) => sorted([...list, profile]));
  return profile;
}

export function patchProfile(id: string, patch: ProfilePatch) {
  profilesStore.set((list) => sorted(list.map((p) => (p.id === id ? { ...p, ...patch, id, updatedAt: Date.now() } : p))));
}

/** Deletions are announced to the sync layer so they reach the database too. */
export const deletedProfiles: string[] = [];

export function deleteProfile(id: string) {
  deletedProfiles.push(id);
  profilesStore.set((list) => list.filter((p) => p.id !== id));
}

export const sortProfiles = sorted;

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
  if (isTurnLook(r.light)) out.light = r.light;
  if (isTurnEffect(r.turnFx)) out.turnFx = r.turnFx;
  if (typeof r.brightness === 'number') out.brightness = clampBrightness(r.brightness);
  if (Array.isArray(r.buttonIds)) out.buttonIds = r.buttonIds.filter((x): x is string => typeof x === 'string').map(deviceTag).filter((x) => BUTTON_TAG.test(x)).slice(0, MAX_BUTTONS);
  return out;
}

/** A button belongs to one person: registering it here takes it off anyone else. */
export function registerButton(profileId: string, dev: string) {
  const tag = deviceTag(dev);
  if (!BUTTON_TAG.test(tag)) return;
  profilesStore.set((list) =>
    sorted(list.map((p) => {
      const has = p.buttonIds?.includes(tag) ?? false;
      if (p.id === profileId) return has ? p : { ...p, buttonIds: [...(p.buttonIds ?? []), tag].slice(-MAX_BUTTONS), updatedAt: Date.now() };
      return has ? { ...p, buttonIds: p.buttonIds!.filter((t) => t !== tag), updatedAt: Date.now() } : p;
    })),
  );
}

export function forgetButton(profileId: string, tag: string) {
  patchProfile(profileId, { buttonIds: (findProfile(profileId)?.buttonIds ?? []).filter((t) => t !== tag) });
}

/** Whose a button is, if anyone has registered it. */
export const ownerOfButton = (dev: string, list: Profile[] = profilesStore.get()) => list.find((p) => p.buttonIds?.includes(deviceTag(dev)));
