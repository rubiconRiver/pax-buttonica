import type { CSSProperties } from 'react';
import { TABLE_CORNERS } from './geometry';

export interface HomeSystem {
  color: string;
  active: boolean;
  passed: boolean;
}

/** Galaxy tiles out to the third ring, in axial coordinates (flat-top tiles, so the galaxy itself is pointy-top). */
const TILES: [number, number][] = [];
for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) if (Math.abs(q + r) <= 3) TILES.push([q, r]);

/** The corner tile nearest each seat spot, for a six-player table: spot 0 is the bottom corner, then clockwise. */
const HOME_TILES = ['0,3', '-3,3', '-3,0', '0,-3', '3,-3', '3,0'];

const S = 10; // tile size in map units

// Map units → table percentages. A corner tile sits 3·√3·S from the centre; the table's corners are in TABLE_CORNERS.
const REACH = 0.7; // how far toward the players the galaxy extends
const MAP_X = (Math.abs(TABLE_CORNERS[1][0]) / (4.5 * S)) * REACH;
const MAP_Y = (Math.abs(TABLE_CORNERS[0][1]) / (3 * Math.sqrt(3) * S)) * REACH;
const tilePoints = (q: number, r: number) => {
  const cx = S * 1.5 * q;
  const cy = S * Math.sqrt(3) * (r + q / 2);
  return Array.from({ length: 6 }, (_, k) => {
    const a = (k * Math.PI) / 3;
    return `${(cx + Math.cos(a) * S * 0.94).toFixed(2)},${(cy + Math.sin(a) * S * 0.94).toFixed(2)}`;
  }).join(' ');
};

/**
 * The table: a hexagonal outline with the galaxy laid out in the middle.
 * With six players each corner's home system takes its owner's colour.
 */
export function HexTable({ homes }: { homes?: HomeSystem[] }) {
  const outline = TABLE_CORNERS.map(([x, y]) => `${x},${y}`).join(' ');
  const inner = TABLE_CORNERS.map(([x, y]) => `${x * 0.93},${y * 0.93}`).join(' ');
  return (
    <div className="hextable" aria-hidden>
      {/* Stretched to the table box, so it lines up with the seats exactly. */}
      <svg className="hextable__felt" viewBox="-50 -50 100 100" preserveAspectRatio="none">
        <defs>
          <radialGradient id="felt" cx="50%" cy="42%" r="60%">
            <stop offset="0" stopColor="#1d2742" stopOpacity="0.75" />
            <stop offset="1" stopColor="#070a12" stopOpacity="0.96" />
          </radialGradient>
        </defs>
        <polygon points={outline} fill="url(#felt)" />
        <polygon className="hextable__rim" points={outline} />
        <polygon className="hextable__rim hextable__rim--inner" points={inner} />
        {/* The galaxy lies on the table, so it takes the same squash: home systems land in front of their owners. */}
        <g className="hextable__map" transform={`scale(${MAP_X} ${MAP_Y})`}>
          {TILES.map(([q, r]) => {
            const key = `${q},${r}`;
            const spot = homes ? HOME_TILES.indexOf(key) : -1;
            const home = spot >= 0 ? homes![spot] : undefined;
            return (
              <polygon
                key={key}
                points={tilePoints(q, r)}
                className="hextile"
                data-mecatol={(q === 0 && r === 0) || undefined}
                data-home={home ? '' : undefined}
                data-active={home?.active || undefined}
                data-passed={home?.passed || undefined}
                style={home ? ({ '--pc': home.color } as CSSProperties) : undefined}
              />
            );
          })}
          <circle className="hextile__rex" r="3.2" />
        </g>
      </svg>
    </div>
  );
}
