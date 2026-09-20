/**
 * Host side of phone buttons. Signalling goes through PeerJS's public broker;
 * after that, button presses travel phone → laptop directly. The room code is
 * remembered so a page reload on the laptop doesn't strand everyone's phone.
 */
import type { DataConnection, Peer } from 'peerjs';
import { saveClip } from '../audio/clips';
import { JINGLES } from '../audio/jingles';
import { createStore } from '../state/createStore';
import { createProfile, findProfile, patchProfile, profilesStore, sanitizePatch, type Profile } from '../state/profiles';
import { CODE_ALPHABET, CODE_LENGTH, MAX_CLIP_TRANSFER, ROOM_PREFIX, type HostToPhone, type MyProfile, type PhoneFrame, type PhoneToHost, type TableSnapshot } from './messages';

export interface Phone {
  dev: string;
  /** Who this phone's owner says they are, if they've said. */
  profileId: string | null;
}

export interface RoomStatus {
  state: 'closed' | 'opening' | 'open';
  code: string | null;
  phones: Phone[];
  error?: string;
}

const SAVED = 'pb.room.v1';
export const roomStatus = createStore<RoomStatus>({ state: 'closed', code: null, phones: [] });

let peer: Peer | null = null;
const conns = new Map<string, DataConnection>();
const lastSent = new Map<string, string>();
const identities = new Map<string, string | null>();
const JINGLE_IDS = JINGLES.map((j) => j.id);
let onInput: ((dev: string, input: 'tap' | 'double' | 'hold') => void) | null = null;
let onChange: (() => void) | null = null;

export function setRoomHandlers(input: typeof onInput, changed: typeof onChange) {
  onInput = input;
  onChange = changed;
}

const newCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(CODE_LENGTH)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

function listPhones() {
  roomStatus.set((s) => ({ ...s, phones: [...conns.keys()].map((dev) => ({ dev, profileId: identities.get(dev) ?? null })) }));
  onChange?.();
}

const tell = (conn: DataConnection | undefined, msg: HostToPhone) => conn?.open && conn.send(msg);

const mine = (p: Profile | undefined): MyProfile | null => (p ? { id: p.id, name: p.name, color: p.color, intro: p.intro, outro: p.outro } : null);

function tellProfiles(conn?: DataConnection) {
  const list = profilesStore.get().map((p) => ({ id: p.id, name: p.name, color: p.color }));
  for (const c of conn ? [conn] : conns.values()) tell(c, { t: 'profiles', list });
}

function tellMe(dev: string) {
  tell(conns.get(dev), { t: 'me', profile: mine(findProfile(identities.get(dev))) });
}

function identify(dev: string, profileId: string | null) {
  identities.set(dev, profileId && findProfile(profileId) ? profileId : null);
  tellMe(dev);
  listPhones();
}

/** The host decides who a phone is — used when a phone claims a seat the old-fashioned way. */
export function assignIdentity(dev: string, profileId: string) {
  if (conns.has(dev) && identities.get(dev) !== profileId) identify(dev, profileId);
}

// Profiles change on the laptop too (setup screen, another phone): keep every phone's picture current.
profilesStore.subscribe(() => {
  tellProfiles();
  for (const dev of conns.keys()) tellMe(dev);
});

async function receiveClip(dev: string, msg: Extract<PhoneToHost, { t: 'clip' }>) {
  const id = identities.get(dev);
  const conn = conns.get(dev);
  if (!id || !findProfile(id)) return;
  try {
    if (!(msg.data instanceof ArrayBuffer) || msg.data.byteLength > MAX_CLIP_TRANSFER) throw new Error('That clip is too big. Keep it under 4 MB.');
    const clip = await saveClip(new File([msg.data], String(msg.name).slice(0, 60), { type: String(msg.mime) }));
    patchProfile(id, { [msg.slot === 'outro' ? 'outro' : 'intro']: { kind: 'clip', ...clip } });
  } catch (err) {
    tell(conn, { t: 'oops', message: (err as Error).message });
  }
}

function accept(conn: DataConnection) {
  let dev: string | null = null;
  conn.on('data', (raw) => {
    const msg = raw as PhoneToHost;
    if (msg?.t === 'hello' && typeof msg.dev === 'string') {
      dev = msg.dev.slice(0, 40);
      const old = conns.get(dev);
      conns.set(dev, conn);
      if (old && old !== conn) old.close();
      lastSent.delete(dev);
      lastTable.delete(dev);
      tellProfiles(conn);
      identify(dev, typeof msg.profileId === 'string' ? msg.profileId : identities.get(dev) ?? null);
    } else if (!dev) {
      return;
    } else if (msg?.t === 'iam' && typeof msg.id === 'string') {
      identify(dev, msg.id);
    } else if (msg?.t === 'create' && typeof msg.name === 'string' && msg.name.trim()) {
      const name = msg.name.trim().slice(0, 14);
      const existing = profilesStore.get().find((p) => p.name.toLowerCase() === name.toLowerCase());
      identify(dev, (existing ?? createProfile(name)).id);
    } else if (msg?.t === 'leave') {
      identify(dev, null);
    } else if (msg?.t === 'edit') {
      const id = identities.get(dev);
      if (id) patchProfile(id, sanitizePatch(msg.patch, JINGLE_IDS));
    } else if (msg?.t === 'clip') {
      void receiveClip(dev, msg);
    } else if (msg?.t === 'btn' && (msg.e === 'tap' || msg.e === 'double' || msg.e === 'hold')) {
      onInput?.(dev, msg.e);
    }
  });
  const gone = () => {
    if (dev && conns.get(dev) === conn) {
      conns.delete(dev);
      lastSent.delete(dev);
      listPhones(); // identities are kept, so a phone that drops and returns is still who it was
    }
  };
  conn.on('close', gone);
  conn.on('error', gone);
}

let opening = false;

export async function openRoom(code = newCode(), attempt = 0): Promise<void> {
  // The guard must be synchronous: two callers in the same tick (React runs effects twice in dev)
  // would otherwise both get past the check while the library is still loading, and fight over the code.
  if (peer || opening) return;
  opening = true;
  roomStatus.set({ state: 'opening', code, phones: [] });
  const { Peer: PeerCtor } = await import('peerjs').finally(() => (opening = false));
  const p = new PeerCtor(ROOM_PREFIX + code);
  peer = p;
  p.on('open', () => {
    localStorage.setItem(SAVED, code);
    roomStatus.set((s) => ({ ...s, state: 'open', error: undefined }));
  });
  p.on('connection', accept);
  p.on('disconnected', () => !p.destroyed && p.reconnect());
  p.on('error', (err) => {
    if (err.type === 'unavailable-id' && peer === p) {
      // After a reload the broker may still think the old tab owns this code. Wait it out, then give up and re-roll.
      p.destroy();
      peer = null;
      // Phones keep dialling the old code, so be patient (~90s) before settling for a new one.
      window.setTimeout(() => void openRoom(attempt < 30 ? code : newCode(), attempt + 1), 3000);
    } else if (err.type !== 'peer-unavailable') {
      roomStatus.set((s) => ({ ...s, error: err.message }));
    }
  });
}

export function closeRoom() {
  localStorage.removeItem(SAVED);
  peer?.destroy();
  peer = null;
  conns.clear();
  lastSent.clear();
  identities.clear();
  roomStatus.set({ state: 'closed', code: null, phones: [] });
  onChange?.();
}

/** Reopen the room a reload interrupted. */
export function resumeRoom() {
  const code = localStorage.getItem(SAVED);
  if (code && !peer) void openRoom(code);
}

const lastTable = new Map<string, string>();

const TABLE_KEY = 'pb.room.key.v1';
let publishTimer = 0;
let lastPublished = '';

/** Also publish it through the site, so the table view works even when a phone can't reach this laptop directly. */
function publishTable(json: string) {
  const code = roomStatus.get().code;
  if (!code || roomStatus.get().state !== 'open' || json === lastPublished) return;
  window.clearTimeout(publishTimer);
  publishTimer = window.setTimeout(() => {
    let key = localStorage.getItem(TABLE_KEY);
    if (!key) localStorage.setItem(TABLE_KEY, (key = crypto.randomUUID()));
    fetch(`/api/table?code=${code}&key=${key}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: json })
      .then((r) => r.ok && (lastPublished = json))
      .catch(() => {});
  }, 1200);
}

/** The public state of the game, for the "Table" view on every phone. */
export function syncTable(table: TableSnapshot) {
  const key = JSON.stringify(table);
  publishTable(key);
  for (const [dev, conn] of conns) {
    if (!conn.open || lastTable.get(dev) === key) continue;
    lastTable.set(dev, key);
    conn.send({ t: 'table', table } satisfies HostToPhone);
  }
}

/** Send each connected phone its light. Only changes go over the wire. */
export function syncRoom(frameFor: (dev: string) => PhoneFrame) {
  for (const [dev, conn] of conns) {
    if (!conn.open) continue;
    const frame = frameFor(dev);
    const key = JSON.stringify(frame);
    if (lastSent.get(dev) === key) continue;
    lastSent.set(dev, key);
    conn.send(frame);
  }
}
