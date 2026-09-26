/**
 * The table is a hexagon, like the galaxy: with six players, everyone sits at a
 * corner, where their home system is. Seat 0 is at the bottom, continuing
 * clockwise as seen on screen. Units are percentages of the table box.
 */
const RX = 42;
const RY = 30;

/** Corners of the table outline (a pointy-top hexagon, stretched to fit the screen). */
export const TABLE_CORNERS: [number, number][] = Array.from({ length: 6 }, (_, k) => {
  const a = Math.PI / 2 + (k * Math.PI) / 3;
  return [Math.cos(a) * RX, Math.sin(a) * RY];
});

/** Where a ray from the centre at this angle crosses the table's edge. */
function onOutline(angle: number): [number, number] {
  const dx = Math.cos(angle) * RX;
  const dy = Math.sin(angle) * RY;
  let best = 1;
  for (let k = 0; k < 6; k++) {
    const [ax, ay] = TABLE_CORNERS[k];
    const [bx, by] = TABLE_CORNERS[(k + 1) % 6];
    // Solve centre + t·d = a + u·(b − a)
    const ex = bx - ax;
    const ey = by - ay;
    const det = dx * -ey + ex * dy;
    if (Math.abs(det) < 1e-9) continue;
    const t = (ax * -ey + ex * ay) / det;
    const u = (dx * ay - dy * ax) / det;
    if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t);
  }
  return [dx * best, dy * best];
}

export interface SeatPos {
  /** Percentages of the table box, from its centre. */
  x: number;
  y: number;
  /** Nameplate above the button rather than below it. */
  above: boolean;
  /** Stereo position of this seat's sounds, -1 (left) to 1 (right). */
  pan: number;
}

/** Round the table: seat spot `i` of `n`, from the bottom clockwise, on the table's edge. */
export function seatPosition(i: number, n: number): SeatPos {
  const angle = Math.PI / 2 + (i * 2 * Math.PI) / n;
  const [x, y] = onOutline(angle);
  return {
    x,
    y,
    /** Nameplates go on the outside of the table so they never collide with the centre. */
    above: Math.sin(angle) < -0.2,
    pan: Math.cos(angle) * 0.7,
  };
}

/** In a row across the top of the stage: place `rank` of `n` in the order of play, first on the left. */
export function rankPosition(rank: number, n: number): SeatPos {
  const step = Math.min(17, 92 / n);
  const x = (rank - (n - 1) / 2) * step;
  return { x, y: ROW_Y, above: false, pan: (x / 46) * 0.7 };
}
/** How far above the table's centre the row sits, in percent. */
export const ROW_Y = -33;

export function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
