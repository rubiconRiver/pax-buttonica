import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { saveClip } from '../audio/clips';
import { JINGLES } from '../audio/jingles';
import { playSound, unlockAudio, type Playing } from '../audio/synth';
import { Device } from '../components/Device';
import { Scoreboard } from '../components/game/Scoreboard';
import { reactionFor, useReactions, type Reaction } from '../components/game/useReactions';
import { IconClose, IconGear, IconPlay, IconUpload } from '../components/Icons';
import { useWakeLock } from '../components/useWakeLock';
import { PLAYER_COLORS, colorById } from '../engine/data';
import { CODE_LENGTH, cleanCode, seatOfDevice } from '../engine/engine';
import { TURN_LOOKS, UNCLAIMED, clampBrightness, deriveOutputs, levelsOf, screenLevels, type DeviceOutput, type TurnLook, TURN_EFFECTS, type TurnEffect } from '../engine/outputs';
import type { GameState, SoundRef } from '../engine/types';
import type { GameRecord } from '../remote/sync';
import { snapshotOf } from '../remote/messages';
import { useStore } from '../state/createStore';
import { createProfile, patchProfile, profilesStore, type Profile } from '../state/profiles';
import '../styles/setup.css';
import '../styles/game.css';
import '../styles/join.css';

/**
 * Your phone as a button. The phone reads the whole game off the site and works out its own light with the
 * same code the host uses; presses go back through the site's inbox. Nothing here decides anything about
 * the game: the host laptop does that.
 */

function deviceId(): string {
  const key = 'pb.phone.dev';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `web-${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export const WHO = 'pb.phone.profile';
export const MAX_CLIP_TRANSFER = 4 * 1024 * 1024;
const POLL_MS = 800;
const HELLO_MS = 15_000;
const MISSES_BEFORE_LOST = 5;

type Link = 'connecting' | 'connected' | 'lost' | 'nogame';
type Outbound = { type: 'input'; input: 'tap' | 'double' | 'hold' } | { type: 'identify'; profileId: string | null } | { type: 'hello' } | { type: 'preview'; fx: TurnEffect };

function useGame(code: string) {
  const [link, setLink] = useState<Link>('connecting');
  const [record, setRecord] = useState<GameRecord | null>(null);
  const seq = useRef(0);
  const misses = useRef(0);
  const pollSoon = useRef(0);

  const look = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const res = await fetch(`/api/game?code=${code}&after=${seq.current}`);
      if (res.status === 204) {
        misses.current = 0;
        setLink('connected');
        return;
      }
      if (res.status === 404) return setLink('nogame');
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) throw new Error(String(res.status));
      const body = (await res.json()) as { seq: number; record: GameRecord };
      misses.current = 0;
      seq.current = body.seq;
      setRecord(body.record);
      setLink('connected');
    } catch {
      if (++misses.current >= MISSES_BEFORE_LOST) setLink('lost');
    }
  }, [code]);

  useEffect(() => {
    let live = true;
    void look();
    const t = window.setInterval(() => live && void look(), POLL_MS);
    // Back from a pocket: catch up at once rather than at the next tick.
    const onVisible = () => document.visibilityState === 'visible' && void look();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      window.clearInterval(t);
      window.clearTimeout(pollSoon.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [look]);

  const say = useCallback(
    (msg: Outbound) => {
      void fetch(`/api/actions?code=${code}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dev: deviceId(), ...msg }) })
        .then(() => {
          // The host answers within about a second; look a little sooner than the next scheduled poll.
          window.clearTimeout(pollSoon.current);
          pollSoon.current = window.setTimeout(() => void look(), 600);
        })
        .catch(() => {});
    },
    [code, look],
  );

  // Presence: so the host can count the phones in the room.
  useEffect(() => {
    say({ type: 'hello' });
    const t = window.setInterval(() => document.visibilityState === 'visible' && say({ type: 'hello' }), HELLO_MS);
    return () => window.clearInterval(t);
  }, [say]);

  return { link, record, say };
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
        <p className="muted">Type the game's code from the big screen.</p>
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
            aria-label="Game code"
          />
          <button type="submit" className="btn btn--gold btn--lg" disabled={typed.length !== CODE_LENGTH}>Join the table</button>
        </form>
      </div>
    );
  }
  // A new code is a new game: nothing from the last one carries over.
  return <PhoneButton key={code} code={code} />;
}

const OFF: DeviceOutput = { color: '#ffffff', mode: 'off', reason: '' };

function PhoneButton({ code }: { code: string }) {
  const { link, record, say } = useGame(code);
  const profiles = useStore(profilesStore);
  // Arriving from the tag on a real button: the page already knows who this is.
  const [params, setParams] = useSearchParams();
  const arriveAs = params.get('as');
  const [view, setView] = useState<'button' | 'table'>('button');
  const [editing, setEditing] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [oops, setOops] = useState<string | null>(null);
  /** null: not decided yet (follows the game); true: showing the question; false: answered or skipped. */
  const [asking, setAsking] = useState<boolean | null>(arriveAs ? false : null);
  const [size, setSize] = useState(280);
  const lastMode = useRef<string | null>(null);
  const dev = deviceId();
  const connected = link === 'connected';
  // Awake for as long as the page is open: a phone that locks during an outage misses the table coming back.
  useWakeLock();

  const game: GameState | null = record?.state ?? null;
  // The seat this phone holds, or its owner's seat when a real button holds it: then the phone is a companion.
  const seat = game ? seatOfDevice(game, dev) : -1;
  const companion = !!game && seat >= 0 && game.bindings[seat] !== dev;
  const known = game ? dev in game.devices : false;
  const meId = game?.devices[dev] ?? null;
  const me = meId ? profiles.find((p) => p.id === meId) : undefined;
  const outputs = useMemo(() => (game ? deriveOutputs(game) : []), [game]);
  const output = seat >= 0 ? outputs[seat] : game?.seating ? UNCLAIMED : OFF;
  // How "your move" is drawn, and what happens when it starts: my own taste if I've set one, else the table's.
  const tableLook: TurnLook = record?.settings.turnLight ?? 'pulse';
  const look: TurnLook = me?.light ?? tableLook;
  const tableFx: TurnEffect = record?.settings.turnFx ?? 'ring';
  const myFx: TurnEffect = me?.turnFx ?? tableFx;
  // Waiting and effects as bright, next to "your move", as the host set them for the real buttons.
  const screen = screenLevels(levelsOf(record?.settings ?? {}));
  const effects = useMemo(() => (game ? game.players.map((_, i) => (i === seat ? myFx : undefined)) : []), [game, seat, myFx]);
  const reactions = useReactions(game ?? EMPTY, effects);
  // Trying an effect out: drawn here at once, and the table shows it on my seat (and my real button, if I have one).
  const [tried, setTried] = useState<Reaction>(null);
  const triedSeq = useRef(0);
  const tryEffect = (fx: TurnEffect) => {
    const kind = reactionFor(fx);
    setTried(kind ? { id: -(++triedSeq.current), kind } : null);
    if (record) say({ type: 'preview', fx });
  };
  useEffect(() => {
    if (!tried) return;
    const t = window.setTimeout(() => setTried(null), 1300);
    return () => window.clearTimeout(t);
  }, [tried]);
  const table = useMemo(() => (game ? snapshotOf(game) : null), [game]);

  // The question is asked once per game: the first time this phone shows up in a game that doesn't know it.
  useEffect(() => {
    if (game && asking === null) setAsking(!known);
  }, [game, known, asking]);
  useEffect(() => {
    if (!game || !arriveAs) return;
    if (meId !== arriveAs) say({ type: 'identify', profileId: arriveAs });
    setParams({}, { replace: true });
  }, [game, arriveAs, meId, say, setParams]);
  // Remember who we are, so the profile page and the next game's list know.
  useEffect(() => {
    if (meId) localStorage.setItem(WHO, meId);
  }, [meId]);

  useEffect(() => {
    const fit = () => setSize(Math.round(Math.min(window.innerWidth * 0.82, window.innerHeight * 0.5, 460)));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // A buzz in the pocket when the button starts asking for attention.
  useEffect(() => {
    const mode = output.mode;
    if (mode !== lastMode.current && (mode === 'pulse' || mode === 'flash')) navigator.vibrate?.(mode === 'flash' ? [120, 80, 120] : 200);
    lastMode.current = mode;
  }, [output.mode]);

  const become = (id: string) => {
    setAsking(false);
    say({ type: 'identify', profileId: id });
  };

  if (link === 'nogame') {
    return (
      <div className="join join--ask">
        <div className="eyebrow">Pax Buttonica</div>
        <h1>No game with that code</h1>
        <p className="muted">Check the four letters on the big screen. Codes are retired when a game ends.</p>
        <a href="/join" className="btn btn--sm btn--ghost">Type another code</a>
      </div>
    );
  }

  if (connected && game && asking) {
    return (
      <WhoAreYou
        profiles={profiles}
        first={[...game.players.map((p) => p.profileId).filter((x): x is string => !!x), localStorage.getItem(WHO) ?? '']}
        onPick={become}
        onCreate={(name) => {
          const existing = profiles.find((p) => p.name.toLowerCase() === name.toLowerCase());
          become((existing ?? createProfile(name)).id);
        }}
        onSkip={() => {
          setAsking(false);
          say({ type: 'identify', profileId: null });
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
        {table ? <Scoreboard table={table} /> : <p className="muted" style={{ marginTop: 40 }}>Waiting for the game…</p>}
        {tabs}
      </div>
    );
  }

  const live = connected && !!game;
  const name = seat >= 0 ? game!.players[seat].name : null;
  const calling = game?.seating ? game.players[game.seating.next].name : null;

  return (
    <div
      className="join"
      onPointerDownCapture={unlockAudio}
      style={{ '--pc': live ? output.color : '#8d97af', '--flash-ms': `${record?.settings.flashMs ?? 2000}ms`, '--dim-lum': screen.dim, '--fx-gain': screen.fx } as CSSProperties}
    >
      <header className="join__top">
        {me ? (
          <span className="join__me">
            <button type="button" className="btn btn--sm" onClick={() => setEditing(true)}>{me.name} · profile</button>
            <button type="button" className="btn btn--sm btn--icon btn--ghost" title="Your light" aria-label="Your light" onClick={() => setTuning(true)}><IconGear /></button>
          </span>
        ) : (
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setAsking(true)}>Who are you?</button>
        )}
        <span className="join__link" data-link={link}>{link === 'connected' ? 'Connected' : link === 'lost' ? 'Reconnecting…' : 'Connecting…'}</span>
      </header>

      <div className="join__who">{live ? (name ?? me?.name ?? (calling ? 'Unclaimed' : 'Spectating')) : ' '}</div>

      <Device
        color={live ? output.color : '#ffffff'}
        mode={live ? output.mode : 'off'}
        look={look}
        size={size}
        holdMs={record?.settings.holdMs}
        holdOk={!live || output.hold !== false}
        label="Your button"
        react={tried ?? (live && seat >= 0 ? reactions[seat] : null)}
        onInput={(input) => (input === 'tap' || input === 'double' || input === 'hold') && say({ type: 'input', input })}
      />

      <p className="join__why">
        {!live
          ? 'Looking for the table…'
          : calling && !name
            ? <>Now calling <b>{calling}</b>. If that's you, press.</>
            : !name && me
              ? "You're not seated in this game."
              : output.reason}
      </p>
      <p className="join__help">
        {companion ? 'Alongside your button: this phone shows the same light, and presses here count too · ' : ''}
        Game {code} · Tap: done · Double-tap: strategy card · Hold: end turn
      </p>
      {tabs}

      {tuning && me && (
        <LightSheet me={me} tableLook={tableLook} tableFx={tableFx} onEdit={(patch) => patchProfile(me.id, patch)} onPreview={tryEffect} onClose={() => setTuning(false)} />
      )}
      {editing && me && (
        <ProfileSheet
          me={me}
          oops={oops}
          onEdit={(patch) => { setOops(null); patchProfile(me.id, patch); }}
          onClip={async (slot, file) => {
            try {
              setOops(null);
              patchProfile(me.id, { [slot]: { kind: 'clip', ...(await saveClip(file)) } });
            } catch (err) {
              setOops((err as Error).message);
            }
          }}
          onSwitch={() => {
            setEditing(false);
            localStorage.removeItem(WHO);
            say({ type: 'identify', profileId: null });
            setAsking(true);
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

const EMPTY = { players: [], fx: [] } as unknown as GameState;

export function WhoAreYou({ profiles, first = [], onPick, onCreate, onSkip, eyebrow = 'Connected' }: { profiles: Profile[]; first?: string[]; onPick(id: string): void; onCreate(name: string): void; onSkip?(): void; eyebrow?: string }) {
  const [name, setName] = useState('');
  // The people at this table first, then everyone else who has ever saved a profile.
  const rank = (p: Profile) => (first.includes(p.id) ? 0 : 1);
  const list = [...profiles].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  return (
    <div className="join join--ask">
      <div className="eyebrow">{eyebrow}</div>
      <h1>Who are you?</h1>
      {list.length > 0 && (
        <div className="who-list">
          {list.map((p) => (
            <button key={p.id} type="button" className="btn who-list__item" data-here={rank(p) === 0 || undefined} style={{ '--pc': colorById(p.color).led } as CSSProperties} onClick={() => onPick(p.id)}>
              <i /> {p.name}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onCreate(name.trim()); }}>
        <p className="muted">{list.length ? 'Not on the list?' : 'Nobody here yet. Be the first.'}</p>
        <input className="input join__name" value={name} maxLength={14} placeholder="Your name" onChange={(e) => setName(e.target.value)} aria-label="Your name" />
        <button type="submit" className="btn btn--gold" disabled={!name.trim()}>That's me</button>
      </form>
      {onSkip && <button type="button" className="btn btn--sm btn--ghost" onClick={onSkip}>Skip: just be a button</button>}
    </div>
  );
}

/** The cog: how this player's own light behaves. Saved with their profile, so it follows them to the next game. */
export function LightSheet({ me, tableLook, tableFx, onEdit, onPreview, onClose }: {
  me: Pick<Profile, 'light' | 'brightness' | 'turnFx'>;
  tableLook: TurnLook;
  tableFx: TurnEffect;
  onEdit(patch: { light?: TurnLook; brightness?: number; turnFx?: TurnEffect }): void;
  /** Show an effect on my light now. */
  onPreview(fx: TurnEffect): void;
  onClose(): void;
}) {
  const bright = clampBrightness(me.brightness);
  const fx = me.turnFx ?? tableFx;
  // While an effect plays, the sheet gets out of the way so the light behind it can be seen.
  const [peek, setPeek] = useState(0);
  useEffect(() => {
    if (!peek) return;
    const t = window.setTimeout(() => setPeek(0), 1300);
    return () => window.clearTimeout(t);
  }, [peek]);
  const preview = (which: TurnEffect) => {
    onPreview(which);
    setPeek((n) => n + 1);
  };
  return (
    <div className="sheet" role="dialog" aria-label="Your light" data-peek={peek || undefined}>
      <div className="sheet__card panel">
        <div className="sheet__head">
          <span className="eyebrow">Your light</span>
          <button type="button" className="tour__close" aria-label="Close" onClick={onClose}><IconClose /></button>
        </div>
        <div className="field" role="radiogroup" aria-label="When it's your move">
          <span>When it's your move</span>
          <div className="looks">
            <button type="button" role="radio" aria-checked={!me.light} title="Whatever the host picked for the table" onClick={() => onEdit({ light: undefined })}>Table's</button>
            {TURN_LOOKS.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={me.light === l.id} title={l.hint} onClick={() => onEdit({ light: l.id })}>{l.name}</button>
            ))}
          </div>
          <small className="muted">{me.light ? TURN_LOOKS.find((l) => l.id === me.light)!.hint : `The table's choice right now: ${TURN_LOOKS.find((l) => l.id === tableLook)!.name.toLowerCase()}`}</small>
        </div>
        <div className="field" role="radiogroup" aria-label="When your turn starts">
          <span>When your turn starts</span>
          <div className="looks looks--wrap">
            <button type="button" role="radio" aria-checked={!me.turnFx} title="Whatever the host picked for the table" onClick={() => { onEdit({ turnFx: undefined }); preview(tableFx); }}>Table's</button>
            {TURN_EFFECTS.map((e) => (
              <button key={e.id} type="button" role="radio" aria-checked={me.turnFx === e.id} title={e.hint} onClick={() => { onEdit({ turnFx: e.id }); preview(e.id); }}>{e.name}</button>
            ))}
          </div>
          <div className="sheet__row">
            <small className="muted">{me.turnFx ? TURN_EFFECTS.find((e) => e.id === me.turnFx)!.hint : `The table's choice right now: ${TURN_EFFECTS.find((e) => e.id === tableFx)!.name.toLowerCase()}`}</small>
            <button type="button" className="btn btn--sm" title="Play it on your light now, and on the table" onClick={() => preview(fx)}><IconPlay /> Preview</button>
          </div>
        </div>
        <label className="field">
          <span>Brightness <b className="mono-num">{Math.round(bright * 100)}%</b></span>
          <input type="range" min={0.1} max={1} step={0.05} value={bright} onChange={(e) => onEdit({ brightness: +e.target.value })} />
          <small className="muted">Your real button, if you have one. Your phone stays as it is.</small>
        </label>
        <div className="sheet__foot">
          <span />
          <button type="button" className="btn btn--gold" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

let preview: Playing | null = null;

export function ProfileSheet({ me, oops, onEdit, onClip, onSwitch, onClose, extra }: {
  me: Pick<Profile, 'id' | 'name' | 'color' | 'intro' | 'outro'>;
  oops: string | null;
  /** More to show under the sounds (the profile page lists the player's buttons here). */
  extra?: React.ReactNode;
  onEdit(patch: { name?: string; color?: string; intro?: SoundRef; outro?: SoundRef }): void;
  onClip(slot: 'intro' | 'outro', file: File): void;
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
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (!f.type.startsWith('audio/')) return setError('That is not an audio file.');
            if (f.size > MAX_CLIP_TRANSFER) return setError('Keep clips under 4 MB. Trim it to the good part.');
            setError(null);
            onClip(which, f);
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
        {extra}
        <div className="sheet__foot">
          <button type="button" className="btn btn--sm btn--ghost" onClick={onSwitch}>Not {me.name}? Switch player</button>
          <button type="button" className="btn btn--gold" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
