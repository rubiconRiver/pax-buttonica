import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DataConnection, Peer } from 'peerjs';
import { unlockAudio } from '../audio/synth';
import { Device } from '../components/Device';
import { CODE_LENGTH, ROOM_PREFIX, cleanCode, type PhoneFrame, type PhoneToHost } from '../remote/messages';
import '../styles/join.css';

function deviceId(): string {
  const key = 'pb.phone.dev';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `web-${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

type Link = 'connecting' | 'connected' | 'lost';

function useRoom(code: string | null) {
  const [link, setLink] = useState<Link>('connecting');
  const [frame, setFrame] = useState<PhoneFrame | null>(null);
  const conn = useRef<DataConnection | null>(null);

  useEffect(() => {
    if (!code) return;
    let peer: Peer | null = null;
    let dead = false;
    let retry = 0;

    const dial = () => {
      if (dead || !peer || peer.destroyed) return;
      const c = peer.connect(ROOM_PREFIX + code, { reliable: true });
      conn.current = c;
      c.on('open', () => {
        setLink('connected');
        c.send({ t: 'hello', dev: deviceId() } satisfies PhoneToHost);
      });
      c.on('data', (raw) => {
        const msg = raw as PhoneFrame;
        if (msg?.t === 'state') setFrame(msg);
      });
      const redial = () => {
        if (dead || conn.current !== c) return;
        setLink('lost');
        window.clearTimeout(retry);
        retry = window.setTimeout(dial, 2000);
      };
      c.on('close', redial);
      c.on('error', redial);
    };

    setLink('connecting');
    void import('peerjs').then(({ Peer: PeerCtor }) => {
      if (dead) return;
      peer = new PeerCtor();
      peer.on('open', dial);
      peer.on('disconnected', () => peer && !peer.destroyed && peer.reconnect());
      // The host isn't there (yet, or any more): keep knocking.
      peer.on('error', () => {
        if (dead) return;
        setLink('lost');
        window.clearTimeout(retry);
        retry = window.setTimeout(dial, 2500);
      });
    });

    return () => {
      dead = true;
      window.clearTimeout(retry);
      peer?.destroy();
    };
  }, [code]);

  const send = (e: 'tap' | 'double' | 'hold') => {
    if (conn.current?.open) conn.current.send({ t: 'btn', e } satisfies PhoneToHost);
  };
  return { link, frame, send };
}

/** Keep the phone awake while it's being a button. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const take = () => navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {});
    const onVisible = () => document.visibilityState === 'visible' && take();
    void take();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}

export function Join() {
  const params = useParams();
  const navigate = useNavigate();
  const code = params.code ? cleanCode(params.code) : null;
  const [typed, setTyped] = useState('');

  if (!code || code.length !== CODE_LENGTH) {
    return (
      <div className="join join--ask">
        <div className="eyebrow">Pax Buttonica</div>
        <h1>Your phone is the button</h1>
        <p className="muted">Type the room code from the big screen.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (typed.length === CODE_LENGTH) navigate(`/join/${typed}`); }}>
          <input
            className="join__code"
            value={typed}
            onChange={(e) => setTyped(cleanCode(e.target.value))}
            placeholder="····"
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-label="Room code"
          />
          <button type="submit" className="btn btn--gold btn--lg" disabled={typed.length !== CODE_LENGTH}>Join the table</button>
        </form>
      </div>
    );
  }
  return <PhoneButton code={code} />;
}

function PhoneButton({ code }: { code: string }) {
  const { link, frame, send } = useRoom(code);
  const [size, setSize] = useState(280);
  const lastMode = useRef<string | null>(null);
  useWakeLock(link === 'connected');

  useEffect(() => {
    const fit = () => setSize(Math.round(Math.min(window.innerWidth * 0.82, window.innerHeight * 0.5, 460)));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // A buzz in the pocket when the button starts asking for attention.
  useEffect(() => {
    const mode = frame?.mode ?? null;
    if (mode !== lastMode.current && (mode === 'pulse' || mode === 'flash')) navigator.vibrate?.(mode === 'flash' ? [120, 80, 120] : 200);
    lastMode.current = mode;
  }, [frame?.mode]);

  const live = link === 'connected' && frame;
  return (
    <div
      className="join"
      onPointerDownCapture={unlockAudio}
      style={{ '--pc': live ? frame.color : '#8d97af', '--flash-ms': `${frame?.flashMs ?? 2000}ms` } as CSSProperties}
    >
      <header className="join__top">
        <span className="chip">Room {code}</span>
        <span className="join__link" data-link={link}>{link === 'connected' ? 'Connected' : link === 'lost' ? 'Reconnecting…' : 'Connecting…'}</span>
      </header>

      <div className="join__who">
        {live ? (frame.name ?? (frame.calling ? 'Unclaimed' : 'Spectating')) : ' '}
      </div>

      <Device
        color={live ? frame.color : '#ffffff'}
        mode={live ? frame.mode : 'off'}
        size={size}
        holdMs={frame?.holdMs ?? 2000}
        label="Your button"
        react={live ? frame.react : null}
        onInput={(input) => (input === 'tap' || input === 'double' || input === 'hold') && send(input)}
      />

      <p className="join__why">
        {!live
          ? 'Looking for the table…'
          : frame.calling && !frame.name
            ? <>Now calling <b>{frame.calling}</b>. If that's you, press.</>
            : frame.reason}
      </p>
      <p className="join__help">Tap: done · Double-tap: strategy card · Hold: end turn</p>
    </div>
  );
}
