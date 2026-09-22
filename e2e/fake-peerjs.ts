/**
 * A stand-in for the `peerjs` package, used only when the dev server runs with E2E_FAKE_PEER=1 (see vite.config.ts).
 *
 * The real library signals through a public broker and then opens a WebRTC data channel: two things a test run
 * can't depend on. This keeps the same surface the app uses (Peer, connect, 'open' / 'connection' / 'data' /
 * 'close' / 'error') but carries the messages over a BroadcastChannel, so a "laptop" tab and "phone" tabs in one
 * browser can talk. Everything on either side of the wire — host.ts, Join.tsx — runs for real.
 */
type Handler = (...args: any[]) => void;

class Emitter {
  private handlers = new Map<string, Handler[]>();
  on(event: string, fn: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn]);
    return this;
  }
  emit(event: string, ...args: unknown[]) {
    for (const fn of this.handlers.get(event) ?? []) fn(...args);
  }
}

type Wire =
  | { k: 'connect'; to: string; from: string; conn: string }
  | { k: 'accept'; to: string; conn: string }
  | { k: 'data'; to: string; conn: string; payload: unknown }
  | { k: 'close'; to: string; conn: string };

const CHANNEL = 'fake-peerjs';

export class DataConnection extends Emitter {
  open = false;
  dialTimer = 0;
  constructor(private owner: Peer, readonly connectionId: string, readonly peer: string) {
    super();
  }
  send(payload: unknown) {
    if (this.open) this.owner.post({ k: 'data', to: this.peer, conn: this.connectionId, payload });
  }
  close() {
    if (!this.open) return;
    this.owner.post({ k: 'close', to: this.peer, conn: this.connectionId });
    this.owner.drop(this);
  }
}

export class Peer extends Emitter {
  readonly id: string;
  destroyed = false;
  disconnected = false;
  private channel = new BroadcastChannel(CHANNEL);
  private conns = new Map<string, DataConnection>();

  constructor(id?: string) {
    super();
    this.id = id ?? `anon-${Math.random().toString(36).slice(2, 10)}`;
    this.channel.onmessage = (e) => this.receive(e.data as Wire);
    queueMicrotask(() => !this.destroyed && this.emit('open', this.id));
    window.addEventListener('pagehide', () => this.destroy());
  }

  post(msg: Wire) {
    if (!this.destroyed) this.channel.postMessage(msg);
  }

  drop(conn: DataConnection) {
    if (!this.conns.delete(conn.connectionId)) return;
    window.clearTimeout(conn.dialTimer);
    conn.open = false;
    conn.emit('close');
  }
  /** Both the dead-dial timer and the never-opened case land here, so `close` fires exactly once. */

  connect(to: string, _options?: unknown) {
    const conn = new DataConnection(this, crypto.randomUUID(), to);
    this.conns.set(conn.connectionId, conn);
    // A tab with this flag is on a network where WebRTC never finds a path: signalling works, nothing follows.
    if (sessionStorage.getItem('fake-peer-dead')) {
      conn.dialTimer = window.setTimeout(() => this.drop(conn), 4000);
      return conn;
    }
    this.post({ k: 'connect', to, from: this.id, conn: conn.connectionId });
    // Nobody picked up: the real library reports this on the peer, not the connection.
    conn.dialTimer = window.setTimeout(() => {
      if (conn.open || this.destroyed) return;
      this.conns.delete(conn.connectionId);
      this.emit('error', Object.assign(new Error(`Could not connect to peer ${to}`), { type: 'peer-unavailable' }));
    }, 1000);
    return conn;
  }

  private receive(msg: Wire) {
    if (this.destroyed || msg.to !== this.id) return;
    if (msg.k === 'connect') {
      const conn = new DataConnection(this, msg.conn, msg.from);
      this.conns.set(msg.conn, conn);
      this.emit('connection', conn);
      conn.open = true;
      this.post({ k: 'accept', to: msg.from, conn: msg.conn });
      conn.emit('open');
      return;
    }
    const conn = this.conns.get(msg.conn);
    if (!conn) return;
    if (msg.k === 'accept') {
      window.clearTimeout(conn.dialTimer);
      conn.open = true;
      conn.emit('open');
    } else if (msg.k === 'data') {
      conn.emit('data', msg.payload);
    } else if (msg.k === 'close') {
      this.drop(conn);
    }
  }

  reconnect() {}

  destroy() {
    if (this.destroyed) return;
    for (const conn of [...this.conns.values()]) conn.close();
    this.destroyed = true;
    this.channel.close();
  }
}

export default Peer;
