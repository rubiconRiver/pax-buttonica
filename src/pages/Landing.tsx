import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { JINGLES } from '../audio/jingles';
import { playNotes } from '../audio/synth';
import { Device } from '../components/Device';
import { IconArrow } from '../components/Icons';
import { MiniTable } from '../components/MiniTable';
import { PLAYER_COLORS, STRATEGY_CARDS } from '../engine/data';
import type { LedMode } from '../engine/outputs';
import { useStore } from '../state/createStore';
import { liveGame } from '../state/game';
import '../styles/landing.css';

const INTROS = JINGLES.filter((j) => j.vibe === 'intro');
const OUTROS = JINGLES.filter((j) => j.vibe === 'outro');

function HeroButton() {
  const [i, setI] = useState(0);
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null);
  const color = PLAYER_COLORS[i % 7].led;

  return (
    <div className="hero__button" style={{ '--pc': color } as CSSProperties}>
      <Device
        color={color}
        mode="pulse"
        size={300}
        label="Try the button"
        onInput={(input) => {
          if (input === 'tap') {
            const j = INTROS[(i + 1) % INTROS.length];
            playNotes(j.notes, j.wave);
            setI((n) => n + 1);
            setMsg({ id: Date.now(), text: 'Tap — "I\'m done"' });
          } else if (input === 'double') {
            setMsg({ id: Date.now(), text: 'Double-tap — strategy card!' });
          } else if (input === 'hold') {
            const j = OUTROS[i % OUTROS.length];
            window.setTimeout(() => playNotes(j.notes, j.wave), 260);
            setMsg({ id: Date.now(), text: 'Held — turn ended' });
          }
        }}
      />
      <div className="hero__msg" key={msg?.id ?? 0} data-idle={!msg || undefined}>
        {msg?.text ?? 'Go on. Tap it, double-tap it, hold it for two seconds.'}
      </div>
    </div>
  );
}

const LIGHTS: { mode: LedMode; color: string; title: string; text: string }[] = [
  { mode: 'pulse', color: '#2f8cff', title: 'Breathing', text: "It's your move. Your turn, your pick, your vote. Everyone at the table can see it, including you, mid-sandwich." },
  { mode: 'flash', color: STRATEGY_CARDS[4].color, title: 'Blinking', text: "A strategy card is out. Yours? Do the primary, then tap. Someone else's? Do the secondary or don't — then tap. Their turn can't end until every button has answered." },
  { mode: 'dim', color: '#a24bff', title: 'Glowing', text: 'Your colour, quietly. Not your turn. Go back to plotting.' },
  { mode: 'off', color: '#ff3b3b', title: 'Dark', text: "You've passed. The turn order skips you until next round." },
];

const ROLES = [
  { title: 'Shell & dome', text: 'A printable housing with a translucent dome, a satisfying plunger and room for four AAs. Make it feel expensive to press.' },
  { title: 'Firmware', text: 'ESP32 + ESP-NOW. Six light modes, two gestures, a note-list player and a polling loop that sips battery. The standard is short on purpose.' },
  { title: 'Web app', text: 'React + TypeScript. The rules engine is a pure function with tests; the simulator is the reference implementation for the hardware.' },
  { title: 'Playtesting', text: "Eight hours, six players, one table. Tell us where it's annoying. That's the whole job. Snacks are involved." },
];

export function Landing() {
  const { game } = useStore(liveGame);
  return (
    <div className="landing">
      <nav className="nav">
        <Link to="/" className="brand"><span className="brand__dot" /><span>Pax <b>Buttonica</b></span></Link>
        <div className="nav__links">
          <a href="#lights">The lights</a>
          <a href="#wiring">How it's wired</a>
          <Link to="/standard">Button standard</Link>
          <Link to="/hardware">Build guide</Link>
          <Link to="/demo" className="btn btn--sm btn--gold">Live demo</Link>
        </div>
      </nav>

      <header className="hero">
        <div className="hero__copy">
          <div className="eyebrow">A fan-made turn tracker for Twilight Imperium IV</div>
          <h1>
            Whose turn is&nbsp;it?
            <span>Ask the button.</span>
          </h1>
          <p>
            One big glowing button in front of every player. It lights up when it's your turn, plays your entrance music, and flashes at the whole table when someone flips a strategy card — so nobody's secondary gets skipped, and nobody has to ask.
          </p>
          <div className="hero__cta">
            <Link to="/demo" className="btn btn--gold btn--lg">Play with the demo <IconArrow /></Link>
            <Link to="/play" className="btn btn--lg">{game ? 'Resume your game' : 'Start a real game'}</Link>
          </div>
          <p className="hero__note">No hardware yet — the buttons on this site are simulated: same lights, same gestures, same rules. No button at all? Any phone can be one: open a room and scan the code.</p>
        </div>
        <HeroButton />
      </header>

      <section className="section" id="lights">
        <div className="section__head">
          <div className="eyebrow">The whole interface</div>
          <h2>Four lights and three gestures</h2>
          <p>Tap means <b>"I'm done."</b> Double-tap means <b>"I'm playing my strategy card."</b> Hold for two seconds means <b>"end my turn."</b> That's the manual.</p>
        </div>
        <div className="lights">
          {LIGHTS.map((l) => (
            <article key={l.title} className="light panel" style={{ '--pc': l.color } as CSSProperties}>
              <Device color={l.color} mode={l.mode} size={104} />
              <h3>{l.title}</h3>
              <p>{l.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <div className="eyebrow">Watch a turn</div>
          <h2>The rule that started this</h2>
          <p>When a strategy card comes out, the active player is locked in until every other button has been hit. Here it is on a loop.</p>
        </div>
        <MiniTable />
        <div className="section__cta">
          <Link to="/demo" className="btn btn--gold btn--lg">Now you drive <IconArrow /></Link>
        </div>
      </section>

      <section className="section" id="wiring">
        <div className="section__head">
          <div className="eyebrow">How it's wired</div>
          <h2>Dumb buttons, smart laptop</h2>
          <p>The buttons know nothing about Twilight Imperium. They show the colour they're told to show and report when they're pressed. Every rule lives in this web app — so changing a rule never means reflashing a button.</p>
        </div>
        <div className="wiring">
          <div className="node panel">
            <div className="node__art node__art--buttons">
              {['#ffd21f', '#ff3b3b', '#2f8cff'].map((c, k) => <Device key={c} color={c} mode={k === 0 ? 'pulse' : 'dim'} size={54} />)}
            </div>
            <h3>Buttons</h3>
            <p>An ESP32, a ring of LEDs, a speaker, four AAs. One per player.</p>
          </div>
          <div className="link"><span>ESP-NOW</span><i /><small>direct radio, no router</small></div>
          <div className="node panel">
            <div className="node__art"><div className="chipart" /></div>
            <h3>Hub</h3>
            <p>One more ESP32 on a USB cable. A relay, nothing else.</p>
          </div>
          <div className="link"><span>USB</span><i /><small>Web Serial</small></div>
          <div className="node panel">
            <div className="node__art"><div className="laptop"><b /></div></div>
            <h3>This site</h3>
            <p>Runs the game in your browser. Works with the Wi-Fi off.</p>
          </div>
        </div>
      </section>

      <section className="section split">
        <article className="panel panel--ticks feature">
          <div className="eyebrow">Profiles</div>
          <h2>Bring your own entrance music</h2>
          <p>Every player picks an <b>entrance</b> — played when their turn begins — and an <b>exit</b>, played when they hold the button down to end it. Choose a built-in jingle or upload eight seconds of whatever you think is funny. Profiles remember your colour, your faction and your sounds.</p>
          <Link to="/play" className="btn">Set up a table</Link>
        </article>
        <article className="panel panel--ticks feature">
          <div className="eyebrow">Open standard</div>
          <h2>Build your own button</h2>
          <p>One button and one light is a complete device. Want dedicated <b>strategy</b> and <b>pass</b> buttons? Add them — the app adapts to whatever your device says it has. The spec is a single page and the simulator is the reference implementation.</p>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/standard" className="btn">Read the standard</Link>
            <Link to="/hardware" className="btn btn--ghost">Parts &amp; wiring</Link>
          </span>
        </article>
      </section>

      <section className="section" id="help">
        <div className="section__head">
          <div className="eyebrow">Help wanted</div>
          <h2>This is a group project</h2>
          <p>The software is playable today, with phones standing in for buttons. The firmware compiles. The hardware is a parts list, a wiring table and a plan. If any of this sounds like your kind of weekend:</p>
        </div>
        <div className="roles">
          {ROLES.map((r, k) => (
            <article key={r.title} className="role panel">
              <span className="role__n mono-num">0{k + 1}</span>
              <h3>{r.title}</h3>
              <p>{r.text}</p>
            </article>
          ))}
        </div>
        <p className="help__cta">Interested? Tell whoever sent you this link.</p>
      </section>

      <footer className="footer">
        <p>Pax Buttonica is an unofficial fan project. It is not affiliated with, endorsed by, or sponsored by Fantasy Flight Games or Asmodee. Twilight Imperium is a trademark of its respective owner.</p>
      </footer>
    </div>
  );
}
