import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ButtonRender, CrossSection, ExplodedView, SizeChart } from '../components/ButtonArt';
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
          <Link to="/hardware">Build guide</Link>
          <Link to="/standard">Button standard</Link>
          <Link to="/demo" className="btn btn--sm btn--gold">Live demo</Link>
        </div>
      </nav>

      <header className="concept__hero">
        <div className="concept__copy">
          <div className="eyebrow">Concept · nothing here is built yet</div>
          <h1>Meet the button</h1>
          <p>One per player. A frosted dome about the width of a bank card, lit from inside in your colour, with a speaker for your entrance music. Press the whole dome: tap, double-tap, or hold.</p>
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
          <h2>Six layers, all off the shelf</h2>
          <p>Every electronic part is a hobby-shop module. The shell is the only thing that has to be designed, and it's printable. Full parts list and wiring are in the <Link to="/hardware">build guide</Link>.</p>
        </div>
        <div className="panel concept__sheet lit" data-mode="solid"><ExplodedView /></div>
      </section>

      <section className="section concept__two">
        <article className="panel concept__card lit" data-mode="solid">
          <div className="eyebrow">Size</div>
          <h3>Small on purpose</h3>
          <p>Six players, a galaxy and a lot of plastic ships: table space is scarce. The target is 88 mm across, set by the smallest sensible 4 × AA holder.</p>
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
