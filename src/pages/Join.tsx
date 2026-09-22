import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DataConnection, Peer } from 'peerjs';
import { JINGLES } from '../audio/jingles';
import { playSound, unlockAudio, type Playing } from '../audio/synth';
import { Device } from '../components/Device';
import { Scoreboard } from '../components/game/Scoreboard';
import { IconClose, IconPlay, IconUpload } from '../components/Icons';
import { PLAYER_COLORS, colorById } from '../engine/data';
import type { SoundRef } from '../engine/types';
import { CODE_LENGTH, MAX_CLIP_TRANSFER, ROOM_PREFIX, cleanCode, type HostToPhone, type MyProfile, type PhoneFrame, type PhoneToHost, type ProfileCard, type RelayPhone, type TableSnapshot } from '../remote/messages';
import { uploadClipFile } from '../audio/clips';
import '../styles/setup.css';
import '../styles/game.css';
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

/** 'direct' is the WebRTC link; 'site' is polling /api/room; 'lost' means neither is answering. */
type Link = 'connecting' | 'direct' | 'site' | 'lost';
export const WHO = 'pb.phone.profile';
const SITE_POLL_MS = 1000;
const SITE_HELLO_MS = 15_000;

function useRoom(code: string | null) {
  const [direct, setDirect] = useState(false);
  const [site, setSite] = useState<'trying' | 'up' | 'down'>('trying');
  /** Once anything has worked, a quiet spell is "reconnecting", not "connecting". */
  const [ever, setEver] = useState(false);
  const [frame, setFrame] = useState<PhoneFrame | null>(null);
  const [profiles, setProfiles] = useState<ProfileCard[]>([]);
  /** undefined = the host hasn't told us yet; null = nobody in particular. */
  const [me, setMe] = useState<MyProfile | null | undefined>(undefined);
  const [oops, setOops] = useState<string | null>(null);
  const [table, setTable] = useState<TableSnapshot | null>(null);
  const conn = useRef<DataConnection | null>(null);
  const directRef = useRef(false);
  const seenOops = useRef(0);

  const learn = (profile: MyProfile | null) => {
    setMe(profile);
    // Remember who we are, so tomorrow's game doesn't have to ask.
    if (profile) localStorage.setItem(WHO, profile.id);
  };

  // The direct link. It comes up when the network allows; until then the site carries everything.
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
        directRef.current = true;
        setDirect(true);
        setEver(true);
        c.send({ t: 'hello', dev: deviceId(), profileId: localStorage.getItem(WHO) } satisfies PhoneToHost);
      });
      c.on('data', (raw) => {
        const msg = raw as HostToPhone;
        if (msg?.t === 'state') setFrame(msg);
        else if (msg?.t === 'profiles') setProfiles(msg.list);
        else if (msg?.t === 'table') setTable(msg.table);
        else if (msg?.t === 'oops') setOops(msg.message);
        else if (msg?.t === 'me') learn(msg.profile);
      });
      const redial = () => {
        if (dead || conn.current !== c) return;
        directRef.current = false;
        setDirect(false);
        window.clearTimeout(retry);
        retry = window.setTimeout(dial, 2000);
      };
      c.on('close', redial);
      c.on('error', redial);
      // A dial that never completes (the network has no path) is given up on, and tried again later.
      window.setTimeout(() => {
        if (conn.current === c && !c.open && !dead) {
          c.close();
          redial();
        }
      }, 20_000);
    };

    void import('peerjs').then(({ Peer: PeerCtor }) => {
      if (dead) return;
      peer = new PeerCtor();
      peer.on('open', dial);
      peer.on('disconnected', () => peer && !peer.destroyed && peer.reconnect());
      // The host isn't there (yet, or any more): keep knocking.
      peer.on('error', () => {
        if (dead) return;
        directRef.current = false;
        setDirect(false);
        window.clearTimeout(retry);
        retry = window.setTimeout(dial, 2500);
      });
    });

    return () => {
      dead = true;
      directRef.current = false;
      window.clearTimeout(retry);
      peer?.destroy();
    };
  }, [code]);

  const post = (msg: PhoneToHost) =>
    fetch(`/api/room?code=${code}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dev: deviceId(), ...msg }) })
      .then((r) => r.ok)
      .catch(() => false);

  // Through the site: say hello now and then, and read what the host has left for us.
  useEffect(() => {
    if (!code) return;
    let live = true;
    let misses = 0;
    const hello = () => !directRef.current && void post({ t: 'hello', dev: deviceId(), profileId: localStorage.getItem(WHO) });
    const look = async () => {
      if (directRef.current || document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`/api/room?code=${code}&dev=${deviceId()}`);
        if (!live) return;
        if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) throw new Error(String(res.status));
        const room = (await res.json()) as { table: TableSnapshot | null; profiles: ProfileCard[]; phone: RelayPhone | null };
        misses = 0;
        setSite('up');
        setEver(true);
        setProfiles(room.profiles);
        if (room.table) setTable(room.table);
        if (room.phone?.state) setFrame(room.phone.state);
        if (room.phone && 'me' in room.phone) learn(room.phone.me ?? null);
        if (room.phone?.oops && room.phone.oops.seq > seenOops.current) {
          seenOops.current = room.phone.oops.seq;
          setOops(room.phone.oops.message);
        }
      } catch {
        if (live && ++misses >= 3) setSite('down');
      }
    };
    hello();
    void look();
    const t1 = window.setInterval(look, SITE_POLL_MS);
    const t2 = window.setInterval(hello, SITE_HELLO_MS);
    return () => {
      live = false;
      window.clearInterval(t1);
      window.clearInterval(t2);
    };
  }, [code]);

  const say = (msg: PhoneToHost) => {
    if (conn.current?.open) conn.current.send(msg);
    else void post(msg);
  };
  const forget = () => {
    localStorage.removeItem(WHO);
    say({ t: 'leave' });
  };
  const link: Link = direct ? 'direct' : site === 'up' ? 'site' : site === 'down' || ever ? 'lost' : 'connecting';
  return { link, frame, table, profiles, me, oops, clearOops: () => setOops(null), say, forget };
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
  const { link, frame, table, profiles, me, oops, clearOops, say, forget } = useRoom(code);
  const [view, setView] = useState<'button' | 'table'>('button');
  const [anonymous, setAnonymous] = useState(() => sessionStorage.getItem('pb.phone.anon') === '1');
  const [editing, setEditing] = useState(false);
  const [oopsLocal, setOopsLocal] = useState<string | null>(null);
  const send = (e: 'tap' | 'double' | 'hold') => say({ t: 'btn', e });
  const [size, setSize] = useState(280);
  const lastMode = useRef<string | null>(null);
  const connected = link === 'direct' || link === 'site';
  useWakeLock(connected);

  // The table view also arrives through the site, so it works even if this phone can't reach the laptop directly.
  const [polled, setPolled] = useState<TableSnapshot | null>(null);
  useEffect(() => {
    if (view !== 'table') return;
    let live = true;
    const look = () =>
      fetch(`/api/table?code=${code}`)
        .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
        .then((j) => live && j?.table && setPolled(j.table as TableSnapshot))
        .catch(() => {});
    void look();
    const timer = window.setInterval(look, 4000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [view, code]);
  const shown = connected && table ? table : polled ?? table;


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

  const live = connected && frame;

  if (connected && me === null && !anonymous) {
    return (
      <WhoAreYou
        profiles={profiles}
        onPick={(id) => say({ t: 'iam', id })}
        onCreate={(name) => say({ t: 'create', name })}
        onSkip={() => {
          sessionStorage.setItem('pb.phone.anon', '1');
          setAnonymous(true);
        }}
      />
    );
  }

  const tabs = (
    <nav className="join__tabs">
      <button type="button" aria-pressed={view === 'button'} onClick={() => setView('button')}>My button</button>
      <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>The table</button>
    </nav>
  );

  if (view === 'table') {
    return (
      <div className="join join--table">
        {shown ? <Scoreboard table={shown} /> : <p className="muted" style={{ marginTop: 40 }}>Waiting for the game to start…</p>}
        {tabs}
      </div>
    );
  }

  return (
    <div
      className="join"
      onPointerDownCapture={unlockAudio}
      style={{ '--pc': live ? frame.color : '#8d97af', '--flash-ms': `${frame?.flashMs ?? 2000}ms` } as CSSProperties}
    >
      <header className="join__top">
        {me ? (
          <button type="button" className="btn btn--sm" onClick={() => setEditing(true)}>{me.name} · profile</button>
        ) : (
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => { sessionStorage.removeItem('pb.phone.anon'); setAnonymous(false); }}>Who are you?</button>
        )}
        <span className="join__link" data-link={link} title={link === 'site' ? 'Through the site: about a second behind. A direct link to the laptop is tried in the background.' : undefined}>
          {link === 'direct' ? 'Connected' : link === 'site' ? 'Connected via the site' : link === 'lost' ? 'Reconnecting…' : 'Connecting…'}
        </span>
      </header>

      <div className="join__who">
        {live ? (frame.name ?? me?.name ?? (frame.calling ? 'Unclaimed' : 'Spectating')) : ' '}
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
          ? connected ? 'Waiting for the game to start…' : 'Looking for the table…'
          : frame.calling && !frame.name
            ? <>Now calling <b>{frame.calling}</b>. If that's you, press.</>
            : !frame.name && me
              ? "You're not seated in this game."
              : frame.reason}
      </p>
      <p className="join__help">Room {code} · Tap: done · Double-tap: strategy card · Hold: end turn</p>
      {tabs}

      {editing && me && (
        <ProfileSheet
          me={me}
          oops={oops ?? oopsLocal}
          onEdit={(patch) => { clearOops(); setOopsLocal(null); say({ t: 'edit', patch }); }}
          onClip={async (slot, file, data) => {
            clearOops();
            const name = file.name.replace(/\.[^.]+$/, '');
            if (link === 'direct') return say({ t: 'clip', slot, name, mime: file.type, data });
            // Through the site: put the clip where the laptop will look for it, then just point at it.
            try {
              say({ t: 'clip', slot, name, id: await uploadClipFile(file) });
            } catch (err) {
              setOopsLocal((err as Error).message);
            }
          }}
          onSwitch={() => { setEditing(false); forget(); }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

export function WhoAreYou({ profiles, onPick, onCreate, onSkip, eyebrow = 'Connected' }: { profiles: ProfileCard[]; onPick(id: string): void; onCreate(name: string): void; onSkip?(): void; eyebrow?: string }) {
  const [name, setName] = useState('');
  return (
    <div className="join join--ask">
      <div className="eyebrow">{eyebrow}</div>
      <h1>Who are you?</h1>
      {profiles.length > 0 && (
        <div className="who-list">
          {profiles.map((p) => (
            <button key={p.id} type="button" className="btn who-list__item" style={{ '--pc': colorById(p.color).led } as CSSProperties} onClick={() => onPick(p.id)}>
              <i /> {p.name}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onCreate(name.trim()); }}>
        <p className="muted">{profiles.length ? 'Not on the list?' : 'Nobody here yet. Be the first.'}</p>
        <input className="input join__name" value={name} maxLength={14} placeholder="Your name" onChange={(e) => setName(e.target.value)} aria-label="Your name" />
        <button type="submit" className="btn btn--gold" disabled={!name.trim()}>That's me</button>
      </form>
      {onSkip && <button type="button" className="btn btn--sm btn--ghost" onClick={onSkip}>Skip: just be a button</button>}
    </div>
  );
}

let preview: Playing | null = null;

export function ProfileSheet({ me, oops, onEdit, onClip, onSwitch, onClose }: {
  me: MyProfile;
  oops: string | null;
  onEdit(patch: { name?: string; color?: string; intro?: SoundRef; outro?: SoundRef }): void;
  onClip(slot: 'intro' | 'outro', file: File, data: ArrayBuffer): void;
  onSwitch(): void;
  onClose(): void;
}) {
  const [name, setName] = useState(me.name);
  const [error, setError] = useState<string | null>(null);
  const files = { intro: useRef<HTMLInputElement>(null), outro: useRef<HTMLInputElement>(null) };

  const hear = async (ref: SoundRef) => {
    unlockAudio();
    preview?.stop(80);
    if (ref.kind === 'jingle') preview = await playSound(ref);
  };

  const slot = (which: 'intro' | 'outro', label: string) => {
    const value = me[which];
    return (
      <div className="field">
        <span>{label}</span>
        <div className="soundpick__row">
          <select
            className="select"
            value={value.kind === 'jingle' ? value.id : value.kind}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'clip') return;
              const next: SoundRef = v === 'none' ? { kind: 'none' } : { kind: 'jingle', id: v };
              onEdit({ [which]: next });
              void hear(next);
            }}
          >
            <option value="none">Silent</option>
            {value.kind === 'clip' && <option value="clip">♪ {value.name}</option>}
            {JINGLES.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
          <button type="button" className="btn btn--sm btn--icon" title="Preview" disabled={value.kind !== 'jingle'} onClick={() => void hear(value)}><IconPlay /></button>
          <button type="button" className="btn btn--sm btn--icon" title="Upload your own sound" onClick={() => files[which].current?.click()}><IconUpload /></button>
        </div>
        <input
          ref={files[which]}
          type="file"
          accept="audio/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (!f.type.startsWith('audio/')) return setError('That is not an audio file.');
            if (f.size > MAX_CLIP_TRANSFER) return setError('Keep clips under 4 MB. Trim it to the good part.');
            setError(null);
            onClip(which, f, await f.arrayBuffer());
          }}
        />
      </div>
    );
  };

  return (
    <div className="sheet" role="dialog" aria-label="Your profile">
      <div className="sheet__card panel">
        <div className="sheet__head">
          <span className="eyebrow">Your profile</span>
          <button type="button" className="tour__close" aria-label="Close" onClick={onClose}><IconClose /></button>
        </div>
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} maxLength={14} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name.trim() !== me.name && onEdit({ name: name.trim() })} />
        </label>
        <div className="field">
          <span>Favourite colour</span>
          <div className="swatches">
            {PLAYER_COLORS.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={me.color === c.id} aria-label={c.name} className="swatch" style={{ '--sw': c.led } as CSSProperties} onClick={() => onEdit({ color: c.id })} />
            ))}
          </div>
        </div>
        {slot('intro', 'Entrance: plays when your turn starts')}
        {slot('outro', 'Exit: plays when you end your turn')}
        {(error || oops) && <p className="soundpick__error">{error ?? oops}</p>}
        <p className="muted" style={{ fontSize: 12.5 }}>Sounds play from the big screen, not from your phone or your button.</p>
        <div className="sheet__foot">
          <button type="button" className="btn btn--sm btn--ghost" onClick={onSwitch}>Not {me.name}? Switch player</button>
          <button type="button" className="btn btn--gold" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
