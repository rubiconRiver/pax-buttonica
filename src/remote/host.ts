/**
 * Host side of phone buttons. Two ways for a phone to reach the laptop, used together:
 *
 *  - Direct: a WebRTC data channel, brokered by PeerJS's public server. Instant, but many Wi-Fi networks
 *    (guest networks, anything with client isolation) never let the two ends find each other.
 *  - Through the site: the host writes each phone's light to /api/room and reads presses out of an inbox;
 *    the phone polls. About a second of lag, works anywhere with internet.
 *
 * A phone starts on the site and moves to the direct link the moment one comes up. The room code is remembered
 * so a page reload on the laptop doesn't strand everyone's phone.
 */
import type { DataConnection, Peer } from 'peerjs';
import { saveClip } from '../audio/clips';
import { JINGLES } from '../audio/jingles';
import { createStore } from '../state/createStore';
import { createProfile, findProfile, patchProfile, profilesStore, sanitizePatch, type Profile } from '../state/profiles';
import { apiJson, hostKey } from './key';
import { CODE_ALPHABET, CODE_LENGTH, MAX_CLIP_TRANSFER, ROOM_PREFIX, type HostToPhone, type MyProfile, type PhoneFrame, type PhoneToHost, type RelayRoom, type TableSnapshot } from './messages';

export interface Phone {
  dev: string;
  /** Who this phone's owner says they are, if they've said. */
  profileId: string | null;
  via: 'direct' | 'site';
}

export interface RoomStatus {
  state: 'closed' | 'open';
  code: string | null;
  phones: Phone[];
  /** The direct-link broker is reachable (phones on the same network can skip the site). */
  direct: boolean;
  /** The site has accepted the room (phones anywhere can join through it). */
  site: boolean;
  error?: string;
}

const SAVED = 'pb.room.v1';
export const roomStatus = createStore<RoomStatus>({ state: 'closed', code: null, phones: [], direct: false, site: false });

/** One phone, however it is reached. */
interface Link {
  readonly open: boolean;
  readonly via: 'direct' | 'site';
  send(msg: HostToPhone): void;
  close(): void;
}

let peer: Peer | null = null;
const links = new Map<string, Link>();
const lastSent = new Map<string, string>();
const lastTable = new Map<string, string>();
const identities = new Map<string, string | null>();
const JINGLE_IDS = JINGLES.map((j) => j.id);
const CLIP_ID = /^[A-Za-z0-9-]{8,40}$/;
let onInput: ((dev: string, input: 'tap' | 'double' | 'hold') => void) | null = null;
let onChange: (() => void) | null = null;

export function setRoomHandlers(input: typeof onInput, changed: typeof onChange) {
  onInput = input;
  onChange = changed;
}

const newCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(CODE_LENGTH)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

function listPhones() {
  roomStatus.set((s) => ({ ...s, phones: [...links].map(([dev, l]) => ({ dev, profileId: identities.get(dev) ?? null, via: l.via })) }));
  onChange?.();
}

const tell = (dev: string, msg: HostToPhone) => {
  const l = links.get(dev);
  if (l?.open) l.send(msg);
};

const mine = (p: Profile | undefined): MyProfile | null => (p ? { id: p.id, name: p.name, color: p.color, intro: p.intro, outro: p.outro } : null);
const cards = () => profilesStore.get().map((p) => ({ id: p.id, name: p.name, color: p.color }));

function tellProfiles(dev?: string) {
  const list = cards();
  for (const d of dev ? [dev] : links.keys()) tell(d, { t: 'profiles', list });
}

function tellMe(dev: string) {
  tell(dev, { t: 'me', profile: mine(findProfile(identities.get(dev))) });
}

function identify(dev: string, profileId: string | null) {
  identities.set(dev, profileId && findProfile(profileId) ? profileId : null);
  tellMe(dev);
  listPhones();
}

/** The host decides who a phone is — used when a phone claims a seat the old-fashioned way. */
export function assignIdentity(dev: string, profileId: string) {
  if (links.has(dev) && identities.get(dev) !== profileId) identify(dev, profileId);
}

// Profiles change on the laptop too (setup screen, another phone): keep every phone's picture current.
profilesStore.subscribe(() => {
  tellProfiles();
  for (const dev of links.keys()) tellMe(dev);
});

async function receiveClip(dev: string, msg: Extract<PhoneToHost, { t: 'clip' }>) {
  const id = identities.get(dev);
  if (!id || !findProfile(id)) return;
  const slot = msg.slot === 'outro' ? 'outro' : 'intro';
  try {
    if (typeof msg.id === 'string') {
      // Through the site: the phone uploaded the clip itself and is telling us where it is.
      if (!CLIP_ID.test(msg.id)) throw new Error('That clip could not be saved.');
      patchProfile(id, { [slot]: { kind: 'clip', id: msg.id, name: String(msg.name).slice(0, 60) } });
      return;
    }
    if (!(msg.data instanceof ArrayBuffer) || msg.data.byteLength > MAX_CLIP_TRANSFER) throw new Error('That clip is too big. Keep it under 4 MB.');
    const clip = await saveClip(new File([msg.data], String(msg.name).slice(0, 60), { type: String(msg.mime) }));
    patchProfile(id, { [slot]: { kind: 'clip', ...clip } });
  } catch (err) {
    tell(dev, { t: 'oops', message: (err as Error).message });
  }
}

/** A phone has taken (or retaken) its place: everything it needs to know goes out again. */
function arrive(dev: string, link: Link, profileId: string | null | undefined) {
  const old = links.get(dev);
  links.set(dev, link);
  if (old && old !== link) old.close();
  lastSent.delete(dev);
  lastTable.delete(dev);
  tellProfiles(dev);
  identify(dev, typeof profileId === 'string' ? profileId : identities.get(dev) ?? null);
  if (latestTable) tell(dev, { t: 'table', table: latestTable });
  onChange?.();
}

function handleMessage(dev: string, msg: PhoneToHost) {
  if (msg?.t === 'iam' && typeof msg.id === 'string') {
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
}

function leave(dev: string, link: Link) {
  if (links.get(dev) !== link) return;
  links.delete(dev);
  lastSent.delete(dev);
  delete relayOut.phones[dev];
  listPhones(); // identities are kept, so a phone that drops and returns is still who it was
}

// ── Direct links ────────────────────────────────────────────────────────────

function accept(conn: DataConnection) {
  let dev: string | null = null;
  const link: Link = {
    get open() { return conn.open; },
    via: 'direct',
    send: (m) => conn.send(m),
    close: () => conn.close(),
  };
  conn.on('data', (raw) => {
    const msg = raw as PhoneToHost;
    if (msg?.t === 'hello' && typeof msg.dev === 'string') {
      dev = msg.dev.slice(0, 40);
      arrive(dev, link, msg.profileId);
    } else if (dev) {
      handleMessage(dev, msg);
    }
  });
  const gone = () => dev && leave(dev, link);
  conn.on('close', gone);
  conn.on('error', gone);
}

function startDirect(code: string, attempt = 0) {
  void import('peerjs').then(({ Peer: PeerCtor }) => {
    if (roomStatus.get().code !== code || peer) return;
    const p = new PeerCtor(ROOM_PREFIX + code);
    peer = p;
    p.on('open', () => roomStatus.set((s) => ({ ...s, direct: true, error: undefined })));
    p.on('connection', accept);
    p.on('disconnected', () => !p.destroyed && p.reconnect());
    p.on('error', (err) => {
      if (err.type === 'unavailable-id' && peer === p) {
        // After a reload the broker may still think the old tab owns this code. Keep trying; the site carries on meanwhile.
        p.destroy();
        peer = null;
        roomStatus.set((s) => ({ ...s, direct: false }));
        if (attempt < 40) window.setTimeout(() => startDirect(code, attempt + 1), 3000);
      } else if (err.type !== 'peer-unavailable') {
        roomStatus.set((s) => ({ ...s, direct: false, error: err.message }));
      }
    });
  });
}

// ── Through the site ────────────────────────────────────────────────────────

const relayOut: RelayRoom = { table: null, profiles: [], phones: {} };
let relayTimer = 0;
let relayPending = false;
let relayInbox = 0;
let relayPoll = 0;
let oopsSeq = 0;
const relaySeen = new Map<string, number>();
const RELAY_PHONE_TTL = 45_000;

function relayLink(dev: string): Link {
  const slot = () => (relayOut.phones[dev] ??= {});
  return {
    get open() { return links.get(dev)?.via === 'site'; },
    via: 'site',
    send(m) {
      if (m.t === 'state') slot().state = m;
      else if (m.t === 'me') slot().me = m.profile;
      else if (m.t === 'oops') slot().oops = { seq: ++oopsSeq, message: m.message };
      else if (m.t === 'table') relayOut.table = m.table;
      else if (m.t === 'profiles') relayOut.profiles = m.list;
      scheduleRelayPut();
    },
    close() { delete relayOut.phones[dev]; },
  };
}

function scheduleRelayPut() {
  if (roomStatus.get().state !== 'open') return;
  relayPending = true;
  if (relayTimer) return;
  relayTimer = window.setTimeout(() => void relayPut(), 300);
}

async function relayPut() {
  relayTimer = 0;
  relayPending = false;
  const { code, state } = roomStatus.get();
  if (!code || state !== 'open') return;
  const body = JSON.stringify({ ...relayOut, profiles: relayOut.profiles.length ? relayOut.profiles : cards() });
  try {
    const ok = await apiJson(`/api/room?code=${code}&key=${hostKey()}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
    roomStatus.set((s) => (s.site !== !!ok ? { ...s, site: !!ok } : s));
  } catch {
    roomStatus.set((s) => (s.site ? { ...s, site: false } : s));
  }
  if (relayPending) scheduleRelayPut();
}

async function relayRead() {
  const { code, state } = roomStatus.get();
  if (!code || state !== 'open') return;
  try {
    const res = await apiJson<{ inbox: { seq: number; data: PhoneToHost & { dev: string } }[] }>(`/api/room?code=${code}&key=${hostKey()}&after=${relayInbox}`);
    if (!res) return;
    for (const { seq, data } of res.inbox) {
      relayInbox = Math.max(relayInbox, seq);
      const dev = String(data.dev ?? '').slice(0, 40);
      if (!dev) continue;
      const current = links.get(dev);
      if (data.t === 'hello') {
        relaySeen.set(dev, Date.now());
        // A phone with a direct link up says hello on both; the direct one wins.
        if (current?.via === 'direct' && current.open) continue;
        if (current?.via === 'site') tellMe(dev); // a heartbeat: nothing new, but make sure it knows who it is
        else arrive(dev, relayLink(dev), data.profileId);
      } else if (current?.via === 'site') {
        relaySeen.set(dev, Date.now());
        handleMessage(dev, data);
      } else if (!current) {
        // A press from a phone we haven't heard hello from (the inbox outlived a reload): let it in.
        arrive(dev, relayLink(dev), undefined);
        handleMessage(dev, data);
      }
    }
    // Phones that stopped checking in.
    for (const [dev, link] of links) {
      if (link.via === 'site' && Date.now() - (relaySeen.get(dev) ?? 0) > RELAY_PHONE_TTL) leave(dev, link);
    }
  } catch {
    // offline for a moment; the next poll will try again
  }
}

function startRelay(code: string) {
  relayInbox = 0;
  relayOut.table = latestTable;
  relayOut.profiles = cards();
  relayOut.phones = {};
  scheduleRelayPut();
  window.clearInterval(relayPoll);
  relayPoll = window.setInterval(() => document.visibilityState === 'visible' && void relayRead(), 700);
  void relayRead();
  void relayPut();
  void code;
}

// ── The room ────────────────────────────────────────────────────────────────

export function openRoom(code = newCode()): void {
  if (roomStatus.get().state === 'open') return;
  localStorage.setItem(SAVED, code);
  roomStatus.set({ state: 'open', code, phones: [], direct: false, site: false });
  startRelay(code);
  startDirect(code);
  // A room opened mid-game publishes the table straight away, not at the next move.
  lastPublished = '';
  if (latestTable) publishTable(JSON.stringify(latestTable));
}

export function closeRoom() {
  localStorage.removeItem(SAVED);
  peer?.destroy();
  peer = null;
  window.clearInterval(relayPoll);
  window.clearTimeout(relayTimer);
  relayTimer = 0;
  relayPoll = 0;
  links.clear();
  lastSent.clear();
  identities.clear();
  relaySeen.clear();
  relayOut.phones = {};
  roomStatus.set({ state: 'closed', code: null, phones: [], direct: false, site: false });
  onChange?.();
}

/** Reopen the room a reload interrupted. */
export function resumeRoom() {
  const code = localStorage.getItem(SAVED);
  if (code && roomStatus.get().state !== 'open') openRoom(code);
}

let latestTable: TableSnapshot | null = null;
let publishTimer = 0;
let lastPublished = '';

/** Also publish it on its own, so "The table" works for anyone with the code, phone button or not. */
function publishTable(json: string) {
  const code = roomStatus.get().code;
  if (!code || roomStatus.get().state !== 'open' || json === lastPublished) return;
  window.clearTimeout(publishTimer);
  publishTimer = window.setTimeout(() => {
    fetch(`/api/table?code=${code}&key=${hostKey()}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: json })
      .then((r) => r.ok && (lastPublished = json))
      .catch(() => {});
  }, 1200);
}

/** The public state of the game, for the "Table" view on every phone. */
export function syncTable(table: TableSnapshot) {
  latestTable = table;
  const key = JSON.stringify(table);
  publishTable(key);
  if (relayOut.table !== table) {
    relayOut.table = table;
    scheduleRelayPut();
  }
  for (const [dev, link] of links) {
    if (!link.open || link.via !== 'direct' || lastTable.get(dev) === key) continue;
    lastTable.set(dev, key);
    link.send({ t: 'table', table });
  }
}

/** Send each connected phone its light. Only changes go over the wire. */
export function syncRoom(frameFor: (dev: string) => PhoneFrame) {
  for (const [dev, link] of links) {
    if (!link.open) continue;
    const frame = frameFor(dev);
    const key = JSON.stringify(frame);
    if (lastSent.get(dev) === key) continue;
    lastSent.set(dev, key);
    link.send(frame);
  }
}
