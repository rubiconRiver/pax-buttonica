import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { sfx, unlockAudio } from '../audio/synth';
import { Device } from '../components/Device';
import { IconArrow, IconClose } from '../components/Icons';
import { SoundPicker } from '../components/SoundPicker';
import { FACTION_GROUPS, PLAYER_COLORS, colorById } from '../engine/data';
import { cardsPerPlayer } from '../engine/engine';
import type { GameOptions, PlayerSetup } from '../engine/types';
import { useStore } from '../state/createStore';
import { deleteProfile, profilesStore, saveProfile } from '../state/profiles';
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
  const [seats, setSeats] = useState<PlayerSetup[]>(() => initialSeats(6));
  const [vpTarget, setVpTarget] = useState(10);
  const [speaker, setSpeaker] = useState<number | 'random'>('random');
  const [open, setOpen] = useState(0);

  const patch = (i: number, p: Partial<PlayerSetup>) => setSeats((list) => list.map((s, k) => (k === i ? { ...s, ...p } : s)));
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
    return out;
  }, [seats]);

  const start = () => {
    unlockAudio();
    const sp = speaker === 'random' ? Math.floor(Math.random() * seats.length) : speaker;
    onStart(seats.map((s) => ({ ...s, name: s.name.trim() })), { vpTarget, speaker: sp });
  };

  return (
    <div className="setup">
      <header className="setup__head">
        <Link to="/" className="brand"><span className="brand__dot" /><span>Pax <b>Buttonica</b></span></Link>
        <Link to="/demo" className="btn btn--sm btn--ghost">Try the demo instead</Link>
      </header>

      <div className="setup__intro">
        <div className="eyebrow">New game</div>
        <h1>Who's at the table?</h1>
        <p className="muted">Seat players clockwise, the way you're actually sitting. Next, everyone claims a button. Until real ones exist, the number keys <kbd>1</kbd>–<kbd>8</kbd> press the on-screen ones.</p>
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
                    value=""
                    aria-label="Load a saved profile"
                    onChange={(e) => {
                      const p = profiles.find((x) => x.id === e.target.value);
                      if (!p) return;
                      const { id: _id, ...rest } = p;
                      patch(i, { ...rest, color: taken.includes(rest.color) ? s.color : rest.color });
                      sfx.pick();
                    }}
                  >
                    <option value="">Load profile…</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                  <div className="seatcard__save">
                    <button type="button" className="btn btn--sm" disabled={!s.name.trim()} onClick={() => { saveProfile(s); sfx.ack(); }}>Save as profile</button>
                    {profiles.some((p) => p.name.toLowerCase() === s.name.trim().toLowerCase()) && (
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost btn--danger"
                        title="Delete the saved profile with this name"
                        onClick={() => {
                          const p = profiles.find((x) => x.name.toLowerCase() === s.name.trim().toLowerCase());
                          if (p) deleteProfile(p.id);
                        }}
                      >
                        <IconClose /> Forget profile
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <footer className="setup__foot">
        <span className="setup__problems">{problems.join(' · ')}</span>
        <button type="button" className="btn btn--gold btn--lg" disabled={problems.length > 0} onClick={start}>
          Begin round one <IconArrow />
        </button>
      </footer>
    </div>
  );
}
