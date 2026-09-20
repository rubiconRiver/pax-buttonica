/**
 * Host side of phone buttons. Signalling goes through PeerJS's public broker;
 * after that, button presses travel phone → laptop directly. The room code is
 * remembered so a page reload on the laptop doesn't strand everyone's phone.
 */
import type { DataConnection, Peer } from 'peerjs';
import { createStore } from '../state/createStore';
import { CODE_ALPHABET, CODE_LENGTH, ROOM_PREFIX, type PhoneFrame, type PhoneToHost } from './messages';

export interface RoomStatus {
  state: 'closed' | 'opening' | 'open';
  code: string | null;
  phones: string[];
  error?: string;
}

const SAVED = 'pb.room.v1';
export const roomStatus = createStore<RoomStatus>({ state: 'closed', code: null, phones: [] });

let peer: Peer | null = null;
const conns = new Map<string, DataConnection>();
const lastSent = new Map<string, string>();
let onInput: ((dev: string, input: 'tap' | 'double' | 'hold') => void) | null = null;
let onChange: (() => void) | null = null;

export function setRoomHandlers(input: typeof onInput, changed: typeof onChange) {
  onInput = input;
  onChange = changed;
}

const newCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(CODE_LENGTH)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

function listPhones() {
  roomStatus.set((s) => ({ ...s, phones: [...conns.keys()] }));
  onChange?.();
}

function accept(conn: DataConnection) {
  let dev: string | null = null;
  conn.on('data', (raw) => {
    const msg = raw as PhoneToHost;
    if (msg?.t === 'hello' && typeof msg.dev === 'string') {
      dev = msg.dev.slice(0, 40);
      conns.get(dev)?.close();
      conns.set(dev, conn);
      lastSent.delete(dev);
      listPhones();
    } else if (msg?.t === 'btn' && dev && (msg.e === 'tap' || msg.e === 'double' || msg.e === 'hold')) {
      onInput?.(dev, msg.e);
    }
  });
  const gone = () => {
    if (dev && conns.get(dev) === conn) {
      conns.delete(dev);
      lastSent.delete(dev);
      listPhones();
    }
  };
  conn.on('close', gone);
  conn.on('error', gone);
}

export async function openRoom(code = newCode(), attempt = 0): Promise<void> {
  if (peer) return;
  roomStatus.set({ state: 'opening', code, phones: [] });
  const { Peer: PeerCtor } = await import('peerjs');
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
  roomStatus.set({ state: 'closed', code: null, phones: [] });
  onChange?.();
}

/** Reopen the room a reload interrupted. */
export function resumeRoom() {
  const code = localStorage.getItem(SAVED);
  if (code && !peer) void openRoom(code);
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
