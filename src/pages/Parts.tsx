import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { sfx } from '../audio/synth';
import { IconArrow, IconCheck } from '../components/Icons';
import '../styles/landing.css';
import '../styles/setup.css';
import '../styles/parts.css';

/** Prices and stock were checked by hand on this date; they will drift. */
const CHECKED = 'September 20, 2026';

interface Choices {
  buttons: number;
  spares: boolean;
  holder: 'covered' | 'open';
  rings: 'amazon' | 'canadian';
  haveCells: boolean;
  haveCharger: boolean;
  haveWire: boolean;
  haveFilament: boolean;
  resistors: boolean;
  tidy: boolean;
}

const DEFAULTS: Choices = { buttons: 6, spares: true, holder: 'covered', rings: 'amazon', haveCells: false, haveCharger: false, haveWire: false, haveFilament: false, resistors: false, tidy: true };

interface Line {
  id: string;
  name: string;
  /** What it does in the button, in one line. */
  role: string;
  /** The longer story: why it's needed and why this one. */
  explain: ReactNode;
  watch?: ReactNode;
  url: string;
  seller: string;
  unit: string;
  price: number;
  qty: number;
  need: string;
}

const packs = (needed: number, per: number) => Math.max(1, Math.ceil(needed / per));

function lines(c: Choices): Line[] {
  const n = c.buttons;
  const boards = n + 1 + (c.spares ? 1 : 0);
  const rings = n + (c.spares ? 2 : 0);
  const holders = n + (c.spares ? 1 : 0);
  const out: Line[] = [];

  out.push({
    id: 'esp32',
    name: 'ESP32-C3 SuperMini boards',
    role: 'The brain and the radio. One in every button, plus one on a USB cable as the hub.',
    explain: (
      <>
        A thumbnail-sized computer with a 2.4 GHz radio built in. Each button's board watches the switch, drives the lights and talks to the hub over ESP-NOW, a direct board-to-board radio link that needs no Wi-Fi network. The hub is the same board with nothing attached: it plugs into the laptop and relays messages. It has a USB-C port, so flashing firmware needs no extra adapter.
      </>
    ),
    watch: <>Get the plain SuperMini with the antenna on the board. "Plus" versions with a gold antenna jack may need a jumper moved: see the antenna note below.</>,
    url: 'https://www.amazon.ca/dp/B0GQM4SRS3',
    seller: 'Amazon.ca',
    unit: '4-pack',
    price: 28.49,
    qty: packs(boards, 4),
    need: `${n} buttons + 1 hub${c.spares ? ' + 1 spare' : ''} = ${boards} boards`,
  });

  out.push(
    c.rings === 'amazon'
      ? {
          id: 'rings',
          name: 'WS2812B LED ring, 8 LEDs',
          role: 'The light under the dome: any colour, and the white arc that fills while you hold.',
          explain: (
            <>
              Eight full-colour LEDs on a small ring, each with its own tiny controller chip, so the board can set every LED separately over a single data wire. That's what lets the button breathe in a player's colour, blink in a strategy card's colour, and sweep a white arc round the ring during the two-second hold. Three wires: power, ground, data.
            </>
          ),
          watch: <>Set <code>LED_COUNT 8</code> in <code>firmware/button/config.h</code> (it's the default).</>,
          url: 'https://www.amazon.ca/dp/B0BY8ZP214',
          seller: 'Amazon.ca',
          unit: '2-pack',
          price: 14.49,
          qty: packs(rings, 2),
          need: `${n} buttons${c.spares ? ' + 2 spares' : ''} = ${rings} rings`,
        }
      : {
          id: 'rings',
          name: 'WS2812B LED ring, 12 LEDs, 50 mm',
          role: 'The light under the dome: any colour, and the white arc that fills while you hold.',
          explain: (
            <>
              The same idea as the 8-LED ring, from a Canadian shop at a fraction of the price. Twelve LEDs make the hold arc smoother, and 50 mm across sits nicely under a 66 mm dome. 10% off at three or more.
            </>
          ),
          watch: <>Shipping time wasn't confirmed: risky on a tight deadline. Set <code>LED_COUNT 12</code> in <code>config.h</code>.</>,
          url: 'https://www.universal-solder.ca/product/12-led-ring-ws2812b-rgb-addressable-50mm/',
          seller: 'Universal Solder (Canada)',
          unit: 'each',
          price: rings >= 3 ? 2.69 : 2.99,
          qty: rings,
          need: `${n} buttons${c.spares ? ' + 2 spares' : ''} = ${rings} rings`,
        },
  );

  out.push(
    c.holder === 'covered'
      ? {
          id: 'holder',
          name: '4 × AA holder with switch and cover',
          role: 'Holds the batteries, and is also the power switch and the battery door.',
          explain: (
            <>
              A closed box, 70 × 65 × 20 mm, with a sliding on/off switch and a screw-down lid. Because the switch and the door are built in, the printed base doesn't need either, and the holder can simply be the removable bottom of the button. The price is size: the base grows to about 105 mm across.
            </>
          ),
          url: 'https://www.amazon.ca/dp/B0DK2SYS2Y',
          seller: 'Amazon.ca',
          unit: '4-pack',
          price: 12.99,
          qty: packs(holders, 4),
          need: `${n} buttons${c.spares ? ' + 1 spare' : ''} = ${holders} holders`,
        }
      : {
          id: 'holder',
          name: '4 × AA holder, open, with leads',
          role: 'Holds the batteries. Smaller, but you add your own switch and battery door.',
          explain: (
            <>
              An open tray, 57 × 62 × 16 mm, which fits a base of about 92 mm. It has no switch and no lid, so the printed base needs a battery door, and each button needs a small slide switch wired into the positive lead.
            </>
          ),
          watch: <>You'll also need {n} small slide switches, which aren't on this list.</>,
          url: 'https://www.amazon.ca/dp/B07T7MTRZX',
          seller: 'Amazon.ca',
          unit: '2-pack',
          price: 8.87,
          qty: packs(holders, 2),
          need: `${n} buttons${c.spares ? ' + 1 spare' : ''} = ${holders} holders`,
        },
  );

  out.push({
    id: 'switch',
    name: 'KW12 microswitches, straight lever',
    role: 'The click. The dome pushes a plunger down onto this.',
    explain: (
      <>
        A snap-action switch: it clicks crisply at a precise point and springs back, which is most of what makes a button feel good. It has three legs; use the two marked <b>C</b> (common) and <b>NO</b> (normally open), one to the board's GPIO3 and one to ground. No resistor is needed; the board has one built in.
      </>
    ),
    watch: <>Only nine packs were left, and it had no reviews yet. Fallback: <a href="https://www.amazon.ca/dp/B07TKGPMVV" target="_blank" rel="noreferrer">DEVMO KW12-3, 10 pcs, $19.99</a> (it has a roller on the lever; snip it off or leave it).</>,
    url: 'https://www.amazon.ca/dp/B0H49N65GQ',
    seller: 'Amazon.ca',
    unit: '15-pack',
    price: 13.97,
    qty: 1,
    need: `${n} needed, 15 in the pack`,
  });

  out.push({
    id: 'diode',
    name: '1N5817 Schottky diodes',
    role: 'A one-way valve on the battery lead: protection, and a small voltage trim.',
    explain: (
      <>
        Four freshly charged NiMH cells can read 5.6 V, and the LED ring is happiest at 5.3 V or below. This diode drops about 0.3 V, which brings it into range, and it blocks current entirely if the batteries ever go in backwards, which would otherwise kill the board instantly. It goes in the positive lead; the end with the stripe points away from the battery.
      </>
    ),
    url: 'https://www.amazon.ca/dp/B07RJYXVMQ',
    seller: 'Amazon.ca',
    unit: '20 pcs',
    price: 7.99,
    qty: 1,
    need: `${n} needed, 20 in the bag`,
  });

  out.push({
    id: 'cap',
    name: '1000 µF 16 V capacitors',
    role: 'A small reservoir of power right next to the LEDs.',
    explain: (
      <>
        When the ring jumps from dark to full brightness it gulps current faster than batteries on thin wires can deliver, and the voltage dips for an instant. That dip can make the first LED glitch or the board reset. The capacitor sits across the ring's power and ground and covers the gulp. The striped side of the can is negative.
      </>
    ),
    url: 'https://www.amazon.ca/dp/B07FYSD8TD',
    seller: 'Amazon.ca',
    unit: '10 pcs',
    price: 5.99,
    qty: packs(n, 10),
    need: `${n} needed, 10 in the bag`,
  });

  if (c.tidy) {
    out.push({
      id: 'perf',
      name: 'Double-sided perfboard assortment',
      role: 'A small board that the ESP32 and the microswitch are soldered onto: the difference between a tidy build and a nest.',
      explain: (
        <>
          Cut or pick a piece about 4 × 6 cm per button. The microswitch is soldered down in the middle, so it's held rigidly and the press feels the same every time; the ESP32 sits flat beside it; the diode and capacitor go on the board too. Power, ground and the two signal lines become short solder bridges on the underside instead of flying wires. What's left is three wires up to the LED ring and two down to the batteries.
        </>
      ),
      watch: <>Solder wires straight to the ESP32's pads. Skip the pin headers and jumper leads that come with kits: they're bulky and they work loose.</>,
      url: 'https://www.amazon.ca/dp/B072Z7Y19F',
      seller: 'Amazon.ca',
      unit: '32-pc kit',
      price: 17.99,
      qty: 1,
      need: `${n} small boards needed`,
    });
    out.push({
      id: 'shrink',
      name: 'Heat-shrink tubing assortment',
      role: 'Sleeves for every joint that is not on the board.',
      explain: <>Slide a short piece over the wire before soldering, push it over the joint afterwards and warm it with the side of the iron or a lighter. It insulates, it's strain relief, and it's most of what makes hand wiring look deliberate. Essential on the diode if you put it inline in the battery lead.</>,
      url: 'https://www.amazon.ca/dp/B01MFA3OFA',
      seller: 'Amazon.ca',
      unit: 'kit',
      price: 13.99,
      qty: 1,
      need: 'a few centimetres per button',
    });
  }

  if (c.resistors)
    out.push({
      id: 'res',
      name: 'Resistor assortment (for 330 Ω)',
      role: 'Optional: one resistor on the LED data wire.',
      explain: (
        <>
          A few hundred ohms in series with the data wire softens the signal's edges and protects the first LED if the ring is ever powered while the board isn't. With wires this short it's belt-and-braces: builds work fine without it.
        </>
      ),
      watch: <>Check the kit includes 330 Ω. Anything from 220 to 470 Ω does the same job.</>,
      url: 'https://www.amazon.ca/dp/B0BTP88DZN',
      seller: 'Amazon.ca',
      unit: 'kit',
      price: 12.99,
      qty: 1,
      need: `${n} resistors needed`,
    });

  if (!c.haveCells)
    out.push({
      id: 'cells',
      name: 'AA NiMH rechargeable cells, 2400 mAh',
      role: 'Four per button.',
      explain: (
        <>
          Rechargeable NiMH, specifically, not alkaline. Four NiMH cells give 4.4 to 5.6 V, which suits the LEDs and the board. Four fresh alkalines give 6.4 V, which is too much for the LED ring. They're the most expensive line here, and also the one you may already own.
        </>
      ),
      url: 'https://www.amazon.ca/dp/B07NWWHK1J',
      seller: 'Amazon.ca',
      unit: '24-pack',
      price: 39.7,
      qty: packs(n * 4, 24),
      need: `${n} buttons × 4 = ${n * 4} cells`,
    });

  if (!c.haveCharger)
    out.push({
      id: 'charger',
      name: '8-bay NiMH charger',
      role: 'Charges eight cells at a time, each on its own circuit.',
      explain: <>Individual bays matter: a charger that only works in pairs overcharges one cell while it finishes the other. With {n * 4} cells, eight bays means {Math.ceil((n * 4) / 8)} rounds to charge the whole set.</>,
      url: 'https://www.amazon.ca/dp/B082NZ8PP6',
      seller: 'Amazon.ca',
      unit: 'each',
      price: 19.99,
      qty: 1,
      need: 'one for the table',
    });

  if (!c.haveWire)
    out.push({
      id: 'wire',
      name: '24 AWG silicone wire, 10 colours',
      role: 'Every connection inside the button: seven short wires each.',
      explain: <>Silicone insulation stays floppy and doesn't melt back when you solder next to it, which is a real kindness in a small enclosure. Ten colours makes it hard to mix up power, ground and data. Five feet of each is plenty for {n} buttons.</>,
      url: 'https://www.amazon.ca/dp/B09X4HVFJX',
      seller: 'Amazon.ca',
      unit: 'kit',
      price: 14.15,
      qty: 1,
      need: 'about 60 cm per button',
    });

  if (!c.haveFilament)
    out.push({
      id: 'petg',
      name: 'Transparent PETG filament, 1 kg',
      role: 'For printing the domes.',
      explain: <>"Transparent" PETG doesn't print clear; it prints frosted, which is exactly what's wanted: it hides the individual LEDs and glows evenly. A wall of 1.2 to 1.6 mm diffuses well. Thin white PLA works too. The bases can be any opaque filament you have.</>,
      url: 'https://www.amazon.ca/dp/B0D91G9ZW3',
      seller: 'Amazon.ca',
      unit: 'spool',
      price: 16.99,
      qty: 1,
      need: `${n} domes use well under one spool`,
    });

  return out;
}

const money = (n: number) => `$${n.toFixed(2)}`;
const SAVED = 'pb.parts.v1';

function Toggle({ on, onChange, children }: { on: boolean; onChange(v: boolean): void; children: ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={on} onChange={(e) => { sfx.tick(); onChange(e.target.checked); }} />
      <span>{children}</span>
    </label>
  );
}

export function Parts() {
  const [c, setC] = useState<Choices>(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SAVED) ?? '{}').choices };
    } catch {
      return DEFAULTS;
    }
  });
  const [ordered, setOrdered] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED) ?? '{}').ordered ?? [];
    } catch {
      return [];
    }
  });
  const [open, setOpen] = useState<string | null>('esp32');
  const [copied, setCopied] = useState(false);
  const set = (patch: Partial<Choices>) => setC((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    localStorage.setItem(SAVED, JSON.stringify({ choices: c, ordered }));
  }, [c, ordered]);

  const list = useMemo(() => lines(c), [c]);
  const total = list.reduce((t, l) => t + l.price * l.qty, 0);
  const remaining = list.filter((l) => !ordered.includes(l.id)).reduce((t, l) => t + l.price * l.qty, 0);
  const done = list.filter((l) => ordered.includes(l.id)).length;

  const copy = async () => {
    const text = list.map((l) => `${l.qty} × ${l.name} (${l.unit}, ${money(l.price)}): ${l.url}`).join('\n') + `\n\nAbout ${money(total)} before tax. Prices checked ${CHECKED}.`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="landing parts">
      <nav className="nav">
        <Link to="/" className="brand"><span className="brand__dot" /><span>Pax <b>Buttonica</b></span></Link>
        <div className="nav__links">
          <Link to="/button">The button</Link>
          <Link to="/hardware">Build guide</Link>
          <Link to="/demo" className="btn btn--sm btn--gold">Live demo</Link>
        </div>
      </nav>

      <header className="parts__head">
        <div className="eyebrow">The cart · prices checked {CHECKED}</div>
        <h1>Everything to buy</h1>
        <p>Tell it what you're building and what you already own; the quantities and the total follow. Open any line to see what the part does and why it's on the list. Tick things off as you order them: this page remembers.</p>
      </header>

      <section className="panel parts__choices">
        <div className="opt">
          <span className="opt__label">Buttons</span>
          <div className="seg">
            {[3, 4, 5, 6, 7, 8].map((k) => <button key={k} type="button" aria-pressed={c.buttons === k} onClick={() => { sfx.click(); set({ buttons: k }); }}>{k}</button>)}
          </div>
          <span className="opt__note">plus one hub for the laptop</span>
        </div>
        <div className="opt">
          <span className="opt__label">Battery holder</span>
          <div className="seg">
            <button type="button" aria-pressed={c.holder === 'covered'} onClick={() => { sfx.click(); set({ holder: 'covered' }); }}>Switch + lid · 105 mm base</button>
            <button type="button" aria-pressed={c.holder === 'open'} onClick={() => { sfx.click(); set({ holder: 'open' }); }}>Open tray · 92 mm base</button>
          </div>
        </div>
        <div className="opt">
          <span className="opt__label">LED rings</span>
          <div className="seg">
            <button type="button" aria-pressed={c.rings === 'amazon'} onClick={() => { sfx.click(); set({ rings: 'amazon' }); }}>Amazon · fast</button>
            <button type="button" aria-pressed={c.rings === 'canadian'} onClick={() => { sfx.click(); set({ rings: 'canadian' }); }}>Canadian shop · cheap</button>
          </div>
        </div>
        <div className="parts__toggles">
          <Toggle on={c.spares} onChange={(v) => set({ spares: v })}>Include spares (recommended)</Toggle>
          <Toggle on={c.haveCells} onChange={(v) => set({ haveCells: v })}>I have {c.buttons * 4} rechargeable AAs</Toggle>
          <Toggle on={c.haveCharger} onChange={(v) => set({ haveCharger: v })}>I have a NiMH charger</Toggle>
          <Toggle on={c.haveWire} onChange={(v) => set({ haveWire: v })}>I have hook-up wire</Toggle>
          <Toggle on={c.haveFilament} onChange={(v) => set({ haveFilament: v })}>I have translucent or white filament</Toggle>
          <Toggle on={c.tidy} onChange={(v) => set({ tidy: v })}>Perfboard and heat-shrink, for a tidy build (recommended)</Toggle>
          <Toggle on={c.resistors} onChange={(v) => set({ resistors: v })}>Add the optional data-line resistors</Toggle>
        </div>
      </section>

      <section className="parts__list">
        {list.map((l, i) => {
          const isOpen = open === l.id;
          const got = ordered.includes(l.id);
          return (
            <article key={l.id} className="panel part" data-open={isOpen || undefined} data-got={got || undefined}>
              <div className="part__row">
                <button
                  type="button"
                  className="part__check"
                  role="checkbox"
                  aria-checked={got}
                  aria-label={`Mark ${l.name} as ordered`}
                  onClick={() => { (got ? sfx.click : sfx.ack)(); setOrdered((o) => (got ? o.filter((x) => x !== l.id) : [...o, l.id])); }}
                >
                  {got && <IconCheck />}
                </button>
                <button type="button" className="part__main" onClick={() => { sfx.tick(); setOpen(isOpen ? null : l.id); }} aria-expanded={isOpen}>
                  <span className="part__n mono-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="part__title">
                    <b>{l.name}</b>
                    <small>{l.role}</small>
                  </span>
                </button>
                <span className="part__qty mono-num">{l.qty} × <small>{l.unit}</small></span>
                <span className="part__price mono-num">{money(l.price * l.qty)}</span>
                <a className="btn btn--sm" href={l.url} target="_blank" rel="noreferrer">{l.seller.split(' ')[0]} <IconArrow /></a>
              </div>
              {isOpen && (
                <div className="part__more">
                  <p>{l.explain}</p>
                  {l.watch && <p className="part__watch"><b>Watch for:</b> {l.watch}</p>}
                  <p className="part__need">{l.need} · {money(l.price)} per {l.unit} · {l.seller}</p>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <section className="panel parts__total">
        <div>
          <div className="eyebrow">Before tax and shipping</div>
          <div className="parts__sum mono-num">{money(total)}</div>
          <div className="muted">{done ? `${done} of ${list.length} ordered · ${money(remaining)} still to buy` : `${list.length} lines · about ${money(total / c.buttons)} per button, hub and spares included`}</div>
        </div>
        <button type="button" className="btn" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy the list as text'}</button>
      </section>

      <section className="section">
        <div className="section__head">
          <div className="eyebrow">How they connect</div>
          <h2>Seven wires</h2>
          <p>That's the whole circuit inside a button. The hub has no wiring at all: it's a bare board on a USB cable.</p>
        </div>
        <div className="panel parts__wiring"><Wiring /></div>
      </section>

      <section className="section" id="antenna">
        <div className="section__head">
          <div className="eyebrow">A trap worth knowing about</div>
          <h2>The antenna jack</h2>
        </div>
        <div className="parts__notes">
          <article className="panel parts__note">
            <h3>What it is</h3>
            <p>Every radio needs an antenna. On the plain SuperMini it's a tiny ceramic chip or a zig-zag of copper at one end of the board: nothing to attach, it just works. "Plus" boards add a gold snap-on socket about 2 mm across, called U.FL or IPEX, for plugging in a separate antenna on a short cable. External antennas reach further and can sit outside a metal case.</p>
          </article>
          <article className="panel parts__note">
            <h3>Why it's a trap</h3>
            <p>The radio signal can only go to one of the two. A solder jumper the size of a grain of sand picks which. According to Universal Solder's product page, their Plus V2 board ships with the <b>socket</b> selected. With nothing plugged into it, the radio is shouting into a dead end: range drops to almost nothing, and it fails in confusing, intermittent ways.</p>
          </article>
          <article className="panel parts__note">
            <h3>What to do</h3>
            <p>For a table two metres across, the on-board antenna is plenty, so buy the plain board and never think about it. If you did end up with Plus boards, either plug a small 2.4 GHz U.FL antenna into each (a few dollars apiece) or move the jumper on every board, which is fiddly soldering under a magnifier.</p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <div className="eyebrow">Not on the list</div>
          <h2>Assumed on hand</h2>
          <p>A soldering iron and solder, flush cutters, a USB-C cable that carries <b>data</b> (many only charge), hot glue or M3 screws, stick-on rubber feet, and a 3D printer or a friend with one.</p>
        </div>
        <div className="section__cta" style={{ justifyContent: 'flex-start', gap: 10 }}>
          <Link to="/hardware" className="btn btn--gold btn--lg">Wiring and flashing guide <IconArrow /></Link>
          <Link to="/button" className="btn btn--lg">See what you're building</Link>
        </div>
      </section>

      <footer className="footer">
        <p>Prices and stock were checked by hand on {CHECKED} and will have moved. Links are plain product links, not affiliate links.</p>
      </footer>
    </div>
  );
}

/** Block diagram of the circuit inside one button. */
function Wiring() {
  const box = (x: number, y: number, w: number, h: number, title: string, sub: string, color = '#96acde') => (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="rgba(16,22,40,0.9)" stroke={color} strokeOpacity="0.7" />
      <text x={x + w / 2} y={y + h / 2 - 3} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700" fontFamily="Oxanium, sans-serif" letterSpacing="1.5">{title}</text>
      <text x={x + w / 2} y={y + h / 2 + 15} textAnchor="middle" fill="#8d97af" fontSize="11.5" fontFamily="Inter, sans-serif">{sub}</text>
    </g>
  );
  const wire = (d: string, color: string, label?: string, lx?: number, ly?: number) => (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {label && <text x={lx} y={ly} fill={color} fontSize="11.5" fontWeight="600" fontFamily="Inter, sans-serif">{label}</text>}
    </g>
  );
  const RED = '#ff6b6b', BLK = '#9aa3b8', GRN = '#3ce08a', YEL = '#f2b84b';
  return (
    <svg viewBox="0 0 860 330" role="img" aria-label="Wiring diagram: battery, switch, diode, ESP32, LED ring, capacitor, microswitch">
      {box(20, 40, 130, 70, '4 × AA', 'NiMH, in the holder', RED)}
      {box(190, 50, 90, 50, 'SWITCH', 'on the holder')}
      {box(320, 50, 90, 50, 'DIODE', 'stripe this way →')}
      {box(470, 120, 170, 120, 'ESP32-C3', 'SuperMini', '#5ad1ff')}
      {box(700, 30, 140, 90, 'LED RING', '5V · GND · DIN', GRN)}
      {box(700, 150, 140, 50, 'CAPACITOR', '1000 µF, 5V to GND')}
      {box(700, 250, 140, 56, 'MICROSWITCH', 'C and NO legs', YEL)}

      {wire('M150 62 H190', RED)}
      {wire('M280 75 H320', RED)}
      {wire('M410 75 H440 V140 H470', RED, '5V pin', 418, 134)}
      {wire('M440 75 V20 H670 V50 H700', RED, '5 V rail', 520, 14)}
      {wire('M670 50 V165 H700', RED)}

      {wire('M150 95 H170 V300 H455 V220 H470', BLK, 'GND pin', 412, 214)}
      {wire('M455 300 H680 V100 H700', BLK, 'ground rail', 520, 318)}
      {wire('M680 185 H700', BLK)}
      {wire('M680 292 H700', BLK)}

      {wire('M640 160 H660 V75 H700', GRN, 'GPIO10 → DIN', 540, 112)}
      {wire('M640 205 H655 V268 H700', YEL, 'GPIO3', 606, 288)}
    </svg>
  );
}
