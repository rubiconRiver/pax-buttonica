import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DataConnection, Peer } from 'peerjs';
import { JINGLES } from '../audio/jingles';
import { playSound, unlockAudio, type Playing } from '../audio/synth';
import { Device } from '../components/Device';
import { IconClose, IconPlay, IconUpload } from '../components/Icons';
import { PLAYER_COLORS, colorById } from '../engine/data';
import type { SoundRef } from '../engine/types';
import { CODE_LENGTH, MAX_CLIP_TRANSFER, ROOM_PREFIX, cleanCode, type HostToPhone, type MyProfile, type PhoneFrame, type PhoneToHost, type ProfileCard } from '../remote/messages';
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

type Link = 'connecting' | 'connected' | 'lost';
const WHO = 'pb.phone.profile';

function useRoom(code: string | null) {
  const [link, setLink] = useState<Link>('connecting');
  const [frame, setFrame] = useState<PhoneFrame | null>(null);
  const [profiles, setProfiles] = useState<ProfileCard[]>([]);
  /** undefined = the host hasn't told us yet; null = nobody in particular. */
  const [me, setMe] = useState<MyProfile | null | undefined>(undefined);
  const [oops, setOops] = useState<string | null>(null);
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
        c.send({ t: 'hello', dev: deviceId(), profileId: localStorage.getItem(WHO) } satisfies PhoneToHost);
      });
      c.on('data', (raw) => {
        const msg = raw as HostToPhone;
        if (msg?.t === 'state') setFrame(msg);
        else if (msg?.t === 'profiles') setProfiles(msg.list);
        else if (msg?.t === 'oops') setOops(msg.message);
        else if (msg?.t === 'me') {
          setMe(msg.profile);
          // Remember who we are, so tomorrow's game doesn't have to ask.
          if (msg.profile) localStorage.setItem(WHO, msg.profile.id);
        }
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

  const say = (msg: PhoneToHost) => {
    if (conn.current?.open) conn.current.send(msg);
  };
  const forget = () => {
    localStorage.removeItem(WHO);
    say({ t: 'leave' });
  };
  return { link, frame, profiles, me, oops, clearOops: () => setOops(null), say, forget };
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
  const { link, frame, profiles, me, oops, clearOops, say, forget } = useRoom(code);
  const [anonymous, setAnonymous] = useState(() => sessionStorage.getItem('pb.phone.anon') === '1');
  const [editing, setEditing] = useState(false);
  const send = (e: 'tap' | 'double' | 'hold') => say({ t: 'btn', e });
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

  if (link === 'connected' && me === null && !anonymous) {
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
        <span className="join__link" data-link={link}>{link === 'connected' ? 'Connected' : link === 'lost' ? 'Reconnecting…' : 'Connecting…'}</span>
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
          ? link === 'connected' ? 'Waiting for the game to start…' : 'Looking for the table…'
          : frame.calling && !frame.name
            ? <>Now calling <b>{frame.calling}</b>. If that's you, press.</>
            : !frame.name && me
              ? "You're not seated in this game."
              : frame.reason}
      </p>
      <p className="join__help">Room {code} · Tap: done · Double-tap: strategy card · Hold: end turn</p>

      {editing && me && (
        <ProfileSheet
          me={me}
          oops={oops}
          onEdit={(patch) => { clearOops(); say({ t: 'edit', patch }); }}
          onClip={(slot, file, data) => { clearOops(); say({ t: 'clip', slot, name: file.name.replace(/\.[^.]+$/, ''), mime: file.type, data }); }}
          onSwitch={() => { setEditing(false); forget(); }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function WhoAreYou({ profiles, onPick, onCreate, onSkip }: { profiles: ProfileCard[]; onPick(id: string): void; onCreate(name: string): void; onSkip(): void }) {
  const [name, setName] = useState('');
  return (
    <div className="join join--ask">
      <div className="eyebrow">Connected</div>
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
      <button type="button" className="btn btn--sm btn--ghost" onClick={onSkip}>Skip: just be a button</button>
    </div>
  );
}

let preview: Playing | null = null;

function ProfileSheet({ me, oops, onEdit, onClip, onSwitch, onClose }: {
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
        <p className="muted" style={{ fontSize: 12.5 }}>Sounds play from the big screen. Uploaded clips are sent to the host laptop and stay there.</p>
        <div className="sheet__foot">
          <button type="button" className="btn btn--sm btn--ghost" onClick={onSwitch}>Not {me.name}? Switch player</button>
          <button type="button" className="btn btn--gold" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
