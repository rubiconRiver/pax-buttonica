import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ButtonRender, CrossSection, ExplodedView, InsideView, SizeChart } from '../components/ButtonArt';
import { IconArrow } from '../components/Icons';
import { MiniTable } from '../components/MiniTable';
import { PLAYER_COLORS, STRATEGY_CARDS } from '../engine/data';
import type { LedMode } from '../engine/outputs';
import '../styles/device.css';
import '../styles/landing.css';
import '../styles/setup.css';
import '../styles/concept.css';

const STATES: { mode: LedMode; color?: string; title: string; text: string }[] = [
  { mode: 'pulse', title: 'Breathing', text: 'Your move.' },
  { mode: 'flash', color: STRATEGY_CARDS[4].color, title: 'Slow blink', text: 'A strategy card needs you. Tap when done.' },
  { mode: 'dim', title: 'Glowing', text: "Not your turn. You're still in the round." },
  { mode: 'off', title: 'Dark', text: "You've passed." },
  { mode: 'rainbow', title: 'Rainbow', text: 'You won. Be gracious.' },
];

export function ButtonConcept() {
  const [color, setColor] = useState(PLAYER_COLORS[4].led);
  const [mode, setMode] = useState<LedMode>('pulse');

  return (
    <div className="landing concept" style={{ '--led': color } as CSSProperties}>
      <nav className="nav">
        <Link to="/" className="brand"><span className="brand__dot" /><span>Pax <b>Buttonica</b></span></Link>
        <div className="nav__links">
          <Link to="/parts">Parts list</Link>
          <Link to="/hardware">Build guide</Link>
          <Link to="/standard">Button standard</Link>
          <Link to="/demo" className="btn btn--sm btn--gold">Live demo</Link>
        </div>
      </nav>

      <header className="concept__hero">
        <div className="concept__copy">
          <div className="eyebrow">Concept · nothing here is built yet</div>
          <h1>Meet the button</h1>
          <p>One per player. A frosted dome about the width of a bank card, lit from inside in your colour. No screen, no speaker: your entrance music plays from the big screen. Press the whole dome: tap, double-tap, or hold.</p>
          <div className="concept__pick">
            <span className="opt__label">Your colour</span>
            <div className="swatches">
              {PLAYER_COLORS.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={color === c.led} aria-label={c.name} className="swatch" style={{ '--sw': c.led } as CSSProperties} onClick={() => setColor(c.led)} />
              ))}
            </div>
          </div>
          <div className="concept__pick">
            <span className="opt__label">Light</span>
            <div className="seg">
              {(['pulse', 'flash', 'solid', 'dim', 'off', 'rainbow'] as LedMode[]).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{m === 'flash' ? 'blink' : m === 'pulse' ? 'breathe' : m}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="lit concept__render" data-mode={mode}><ButtonRender /></div>
      </header>

      <section className="section">
        <div className="section__head">
          <div className="eyebrow">What's inside</div>
          <h2>Six layers, three of them electronic</h2>
          <p>A radio board, a ring of LEDs and a switch: every electronic part is a hobby-shop module, and the whole circuit is seven wires. The shell is the only thing that has to be designed, and it's printable. Full parts list and wiring are in the <Link to="/hardware">build guide</Link>.</p>
        </div>
        <div className="panel concept__sheet lit" data-mode="solid"><ExplodedView /></div>
      </section>

      <section className="section">
        <div className="section__head">
          <div className="eyebrow">Built by hand</div>
          <h2>What you'll actually end up with</h2>
          <p>A printed puck with a glowing dome, and nothing sticking out of it. Inside there are five short wires, not a nest: the ESP32, the microswitch, the diode and the capacitor are all soldered to one small piece of perfboard, so most connections are solder on the underside of that board. Three wires go up to the LED ring, two go down to the battery box, and the battery box is the floor of the button, with its own switch and door.</p>
        </div>
        <div className="panel concept__sheet lit" data-mode="solid"><InsideView /></div>
        <div className="concept__honest">
          <article className="panel concept__card">
            <h3>The work</h3>
            <p>About sixteen solder joints a button, around a hundred for six. Budget two hours for the first one and half an hour each after that. None of it is fine-pitch: the smallest thing you solder to is a 2.5 mm pad.</p>
          </article>
          <article className="panel concept__card">
            <h3>The look</h3>
            <p>A good hobby build, not a shop product: you'll see print layer lines up close, and the dome shows a soft ring of light rather than a perfectly even glow unless the LEDs sit well below it. Lit, in a dim room, across a table, it looks the part.</p>
          </article>
          <article className="panel concept__card">
            <h3>What makes it messy</h3>
            <p>Pin headers and push-on jumper leads: bulky, and they work loose when the button gets slapped. Solder wires straight to the pads, cut them to length, sleeve loose joints in heat-shrink, and hold the board down with two screws or a dab of hot glue.</p>
          </article>
        </div>
      </section>

      <section className="section concept__two">
        <article className="panel concept__card lit" data-mode="solid">
          <div className="eyebrow">Size</div>
          <h3>Small on purpose</h3>
          <p>Six players, a galaxy and a lot of plastic ships: table space is scarce. The target is 88 mm across with an open battery tray, or about 105 mm if you use the battery box with its own switch and lid, which is less to design and build.</p>
          <SizeChart />
        </article>
        <article className="panel concept__card lit" data-mode="solid">
          <div className="eyebrow">For whoever models the shell</div>
          <h3>Target envelope</h3>
          <p>These are targets, not a finished design. The dome needs 3–4 mm of travel and a satisfying stop; the LED ring wants 15 mm or more of air below the dome.</p>
          <CrossSection />
        </article>
      </section>

      <section className="section">
        <div className="section__head">
          <div className="eyebrow">Reading the table</div>
          <h2>What the light means</h2>
        </div>
        <div className="concept__states">
          {STATES.map((s) => (
            <article key={s.title} className="panel concept__state lit" data-mode={s.mode} style={s.color ? ({ '--led': s.color } as CSSProperties) : undefined}>
              <ButtonRender />
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section concept__two">
        <article className="panel concept__card lit" data-mode="pulse">
          <div className="eyebrow">Standard</div>
          <h3>One button</h3>
          <p>Tap: done. Double-tap: my strategy card. Hold two seconds: end my turn, while a white arc fills round the ring.</p>
          <ButtonRender />
        </article>
        <article className="panel concept__card lit" data-mode="pulse">
          <div className="eyebrow">Optional</div>
          <h3>Three buttons</h3>
          <p>Two small shortcuts on the rim for strategy card and pass. The app adapts to whatever a button says it has, so build what you like.</p>
          <ButtonRender aux />
        </article>
      </section>

      <section className="section">
        <div className="section__head">
          <div className="eyebrow">On the table</div>
          <h2>Six of them, mid-game</h2>
          <p>Everyone's home system, everyone's button. This is the simulator playing itself; the real thing runs the same rules.</p>
        </div>
        <MiniTable />
        <div className="section__cta">
          <Link to="/demo" className="btn btn--gold btn--lg">Try the simulator <IconArrow /></Link>
        </div>
      </section>

      <footer className="footer">
        <p>Concept drawings for an unofficial fan project. Not affiliated with, endorsed by, or sponsored by Fantasy Flight Games or Asmodee.</p>
      </footer>
    </div>
  );
}
