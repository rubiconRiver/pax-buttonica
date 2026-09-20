import type { PlayerSetup } from '../engine/types';
import { createStore } from './createStore';

/** A player's saved identity: their colour, faction of choice and — crucially — their sounds. */
export interface Profile extends PlayerSetup {
  id: string;
}

export const profilesStore = createStore<Profile[]>([], 'pb.profiles.v1', (raw) => (Array.isArray(raw) ? (raw as Profile[]) : []));

export function saveProfile(setup: PlayerSetup): Profile {
  const name = setup.name.trim();
  const existing = profilesStore.get().find((p) => p.name.toLowerCase() === name.toLowerCase());
  const profile: Profile = { ...setup, name, id: existing?.id ?? crypto.randomUUID() };
  profilesStore.set((list) => [...list.filter((p) => p.id !== profile.id), profile].sort((a, b) => a.name.localeCompare(b.name)));
  return profile;
}

export function deleteProfile(id: string) {
  profilesStore.set((list) => list.filter((p) => p.id !== id));
}
