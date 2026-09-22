import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { sfx, unlockAudio } from '../audio/synth';
import { Device } from '../components/Device';
import { IconArrow, IconClose } from '../components/Icons';
import { SoundPicker } from '../components/SoundPicker';
import { FACTION_GROUPS, PLAYER_COLORS, colorById } from '../engine/data';
import { cardsPerPlayer } from '../engine/engine';
import type { GameOptions, PlayerSetup } from '../engine/types';
import { useStore } from '../state/createStore';
import { createProfile, deleteProfile, patchProfile, profilesStore } from '../state/profiles';
import { syncStatus } from '../state/profileSync';
import { listMyGames, pickUpGame, type SavedGameSummary } from '../remote/sync';
import { CODE_LENGTH, cleanCode } from '../engine/engine';
import '../styles/setup.css';

const ALL_FACTIONS = FACTION_GROUPS.flatMap((g) => g.factions);
const INTROS = ['herald', 'war-drums', 'warp-in', 'council-bell', 'glitch', 'trade-wind'];
const OUTROS = ['stand-down', 'mic-drop', 'warp-out', 'sealed', 'over-to-you', 'stand-down'];

const blank = (i: number, taken: string[]): PlayerSetup => ({
  name: '',
  faction: ALL_FACTIONS[(i * 5) % ALL_FACTIONS.length],
  color: PLAYER_COLORS.find((c) => !taken.includes(c.id))?.id ?? PLAYER_COLORS[i % 8].id,
  intro: { kind: 'jingle', id: INTROS[i % INTROS.length] },
  outro: { kind: 'jingle', id: OUTROS[i % OUTROS.length] },
  buttons: 1,
});

function initialSeats(n: number): PlayerSetup[] {
  const seats: PlayerSetup[] = [];
  for (let i = 0; i < n; i++) seats.push(blank(i, seats.map((s) => s.color)));
  return seats;
}

export function Setup({ onStart }: { onStart(players: PlayerSetup[], options: GameOptions): void }) {
  const profiles = useStore(profilesStore);
  const sync = useStore(syncStatus);
  const [seats, setSeats] = useState<PlayerSetup[]>(() => initialSeats(6));
  const [vpTarget, setVpTarget] = useState(10);
  const [speaker, setSpeaker] = useState<number | 'random'>('random');
  const [open, setOpen] = useState(0);

  // A seat linked to a profile edits that profile directly, so the player's phone and this screen never disagree.
  const patch = (i: number, p: Partial<PlayerSetup>) => {
    const linked = seats[i].profileId;
    if (linked && !('profileId' in p)) patchProfile(linked, p);
    setSeats((list) => list.map((s, k) => (k === i ? { ...s, ...p } : s)));
  };

  // A game this browser saved to the site (its own data may have been cleared), or one to fetch from another laptop.
  const [saved, setSaved] = useState<SavedGameSummary | null>(null);
  const [pickup, setPickup] = useState('');
  const [pickupNote, setPickupNote] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void listMyGames().then((games) => live && games[0] && games[0].phase !== 'finished' && setSaved(games[0]));
    return () => {
      live = false;
    };
  }, []);
  const pickUp = async (code: string) => {
    setPickupNote('Looking…');
    if (await pickUpGame(code)) return; // the game store now has it; Play takes over
    setPickupNote('No game with that code.');
  };

  // ...and the other direction: a player changing their sounds from their phone shows up here.
  useEffect(() => {
    setSeats((list) =>
      list.map((s, i) => {
        if (!s.profileId) return s;
        const saved = profiles.find((p) => p.id === s.profileId);
        if (!saved) return { ...s, profileId: undefined };
        const colorFree = !list.some((o, k) => k !== i && o.color === saved.color);
        return { ...s, name: saved.name, intro: saved.intro, outro: saved.outro, color: colorFree ? saved.color : s.color };
      }),
    );
  }, [profiles]);
  const setCount = (n: number) => {
    sfx.click();
    setSeats((list) => {
      const next = list.slice(0, n);
      while (next.length < n) next.push(blank(next.length, next.map((s) => s.color)));
      return next;
    });
    setSpeaker((s) => (s !== 'random' && s >= n ? 'random' : s));
    setOpen((o) => Math.min(o, n - 1));
  };

  const problems = useMemo(() => {
    const out: string[] = [];
    if (seats.some((s) => !s.name.trim())) out.push('Everyone needs a name');
    const factions = seats.map((s) => s.faction);
    if (new Set(factions).size !== factions.length) out.push('Two players share a faction');
    const names = seats.map((s) => s.name.trim().toLowerCase()).filter(Boolean);
    if (new Set(names).size !== names.length) out.push('Two players share a name');
    return out;
  }, [seats]);

  const start = () => {
    unlockAudio();
    const sp = speaker === 'random' ? Math.floor(Math.random() * seats.length) : speaker;
    // Everyone at the table gets a profile, so they can claim it and change their sounds from their phone mid-game.
    const players = seats.map((s) => {
      const { profileId: _linked, ...fields } = { ...s, name: s.name.trim() };
      const existing = profiles.find((p) => p.id === s.profileId) ?? profiles.find((p) => p.name.toLowerCase() === fields.name.toLowerCase());
      if (existing) patchProfile(existing.id, fields);
      return { ...fields, profileId: (existing ?? createProfile(fields.name, fields)).id };
    });
    onStart(players, { vpTarget, speaker: sp });
  };

  return (
    <div className="setup">
      <header className="setup__head">
        <Link to="/" className="brand"><span className="brand__dot" /><span>Pax <b>Buttonica</b></span></Link>
        <span style={{ display: 'flex', gap: 8 }}>
          <Link to="/me" className="btn btn--sm btn--ghost">Set up your own profile</Link>
          <Link to="/demo" className="btn btn--sm btn--ghost">Try the demo instead</Link>
        </span>
      </header>

      <div className="setup__intro">
        <div className="eyebrow">New game</div>
        <h1>Who's at the table?</h1>
        <p className="muted">Pick a saved player for each seat, or type a new name. Players can set up their own name and sounds at <b>/me</b> on their phones, now or mid-game. Once the game begins, its code is in the top bar: phones join with it. Seat players clockwise, the way you're actually sitting. Next, everyone claims a button. Until real ones exist, the number keys <kbd>1</kbd>–<kbd>8</kbd> press the on-screen ones.</p>
      </div>

      <div className="setup__saved panel" data-has={saved ? '' : undefined}>
        {saved ? (
          <>
            <span>
              <b>A game is saved on the site:</b> {saved.code} · {saved.players.join(', ')} · round {saved.round} · saved {new Date(saved.updatedAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
            </span>
            <button type="button" className="btn btn--sm btn--gold" onClick={() => void pickUp(saved.code)}>Resume it</button>
          </>
        ) : (
          <span className="muted">Playing on a different laptop than last time? Pick the game up with its code.</span>
        )}
        <form className="setup__pickup" onSubmit={(e) => { e.preventDefault(); if (pickup.length === CODE_LENGTH) void pickUp(pickup); }}>
          <input className="input" value={pickup} onChange={(e) => setPickup(cleanCode(e.target.value))} placeholder="Code" aria-label="Code of a game on another laptop" autoCapitalize="characters" autoComplete="off" spellCheck={false} />
          <button type="submit" className="btn btn--sm" disabled={pickup.length !== CODE_LENGTH}>Pick up</button>
          {pickupNote && <span className="muted">{pickupNote}</span>}
        </form>
      </div>

      <div className="setup__options panel">
        <div className="opt">
          <span className="opt__label">Players</span>
          <div className="seg">
            {[3, 4, 5, 6, 7, 8].map((n) => (
              <button key={n} type="button" aria-pressed={seats.length === n} onClick={() => setCount(n)}>{n}</button>
            ))}
          </div>
          <span className="opt__note">{cardsPerPlayer(seats.length)} strategy card{cardsPerPlayer(seats.length) > 1 ? 's' : ''} each</span>
        </div>
        <div className="opt">
          <span className="opt__label">Victory points</span>
          <div className="seg">
            {[10, 12, 14].map((n) => (
              <button key={n} type="button" aria-pressed={vpTarget === n} onClick={() => { sfx.click(); setVpTarget(n); }}>{n}</button>
            ))}
          </div>
        </div>
        <div className="opt">
          <span className="opt__label">First speaker</span>
          <select className="select" value={String(speaker)} onChange={(e) => setSpeaker(e.target.value === 'random' ? 'random' : +e.target.value)}>
            <option value="random">Random</option>
            {seats.map((s, i) => <option key={i} value={i}>{s.name.trim() || `Seat ${i + 1}`}</option>)}
          </select>
        </div>
      </div>

      <div className="seats">
        {seats.map((s, i) => {
          const led = colorById(s.color).led;
          const taken = seats.filter((_, k) => k !== i).map((x) => x.color);
          const isOpen = open === i;
          return (
            <section key={i} className="seatcard panel" data-open={isOpen || undefined} style={{ '--pc': led } as CSSProperties}>
              <div className="seatcard__top">
                <Device color={led} mode={isOpen ? 'pulse' : 'dim'} size={64} />
                <div className="seatcard__id">
                  <span className="seatcard__n">Seat {i + 1}</span>
                  <input
                    className="input seatcard__name"
                    placeholder="Name"
                    value={s.name}
                    maxLength={14}
                    onFocus={() => setOpen(i)}
                    onChange={(e) => patch(i, { name: e.target.value })}
                  />
                </div>
                {profiles.length > 0 && (
                  <select
                    className="select seatcard__profile"
                    value={s.profileId ?? ''}
                    aria-label="Who is sitting here?"
                    onChange={(e) => {
                      const p = profiles.find((x) => x.id === e.target.value);
                      sfx.pick();
                      if (!p) return patch(i, { profileId: undefined, name: '' });
                      const { id, updatedAt: _synced, ...rest } = p;
                      setSeats((list) => list.map((seat, k) => (k === i ? { ...rest, profileId: id, color: taken.includes(rest.color) ? seat.color : rest.color } : seat)));
                    }}
                  >
                    <option value="">New player</option>
                    {profiles
                      .filter((p) => p.id === s.profileId || !seats.some((o) => o.profileId === p.id))
                      .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => { sfx.click(); setOpen(isOpen ? -1 : i); }}>{isOpen ? 'Done' : 'Edit'}</button>
              </div>

              <div className="swatches" role="radiogroup" aria-label="Colour">
                {PLAYER_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={s.color === c.id}
                    aria-label={c.name}
                    title={taken.includes(c.id) ? `${c.name} is taken` : c.name}
                    disabled={taken.includes(c.id)}
                    className="swatch"
                    style={{ '--sw': c.led } as CSSProperties}
                    onClick={() => { sfx.tick(); patch(i, { color: c.id }); }}
                  />
                ))}
              </div>

              {isOpen && (
                <div className="seatcard__more">
                  <label className="field">
                    <span>Faction</span>
                    <select className="select" value={s.faction} onChange={(e) => patch(i, { faction: e.target.value })}>
                      {FACTION_GROUPS.map((g) => (
                        <optgroup key={g.label} label={g.label}>
                          {g.factions.map((f) => <option key={f}>{f}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <SoundPicker label="Entrance — plays when your turn starts" value={s.intro} onChange={(intro) => patch(i, { intro })} />
                  <SoundPicker label="Exit — plays when you end your turn" value={s.outro} onChange={(outro) => patch(i, { outro })} />
                  <div className="field">
                    <span>Their device</span>
                    <div className="seg seg--wide">
                      <button type="button" aria-pressed={s.buttons === 1} onClick={() => { sfx.click(); patch(i, { buttons: 1 }); }}>One big button</button>
                      <button type="button" aria-pressed={s.buttons === 3} onClick={() => { sfx.click(); patch(i, { buttons: 3 }); }}>+ strategy &amp; pass</button>
                    </div>
                  </div>
                  {s.profileId && (
                    <div className="seatcard__save">
                      <span className="muted" style={{ fontSize: 12.5, marginRight: 'auto' }}>Saved player: changes here are kept.</span>
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost btn--danger"
                        title="Delete this saved player"
                        onClick={() => s.profileId && deleteProfile(s.profileId)}
                      >
                        <IconClose /> Forget
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <footer className="setup__foot">
        <span className="setup__sync" data-state={sync} title="Saved players are kept in the site's database and mirrored in this browser">
          {sync === 'synced' ? `${profiles.length} saved player${profiles.length === 1 ? '' : 's'} · synced` : sync === 'offline' ? 'Offline: using the players saved in this browser' : 'Loading saved players…'}
        </span>
        <span className="setup__problems">{problems.join(' · ')}</span>
        <button type="button" className="btn btn--gold btn--lg" disabled={problems.length > 0} onClick={start}>
          Begin round one <IconArrow />
        </button>
      </footer>
    </div>
  );
}
