// Porch glow's scenes: slow, living light for a line of lamps. Used twice: by the server, which plays one on the real lamps,
// and by the page, which draws every one of them on screen the same way.
//
// A scene is one function: at(x, t, k, n) → [hue 0-360, saturation 0-1, brightness 0-1] for the lamp at position x along the
// house (0 one end, 1 the other; k of n) at time t in seconds. Each lamp is asked about every `step` seconds and glides to the
// answer over that long, so a scene is drawn in slow strokes: nothing here can be faster than its step. A scene may roll dice
// (a twinkle is "one time in ten, answer white"): the next stroke puts the lamp back.

const TAU = Math.PI * 2;
const wave = (x) => 0.5 + 0.5 * Math.sin(TAU * x);                    // 0..1, once round per 1
const mix = (a, b, k) => a + (b - a) * k;
const chance = (p) => Math.random() < p;
// Smooth wandering between -1 and 1 that never quite repeats, different at each place along the house.
const drift = (x, t, seed = 0) => (Math.sin(x * 3.1 + t * 0.21 + seed) + Math.sin(x * 1.7 - t * 0.13 + seed * 2.3) + Math.sin(x * 5.3 + t * 0.34 + seed * 0.7)) / 3;
// A colour from a list of hues, k from 0 to 1 along the list, going the short way round the wheel between neighbours.
const along = (hues, k) => { const p = Math.min(0.9999, Math.max(0, k)) * (hues.length - 1), i = Math.floor(p), a = hues[i], b = hues[i + 1]; const d = ((b - a + 540) % 360) - 180; return (a + d * (p - i) + 360) % 360; };

export const SCENES = [
  { id: 'aurora', name: 'Northern lights', what: 'green curtains drifting, a violet edge now and then', step: 3,
    at: (x, t) => [drift(x, t * 0.4, 5) > 0.5 ? 285 : 150 + 50 * drift(x * 1.2, t * 0.6), 1, 0.35 + 0.6 * wave(x * 0.8 - t / 23 + drift(x, t, 9) * 0.2)] },
  { id: 'campfire', name: 'Campfire', what: 'embers and flame, never still', step: 0.9,
    at: () => (chance(0.08) ? [48, 0.9, 1] : [10 + 26 * Math.random(), 1, 0.4 + 0.6 * Math.random() ** 2]) },
  { id: 'ocean', name: 'Tide', what: 'swells rolling along the house, foam on the crests', step: 2,
    at: (x, t) => { const p = wave(x * 1.2 - t / 9); return [mix(218, 178, p), mix(1, 0.7, p * p), 0.22 + 0.7 * p]; } },
  { id: 'sunset', name: 'Long sunset', what: 'gold to rose to indigo, sliding so slowly you only notice later', step: 4,
    at: (x, t) => [along([42, 22, 345, 290, 250], x * 0.55 + 0.45 * wave(t / 300)), 0.95, 0.75] },
  { id: 'lava', name: 'Lava lamp', what: 'slow blobs of red, orange and magenta', step: 3,
    at: (x, t) => { const d = drift(x * 0.8, t * 0.35, 3); return [(d > 0 ? 38 * d : 360 + 45 * d) % 360, 1, 0.5 + 0.45 * Math.abs(drift(x, t * 0.3, 8))]; } },
  { id: 'fireflies', name: 'Fireflies', what: 'dark, and then one lights up over there', step: 1.3,
    at: () => (chance(0.11) ? [72, 1, 0.9] : [45, 0.9, 0.03]) },
  { id: 'rainbow', name: 'Rainbow drift', what: 'the whole wheel laid along the house, turning', step: 2,
    at: (x, t) => [(x * 300 + t * 12) % 360, 1, 0.8] },
  { id: 'cotton', name: 'Cotton candy', what: 'pink and baby blue, swirling', step: 2.5,
    at: (x, t) => [mix(322, 195, wave(x * 1.3 + t / 12 + drift(x, t, 2) * 0.15)), 0.55, 0.8] },
  { id: 'snow', name: 'Snow globe', what: 'ice blue, with a glint whenever a flake catches the light', step: 1.5,
    at: (x, t) => (chance(0.1) ? [200, 0.05, 1] : [205, 0.3 + 0.2 * drift(x, t, 1), 0.35 + 0.15 * drift(x, t, 4)]) },
  { id: 'storm', name: 'Storm far off', what: 'deep blue dusk, lightning somewhere over the prairie', step: 1.5,
    at: (x, t) => (chance(0.04) ? [225, 0.1, 0.85] : [250 + 15 * drift(x, t), 1, 0.12 + 0.08 * wave(t / 7 + x)]) },
  { id: 'space', name: 'Deep space', what: 'indigo and nebula pink, stars coming and going', step: 1.6,
    at: (x, t) => (chance(0.08) ? [0, 0, 0.8] : [drift(x, t * 0.3, 6) > 0.45 ? 312 : 255 + 25 * drift(x, t), 1, 0.2]) },
  // ── the calendar ──
  { id: 'halloween', name: 'Jack-o\'-lantern', what: 'orange and purple trading places, a flick of slime green', step: 2,
    at: (x, t, k) => (chance(0.05) ? [110, 1, 0.9] : [(mix(28, -85, wave(t / 14 + (k % 2) * 0.5)) + 360) % 360, 1, 0.6]) },
  { id: 'christmas', name: 'Christmas lights', what: 'red and green swapping, warm white twinkles', step: 2,
    at: (x, t, k) => (chance(0.08) ? [40, 0.35, 1] : [(Math.floor(t / 10) + k) % 2 ? 120 : 0, 1, 0.7]) },
  { id: 'newyear', name: 'Champagne', what: 'gold, fizzing', step: 1,
    at: (x, t) => (chance(0.18) ? [45, 0.1, 1] : [42, 0.9, 0.5 + 0.2 * drift(x, t)]) },
  { id: 'valentine', name: 'Valentine', what: 'rose and red, swelling slowly', step: 2,
    at: (x, t) => [mix(330, 356, wave(x + t / 11)), 0.9, 0.5 + 0.4 * wave(t / 5 - x * 0.3)] },
  { id: 'stpatrick', name: 'Clover', what: 'every green there is, and a glint of gold', step: 2,
    at: (x, t) => (chance(0.07) ? [45, 1, 1] : [mix(95, 140, wave(x * 2 + t / 9)), 1, 0.7]) },
  { id: 'canada', name: 'Canada Day', what: 'red and white rippling like a flag', step: 2,
    at: (x, t) => { const p = wave(x * 1.5 - t / 6); return [0, p > 0.55 ? 1 : p < 0.45 ? 0.05 : mix(0.05, 1, (p - 0.45) * 10), 0.8]; } },
];

// What suits tonight, and why: the calendar first, then the season.
export function tonight(date = new Date()) {
  const m = date.getMonth() + 1, d = date.getDate();
  const pick = (id, why) => ({ id, why });
  if (m === 10) return pick('halloween', d === 31 ? 'It is Halloween.' : 'It is October: Halloween is coming.');
  if (m === 12 && d === 31 || m === 1 && d === 1) return pick('newyear', 'Happy New Year.');
  if (m === 12 && d <= 26) return pick('christmas', 'It is December.');
  if (m === 2 && d === 14) return pick('valentine', 'It is Valentine\'s Day.');
  if (m === 3 && d === 17) return pick('stpatrick', 'It is St. Patrick\'s Day.');
  if (m === 7 && d === 1) return pick('canada', 'It is Canada Day.');
  if (m === 12 || m <= 2) return pick(d % 2 ? 'aurora' : 'snow', 'It is winter: a sky for it.');
  if (m >= 6 && m <= 8) return pick(d % 2 ? 'fireflies' : 'campfire', 'A summer evening.');
  if (m === 11 || m === 3) return pick('aurora', 'Long dark evenings: northern lights.');
  return pick(['sunset', 'ocean', 'lava', 'cotton', 'space', 'rainbow', 'storm'][date.getDay()], 'No occasion: one for the day of the week.');
}

// When the sun sets on `date` at a place (the almanac's method, good to a minute or two). Null in the far north's midsummer.
export function sunset(date, lat, lon) {
  const rad = Math.PI / 180, y = date.getFullYear(), mo = date.getMonth(), d = date.getDate();
  const N = Math.round((Date.UTC(y, mo, d) - Date.UTC(y, 0, 0)) / 864e5), lngHour = lon / 15, t = N + (18 - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  const Ls = (M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634 + 360) % 360;
  let RA = (Math.atan(0.91764 * Math.tan(Ls * rad)) / rad + 360) % 360;
  RA = (RA + Math.floor(Ls / 90) * 90 - Math.floor(RA / 90) * 90) / 15;
  const sinDec = 0.39782 * Math.sin(Ls * rad), cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
  if (cosH > 1 || cosH < -1) return null;
  const UT = ((Math.acos(cosH) / rad / 15 + RA - 0.06571 * t - 6.622 - lngHour) % 24 + 24) % 24;
  const at = new Date(Date.UTC(y, mo, d) + UT * 36e5), noon = new Date(y, mo, d, 12);
  while (at < noon) at.setTime(at.getTime() + 864e5);          // the UTC clock may already be on tomorrow
  return at;
}
