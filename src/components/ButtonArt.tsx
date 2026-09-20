/**
 * Concept drawings of the physical button, in one consistent pseudo-3D
 * projection: circles become ellipses squashed by K, boxes face the viewer.
 * Colour comes from the CSS variable --led and brightness from --lum, so the
 * same light modes that drive the simulator animate the drawings.
 */
import { useId, type CSSProperties, type ReactNode } from 'react';

const K = 0.36;

type Paint = { top: string; side: string; stroke?: string };

function Cyl({ cx, y, rx, h, paint, children }: { cx: number; y: number; rx: number; h: number; paint: Paint; children?: ReactNode }) {
  const ry = rx * K;
  const stroke = paint.stroke ?? 'rgba(255,255,255,0.14)';
  return (
    <g>
      <path d={`M${cx - rx} ${y} L${cx - rx} ${y + h} A${rx} ${ry} 0 0 0 ${cx + rx} ${y + h} L${cx + rx} ${y} A${rx} ${ry} 0 0 1 ${cx - rx} ${y} Z`} fill={paint.side} stroke={stroke} strokeWidth="1" />
      <ellipse cx={cx} cy={y} rx={rx} ry={ry} fill={paint.top} stroke={stroke} strokeWidth="1" />
      {children}
    </g>
  );
}

function Box({ x, y, w, d, h, top, front, stroke = 'rgba(255,255,255,0.16)' }: { x: number; y: number; w: number; d: number; h: number; top: string; front: string; stroke?: string }) {
  const dk = d * K;
  return (
    <g stroke={stroke} strokeWidth="1">
      <rect x={x} y={y + dk / 2} width={w} height={h} fill={front} />
      <rect x={x} y={y - dk / 2} width={w} height={dk} fill={top} />
    </g>
  );
}

/** Shared gradients. Ids are per-instance so several drawings can share a page. */
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-shell`} x1="0" x2="1">
        <stop offset="0" stopColor="#0b0e15" />
        <stop offset="0.32" stopColor="#2c3344" />
        <stop offset="0.6" stopColor="#1a1f2b" />
        <stop offset="1" stopColor="#080a10" />
      </linearGradient>
      <linearGradient id={`${id}-white`} x1="0" x2="1">
        <stop offset="0" stopColor="#8f96a8" />
        <stop offset="0.35" stopColor="#e4e8f0" />
        <stop offset="1" stopColor="#7c8396" />
      </linearGradient>
      <radialGradient id={`${id}-frost`} cx="40%" cy="28%" r="80%">
        <stop offset="0" stopColor="#b9bfcd" />
        <stop offset="0.5" stopColor="#737b90" />
        <stop offset="1" stopColor="#363c4e" />
      </radialGradient>
      <radialGradient id={`${id}-lit`} cx="46%" cy="40%" r="75%">
        <stop offset="0" style={{ stopColor: 'color-mix(in oklab, var(--led) 55%, white)' }} />
        <stop offset="0.5" style={{ stopColor: 'var(--led)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in oklab, var(--led) 62%, black)' }} />
      </radialGradient>
      <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" /></filter>
      <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
    </defs>
  );
}

const lum = (k: number): CSSProperties => ({ opacity: `calc(var(--lum) * ${k})` });

function Dome({ id, cx, y, rx, rise }: { id: string; cx: number; y: number; rx: number; rise: number }) {
  const d = `M${cx - rx} ${y} A${rx} ${rise} 0 0 1 ${cx + rx} ${y} A${rx} ${rx * K} 0 0 1 ${cx - rx} ${y} Z`;
  return (
    <g>
      <path d={d} fill={`url(#${id}-frost)`} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <path className="lit__hue" d={d} fill={`url(#${id}-lit)`} style={lum(0.96)} />
      <ellipse cx={cx - rx * 0.3} cy={y - rise * 0.62} rx={rx * 0.34} ry={rise * 0.2} fill="#fff" opacity="0.13" filter={`url(#${id}-soft)`} />
    </g>
  );
}

/** The assembled button, lit. `aux` adds the optional strategy and pass buttons. */
export function ButtonRender({ aux = false, className }: { aux?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '');
  const cx = 200, y = 190, rx = 150, h = 58;
  return (
    <svg className={className} viewBox="0 0 400 330" role="img" aria-label="Concept drawing of the button">
      <Defs id={id} />
      <ellipse className="lit__hue" cx={cx} cy={y + h + 16} rx="196" ry="66" fill="var(--led)" style={lum(0.34)} filter={`url(#${id}-blur)`} />
      <ellipse cx={cx} cy={y + h + 8} rx={rx + 6} ry={rx * K + 6} fill="#000" opacity="0.55" filter={`url(#${id}-soft)`} />
      <Cyl cx={cx} y={y} rx={rx} h={h} paint={{ top: '#1b202c', side: `url(#${id}-shell)` }} />
      <ellipse cx={cx} cy={y} rx="118" ry={118 * K} fill="#04060a" />
      <ellipse className="lit__hue" cx={cx} cy={y} rx="116" ry={116 * K} fill="none" stroke="var(--led)" strokeWidth="7" style={lum(0.8)} filter={`url(#${id}-soft)`} />
      {aux &&
        [-1, 1].map((s) => {
          const ax = cx + s * 133 * Math.sin(0.9);
          const ay = y + 133 * K * Math.cos(0.9);
          return <Cyl key={s} cx={ax} y={ay - 6} rx={13} h={6} paint={{ top: '#d7dbe6', side: `url(#${id}-white)` }} />;
        })}
      <Dome id={id} cx={cx} y={y - 5} rx={108} rise={94} />
    </svg>
  );
}

interface Callout {
  y: number;
  from: number;
  title: string;
  lines: string[];
}

const CALLOUTS: Callout[] = [
  { y: 110, from: 446, title: 'Dome', lines: ['Frosted, about 66 mm across. It is the button:', 'the whole dome travels 3–4 mm when pressed.'] },
  { y: 238, from: 438, title: 'Diffuser & plunger', lines: ['Turns eight points of light into one glow.', 'The stem underneath presses the switch.'] },
  { y: 332, from: 412, title: 'LED ring', lines: ['Eight RGB pixels: any colour, any pattern.', 'Also draws the white arc while you hold.'] },
  { y: 420, from: 470, title: 'Electronics deck', lines: ['A microswitch and an ESP32-C3: radio, brains', 'and a USB-C port for updates. That is all.'] },
  { y: 585, from: 434, title: 'Power', lines: ['Four rechargeable AA cells in a 2×2 holder.', 'Roughly a game day per charge, for now.'] },
  { y: 790, from: 484, title: 'Base', lines: ['About 88 mm across. Weighted, rubber feet,', 'power switch, battery door. No speaker.'] },
];

/** Everything inside, pulled apart along the centre line. */
export function ExplodedView({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const cx = 330;
  const shell = { top: '#1b202c', side: `url(#${id}-shell)` };
  return (
    <svg className={className} viewBox="0 0 860 930" role="img" aria-label="Exploded view of the button's parts">
      <Defs id={id} />
      <line x1={cx} y1="40" x2={cx} y2="880" stroke="rgba(242,184,75,0.4)" strokeWidth="1" strokeDasharray="3 6" />

      {/* 6 · base shell (drawn first: it is furthest down and behind nothing) */}
      <ellipse cx={cx} cy="862" rx="160" ry="60" fill="#000" opacity="0.5" filter={`url(#${id}-soft)`} />
      <Cyl cx={cx} y={730} rx={150} h={120} paint={shell} />
      <ellipse cx={cx} cy="730" rx="140" ry={140 * K} fill="#05070b" />
      <path d={`M${cx - 140} 730 A140 ${140 * K} 0 0 1 ${cx + 140} 730`} fill="none" stroke="rgba(255,255,255,0.1)" />
      <rect x={cx + 118} y="800" width="16" height="9" rx="2" fill="#d7dbe6" />
      {[-96, 0, 96].map((dx) => <ellipse key={dx} cx={cx + dx} cy={850 + 150 * K * Math.sqrt(1 - (dx / 150) ** 2) - 2} rx="14" ry="4" fill="#020305" />)}

      {/* 5 · batteries */}
      <Box x={cx - 98} y={540} w={197} d={109} h={100} top="#161a24" front="#0e1119" />
      {[0, 1].map((r) => (
        <g key={r}>
          <rect x={cx - 88} y={566 + r * 47} width="168" height="40" rx="20" fill="#2a8f5b" stroke="rgba(255,255,255,0.2)" />
          <rect x={cx - 88} y={566 + r * 47} width="40" height="40" rx="20" fill="#c9ced9" />
          <rect x={cx + 80} y={578 + r * 47} width="8" height="16" rx="2" fill="#f2b84b" />
          <text x={cx + 10} y={591 + r * 47} fill="#0b2a1a" fontSize="13" fontWeight="800" fontFamily="Oxanium, sans-serif" textAnchor="middle" letterSpacing="2">AA · NiMH</text>
        </g>
      ))}

      {/* 4 · electronics deck */}
      <Cyl cx={cx} y={428} rx={136} h={7} paint={{ top: '#1a1f2b', side: '#0d1017' }} />
      <Box x={cx - 112} y={424} w={70} d={52} h={6} top="#0f2a44" front="#0a1c2e" />
      <rect x={cx - 120} y="419" width="14" height="10" rx="2" fill="#c9ced9" />
      <path d={`M${cx - 58} 418 h8 v4 h-8 v4 h8`} fill="none" stroke="#f2b84b" strokeWidth="1.5" />
      <rect x={cx - 92} y="420" width="20" height="8" fill="#05070b" />
      <Box x={cx - 20} y={418} w={40} d={30} h={16} top="#1c1f27" front="#0c0e13" />
      <rect x={cx - 5} y="404" width="10" height="9" rx="2" fill="#e5484d" />

      {/* 3 · LED ring */}
      <Cyl cx={cx} y={336} rx={80} h={5} paint={{ top: '#0d2419', side: '#07140e' }} />
      <ellipse cx={cx} cy="336" rx="54" ry={54 * K} fill="#070a12" stroke="rgba(255,255,255,0.12)" />
      {Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * Math.PI * 2 + 0.39;
        const px = cx + Math.cos(a) * 67;
        const py = 336 + Math.sin(a) * 67 * K;
        return (
          <g key={k}>
            <ellipse className="lit__hue" cx={px} cy={py} rx="15" ry="7" fill="var(--led)" style={lum(0.75)} filter={`url(#${id}-soft)`} />
            <rect x={px - 5} y={py - 2.6} width="10" height="5.2" fill="#f4f6fb" stroke="rgba(0,0,0,0.4)" strokeWidth="0.5" />
          </g>
        );
      })}

      {/* 2 · diffuser and plunger */}
      <Cyl cx={cx} y={246} rx={11} h={36} paint={{ top: '#e4e8f0', side: `url(#${id}-white)` }} />
      <Cyl cx={cx} y={240} rx={106} h={6} paint={{ top: 'rgba(228,232,240,0.9)', side: `url(#${id}-white)` }} />
      <ellipse className="lit__hue" cx={cx} cy="240" rx="100" ry={100 * K} fill="var(--led)" style={lum(0.35)} />

      {/* 1 · dome */}
      <Dome id={id} cx={cx} y={160} rx={112} rise={96} />

      {CALLOUTS.map((c) => (
        <g key={c.title}>
          <line x1={c.from} y1={c.y} x2="540" y2={c.y} stroke="rgba(242,184,75,0.55)" strokeWidth="1" />
          <circle cx={c.from} cy={c.y} r="2.5" fill="#f2b84b" />
          <text x="552" y={c.y - 4} fill="#ffdf9a" fontSize="15" fontWeight="700" fontFamily="Oxanium, sans-serif" letterSpacing="2.4">{c.title.toUpperCase()}</text>
          {c.lines.map((l, i) => <text key={l} x="552" y={c.y + 17 + i * 18} fill="#a9b3c9" fontSize="13" fontFamily="Inter, sans-serif">{l}</text>)}
        </g>
      ))}
    </svg>
  );
}

function Dim({ x1, y1, x2, y2, label, side = 1 }: { x1: number; y1: number; x2: number; y2: number; label: string; side?: 1 | -1 }) {
  const vertical = x1 === x2;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return (
    <g stroke="rgba(242,184,75,0.75)" strokeWidth="1" fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <><line x1={x1 - 5} y1={y1} x2={x1 + 5} y2={y1} /><line x1={x2 - 5} y1={y2} x2={x2 + 5} y2={y2} /></>
      ) : (
        <><line x1={x1} y1={y1 - 5} x2={x1} y2={y1 + 5} /><line x1={x2} y1={y2 - 5} x2={x2} y2={y2 + 5} /></>
      )}
      <text x={vertical ? mx + side * 10 : mx} y={vertical ? my + 4 : side > 0 ? my - 8 : my + 18} textAnchor={vertical ? (side > 0 ? 'start' : 'end') : 'middle'} fill="#ffdf9a" stroke="none" fontSize="13" fontWeight="700" fontFamily="Oxanium, sans-serif" letterSpacing="1">{label}</text>
    </g>
  );
}

const MM = 3.1;

/** Side elevation with the target envelope, for whoever models the shell. */
export function CrossSection({ className }: { className?: string }) {
  const cx = 300, floor = 300;
  const baseW = 88 * MM, baseH = 38 * MM, domeW = 66 * MM, rise = 26 * MM;
  const top = floor - baseH;
  return (
    <svg className={className} viewBox="0 0 600 360" role="img" aria-label="Side view of the button with target dimensions">
      <line x1="40" y1={floor} x2="560" y2={floor} stroke="rgba(255,255,255,0.18)" />
      {/* shell */}
      <path d={`M${cx - baseW / 2} ${top} h${baseW} v${baseH - 10} q0 10 -10 10 h${-(baseW - 20)} q-10 0 -10 -10 Z`} fill="#141823" stroke="rgba(255,255,255,0.3)" />
      {/* dome */}
      <path className="lit__hue" d={`M${cx - domeW / 2} ${top} A${domeW / 2} ${rise} 0 0 1 ${cx + domeW / 2} ${top} Z`} fill="var(--led)" style={lum(0.85)} />
      <path d={`M${cx - domeW / 2} ${top} A${domeW / 2} ${rise} 0 0 1 ${cx + domeW / 2} ${top}`} fill="rgba(200,206,220,0.12)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
      {/* inside */}
      <rect x={cx - 29 * MM - 8 * MM} y={floor - 3 * MM - 30 * MM} width={58 * MM} height={30 * MM} fill="rgba(42,143,91,0.28)" stroke="#2a8f5b" />
      <text x={cx - 8 * MM} y={floor - 17 * MM} fill="#7fd9a8" fontSize="12" fontFamily="Inter, sans-serif" textAnchor="middle">4 × AA, 58 × 30</text>
      <rect x={cx - 22 * MM} y={top + 1.5 * MM} width={44 * MM} height={1.6 * MM} fill="#2a8f5b" />
      <rect x={cx - 3 * MM} y={top - 8 * MM} width={6 * MM} height={9 * MM} fill="rgba(228,232,240,0.7)" />
      <rect x={cx - 5 * MM} y={top + 3.4 * MM} width={10 * MM} height={3 * MM} fill="#e5484d" opacity="0.8" />
      {/* dimensions */}
      <Dim x1={cx - baseW / 2} y1={floor + 26} x2={cx + baseW / 2} y2={floor + 26} label="base Ø 88 mm" side={-1} />
      <Dim x1={cx - domeW / 2} y1={top - rise - 22} x2={cx + domeW / 2} y2={top - rise - 22} label="dome Ø 66 mm" />
      <Dim x1={cx + baseW / 2 + 28} y1={top} x2={cx + baseW / 2 + 28} y2={floor} label="38 mm" />
      <Dim x1={cx - baseW / 2 - 28} y1={top - rise} x2={cx - baseW / 2 - 28} y2={floor} label="64 mm" side={-1} />
    </svg>
  );
}

const TOP = 2.3;

/** Top view, to scale, next to things everyone has held. */
export function SizeChart({ className }: { className?: string }) {
  const bx = 190, by = 190;
  return (
    <svg className={className} viewBox="0 0 640 380" role="img" aria-label="The button's size compared with a bank card and an AA battery">
      <circle cx={bx} cy={by} r={65 * TOP} fill="none" stroke="rgba(255,255,255,0.22)" strokeDasharray="5 6" />
      <text x={bx} y={by - 65 * TOP - 10} fill="#8d97af" fontSize="12.5" fontFamily="Inter, sans-serif" textAnchor="middle">first sketch: 130 mm</text>
      <circle cx={bx} cy={by} r={44 * TOP} fill="#161a24" stroke="rgba(255,255,255,0.4)" />
      <circle className="lit__hue" cx={bx} cy={by} r={33 * TOP} fill="var(--led)" style={lum(0.9)} />
      <circle cx={bx} cy={by} r={33 * TOP} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.5)" />
      <Dim x1={bx - 44 * TOP} y1={by + 44 * TOP + 22} x2={bx + 44 * TOP} y2={by + 44 * TOP + 22} label="88 mm" side={-1} />

      <rect x="400" y="78" width={85.6 * TOP} height={54 * TOP} rx="8" fill="rgba(90,209,255,0.06)" stroke="#5ad1ff" />
      <rect x="416" y="112" width="34" height="26" rx="4" fill="none" stroke="#5ad1ff" opacity="0.6" />
      <text x={400 + (85.6 * TOP) / 2} y={78 + 54 * TOP + 20} fill="#9fdcf5" fontSize="12.5" fontFamily="Inter, sans-serif" textAnchor="middle">a bank card: 85.6 × 54 mm</text>

      <rect x="400" y="268" width={50.5 * TOP} height={14.5 * TOP} rx={7 * TOP} fill="rgba(42,143,91,0.25)" stroke="#2a8f5b" />
      <rect x={400 + 50.5 * TOP} y={268 + 4.5 * TOP} width="5" height={5.5 * TOP} fill="#f2b84b" />
      <text x={400 + (50.5 * TOP) / 2} y={268 + 14.5 * TOP + 20} fill="#7fd9a8" fontSize="12.5" fontFamily="Inter, sans-serif" textAnchor="middle">one AA cell: 50.5 mm</text>
    </svg>
  );
}

/** The inside as it would really be built by hand: a perfboard deck, five short wires, the battery box as the floor. */
export function InsideView({ className }: { className?: string }) {
  const cx = 290, floor = 345, M = 3;
  const shellW = 105 * M, shellTop = floor - 40 * M;
  const deckY = floor - 26 * M;
  const label = (y: number, fromX: number, fromY: number, title: string, text: string) => (
    <g key={title}>
      <path d={`M${fromX} ${fromY} L500 ${y} H520`} fill="none" stroke="rgba(242,184,75,0.55)" />
      <circle cx={fromX} cy={fromY} r="2.5" fill="#f2b84b" />
      <text x="528" y={y - 2} fill="#ffdf9a" fontSize="13.5" fontWeight="700" fontFamily="Oxanium, sans-serif" letterSpacing="2">{title.toUpperCase()}</text>
      <text x="528" y={y + 15} fill="#a9b3c9" fontSize="12" fontFamily="Inter, sans-serif">{text}</text>
    </g>
  );
  return (
    <svg className={className} viewBox="110 30 750 330" role="img" aria-label="Cutaway of a hand-built button showing where each part sits">
      <line x1="110" y1={floor} x2="480" y2={floor} stroke="rgba(255,255,255,0.18)" />

      {/* shell walls */}
      <path d={`M${cx - shellW / 2} ${shellTop} V${floor - 8} q0 8 8 8 H${cx - 108} V${floor - 62} H${cx - shellW / 2 + 9} V${shellTop} Z`} fill="#1b202c" stroke="rgba(255,255,255,0.3)" />
      <path d={`M${cx + shellW / 2} ${shellTop} V${floor - 8} q0 8 -8 8 H${cx + 108} V${floor - 62} H${cx + shellW / 2 - 9} V${shellTop} Z`} fill="#1b202c" stroke="rgba(255,255,255,0.3)" />
      <path d={`M${cx - shellW / 2} ${shellTop} H${cx - 102} v9 H${cx - shellW / 2} Z M${cx + shellW / 2} ${shellTop} H${cx + 102} v9 H${cx + shellW / 2} Z`} fill="#1b202c" stroke="rgba(255,255,255,0.3)" />

      {/* battery box: it is the floor */}
      <rect x={cx - 105} y={floor - 60} width="210" height="60" fill="#0e1119" stroke="rgba(255,255,255,0.35)" />
      {[-3, -1, 1, 3].map((k) => (
        <g key={k}>
          <circle cx={cx + k * 24.5} cy={floor - 30} r="21.5" fill="#2a8f5b" stroke="rgba(255,255,255,0.25)" />
          <text x={cx + k * 24.5} y={floor - 26} textAnchor="middle" fill="#0b2a1a" fontSize="11" fontWeight="800" fontFamily="Oxanium, sans-serif">AA</text>
        </g>
      ))}
      <rect x={cx + 78} y={floor - 3} width="20" height="7" fill="#d7dbe6" />

      {/* perfboard deck on two printed posts */}
      <rect x={cx - 96} y={deckY + 5} width="8" height={floor - 60 - deckY - 5} fill="#2c3344" />
      <rect x={cx + 88} y={deckY + 5} width="8" height={floor - 60 - deckY - 5} fill="#2c3344" />
      <rect x={cx - 100} y={deckY} width="200" height="5" fill="#1e6b47" stroke="rgba(255,255,255,0.25)" />
      {Array.from({ length: 19 }, (_, k) => <circle key={k} cx={cx - 90 + k * 10} cy={deckY + 2.5} r="1" fill="#d6c08a" />)}

      {/* ESP32, flat on the deck, USB-C facing a slot in the wall */}
      <rect x={cx - 98} y={deckY - 11} width="56" height="11" fill="#0f2a44" stroke="rgba(255,255,255,0.3)" />
      <rect x={cx - 106} y={deckY - 10} width="12" height="8" rx="2" fill="#c9ced9" />
      {/* microswitch, dead centre */}
      <rect x={cx - 30} y={deckY - 30} width="60" height="30" fill="#15181f" stroke="rgba(255,255,255,0.35)" />
      <path d={`M${cx - 27} ${deckY - 32} L${cx + 26} ${deckY - 39}`} stroke="#c9ced9" strokeWidth="2.5" />
      <rect x={cx - 4} y={deckY - 35} width="8" height="6" fill="#e5484d" />
      {/* capacitor lying down, diode beside it */}
      <rect x={cx + 40} y={deckY - 22} width="46" height="22" rx="4" fill="#1d2c5e" stroke="rgba(255,255,255,0.3)" />
      <rect x={cx + 40} y={deckY - 22} width="8" height="22" rx="3" fill="#c9ced9" />

      {/* LED ring around the switch */}
      {[-1, 1].map((s) => (
        <g key={s}>
          <rect x={cx + s * 54 - 15} y={deckY - 46} width="30" height="4" fill="#0d2419" stroke="rgba(255,255,255,0.3)" />
          <rect x={cx + s * 54 - 5} y={deckY - 50} width="10" height="4" fill="#f4f6fb" />
          <rect x={cx + s * 54 - 2} y={deckY - 42} width="4" height="42" fill="#2c3344" />
        </g>
      ))}

      {/* dome and its plunger */}
      <path className="lit__hue" d={`M${cx - 99} ${shellTop} A99 80 0 0 1 ${cx + 99} ${shellTop} Z`} fill="var(--led)" style={{ opacity: 'calc(var(--lum) * 0.55)' }} />
      <path d={`M${cx - 99} ${shellTop} A99 80 0 0 1 ${cx + 99} ${shellTop}`} fill="rgba(200,206,220,0.1)" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
      <rect x={cx - 5} y={shellTop - 78} width="10" height={deckY - 39 - (shellTop - 78)} fill="rgba(228,232,240,0.75)" />

      {/* the wires: three to the ring, two to the batteries */}
      <g fill="none" strokeWidth="2.2" strokeLinecap="round">
        <path d={`M${cx - 62} ${deckY - 42} C${cx - 80} ${deckY - 34} ${cx - 84} ${deckY - 24} ${cx - 80} ${deckY - 11}`} stroke="#ff6b6b" />
        <path d={`M${cx - 58} ${deckY - 42} C${cx - 72} ${deckY - 32} ${cx - 74} ${deckY - 22} ${cx - 70} ${deckY - 11}`} stroke="#9aa3b8" />
        <path d={`M${cx - 54} ${deckY - 42} C${cx - 64} ${deckY - 30} ${cx - 64} ${deckY - 20} ${cx - 60} ${deckY - 11}`} stroke="#3ce08a" />
        <path d={`M${cx + 70} ${floor - 60} C${cx + 74} ${floor - 70} ${cx + 66} ${deckY + 14} ${cx + 70} ${deckY + 5}`} stroke="#ff6b6b" />
        <path d={`M${cx + 80} ${floor - 60} C${cx + 86} ${floor - 70} ${cx + 78} ${deckY + 14} ${cx + 82} ${deckY + 5}`} stroke="#9aa3b8" />
      </g>

      {label(60, cx + 40, shellTop - 66, 'Dome and plunger', 'One printed piece. It rides up and down 3–4 mm.')}
      {label(112, cx + 66, deckY - 48, 'LED ring', 'On two printed posts, around the switch. Three wires.')}
      {label(164, cx + 22, deckY - 22, 'Switch', 'Soldered to the board, so the click never shifts.')}
      {label(216, cx - 60, deckY - 6, 'ESP32', 'Flat on the board. USB-C lines up with a slot in the wall.')}
      {label(268, cx + 60, deckY + 2, 'Carrier board', 'Custom board or perfboard. Diode and capacitor live here.')}
      {label(320, cx + 96, floor - 30, 'Battery box = the floor', 'Its own switch and door. Two wires up to the deck.')}
    </svg>
  );
}
