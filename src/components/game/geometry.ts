/** Seats sit on an ellipse, seat 0 at the bottom, continuing clockwise as seen on screen. */
export function seatPosition(i: number, n: number) {
  const angle = Math.PI / 2 + (i * 2 * Math.PI) / n;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: cos * 42,
    y: sin * 30,
    /** Nameplates go on the outside of the table so they never collide with the centre. */
    above: sin < -0.2,
    pan: cos * 0.7,
  };
}

export function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
