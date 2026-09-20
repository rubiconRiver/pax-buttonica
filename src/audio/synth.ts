import type { SoundRef } from '../engine/types';
import { settingsStore } from '../state/settings';
import { loadClip } from './clips';
import { jingleById, type Note, type Wave } from './jingles';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  const s = settingsStore.get();
  if (!s.sound) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    master = ctx.createGain();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  master!.gain.value = s.volume;
  return { ctx, out: master! };
}

/** Browsers only allow sound after a gesture; call this from the first click. */
export function unlockAudio() {
  audio();
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function panned(a: { ctx: AudioContext; out: GainNode }, pan: number): AudioNode {
  if (!pan || !a.ctx.createStereoPanner) return a.out;
  const p = a.ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(a.out);
  return p;
}

interface ToneOpts {
  wave?: Wave;
  from: number;
  to?: number;
  ms: number;
  gain?: number;
  at?: number;
  pan?: number;
  attack?: number;
}

function tone({ wave = 'sine', from, to, ms, gain = 0.2, at = 0, pan = 0, attack = 0.004 }: ToneOpts) {
  const a = audio();
  if (!a) return;
  const t0 = a.ctx.currentTime + at / 1000;
  const t1 = t0 + ms / 1000;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(from, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t1);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t1);
  osc.connect(g).connect(panned(a, pan));
  osc.start(t0);
  osc.stop(t1 + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise({ ms, gain = 0.15, at = 0, freq = 2000, q = 0.8, pan = 0, sweepTo }: { ms: number; gain?: number; at?: number; freq?: number; q?: number; pan?: number; sweepTo?: number }) {
  const a = audio();
  if (!a) return;
  if (!noiseBuf) {
    noiseBuf = a.ctx.createBuffer(1, a.ctx.sampleRate, a.ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = a.ctx.currentTime + at / 1000;
  const t1 = t0 + ms / 1000;
  const src = a.ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(freq, t0);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t1);
  f.Q.value = q;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t1);
  src.connect(f).connect(g).connect(panned(a, pan));
  src.start(t0);
  src.stop(t1 + 0.02);
}

// ── Interface sounds: short, layered, never late ────────────────────────────

export const sfx = {
  /** The plastic "thock" of a big button bottoming out. */
  down(pan = 0) {
    tone({ from: 170, to: 70, ms: 90, gain: 0.5, pan });
    noise({ ms: 35, gain: 0.22, freq: 3200, pan });
  },
  up(pan = 0) {
    tone({ from: 240, to: 330, ms: 45, gain: 0.16, pan });
    noise({ ms: 22, gain: 0.1, freq: 5200, pan });
  },
  tick() {
    tone({ wave: 'triangle', from: 1900, ms: 28, gain: 0.07 });
  },
  click() {
    tone({ wave: 'triangle', from: 1300, to: 900, ms: 50, gain: 0.12 });
    noise({ ms: 18, gain: 0.06, freq: 6000 });
  },
  ack(pan = 0) {
    tone({ wave: 'triangle', from: 1320, ms: 70, gain: 0.2, pan });
    tone({ wave: 'triangle', from: 1980, ms: 140, gain: 0.18, at: 60, pan });
  },
  allClear(pan = 0) {
    [1047, 1319, 1568].forEach((f, i) => tone({ wave: 'triangle', from: f, ms: 160, gain: 0.17, at: i * 70, pan }));
  },
  confirm(pan = 0) {
    tone({ from: 110, to: 55, ms: 220, gain: 0.55, pan });
    noise({ ms: 260, gain: 0.2, freq: 900, sweepTo: 5200, q: 0.6, pan });
    tone({ wave: 'triangle', from: 880, ms: 180, gain: 0.14, at: 20, pan });
  },
  denied(pan = 0) {
    tone({ wave: 'sawtooth', from: 130, ms: 110, gain: 0.22, pan });
    tone({ wave: 'sawtooth', from: 98, ms: 200, gain: 0.22, at: 140, pan });
  },
  hint(pan = 0) {
    tone({ wave: 'sine', from: 660, ms: 60, gain: 0.1, pan });
  },
  /** A strategy card hits the table. */
  card() {
    tone({ from: 95, to: 38, ms: 520, gain: 0.6 });
    noise({ ms: 90, gain: 0.3, freq: 1800 });
    noise({ ms: 900, gain: 0.12, freq: 5000, sweepTo: 300, q: 0.5, at: 40 });
    [220, 330, 440].forEach((f) => tone({ wave: 'sawtooth', from: f, ms: 700, gain: 0.07, at: 30, attack: 0.02 }));
  },
  alert() {
    for (let i = 0; i < 3; i++) {
      tone({ wave: 'square', from: 988, ms: 90, gain: 0.11, at: i * 220 });
      tone({ wave: 'square', from: 740, ms: 90, gain: 0.11, at: i * 220 + 100 });
    }
    noise({ ms: 420, gain: 0.12, freq: 400, sweepTo: 4200, q: 0.7 });
  },
  pass(pan = 0) {
    tone({ wave: 'sawtooth', from: 520, to: 60, ms: 520, gain: 0.16, pan });
    noise({ ms: 480, gain: 0.08, freq: 3000, sweepTo: 200, pan });
  },
  pick(pan = 0) {
    noise({ ms: 60, gain: 0.16, freq: 2600, pan });
    tone({ wave: 'triangle', from: 520, to: 780, ms: 110, gain: 0.16, at: 15, pan });
  },
  ready(pan = 0) {
    tone({ wave: 'sine', from: 784, ms: 90, gain: 0.16, pan });
    tone({ wave: 'sine', from: 1175, ms: 150, gain: 0.14, at: 70, pan });
  },
  phase() {
    noise({ ms: 700, gain: 0.14, freq: 300, sweepTo: 3600, q: 0.5 });
    [196, 294, 392].forEach((f) => tone({ wave: 'sawtooth', from: f, ms: 900, gain: 0.07, attack: 0.12 }));
    tone({ wave: 'triangle', from: 784, ms: 600, gain: 0.1, at: 180 });
  },
  win() {
    const seq: Note[] = [[72, 140], [72, 140], [72, 140], [76, 420], [74, 140], [76, 140], [79, 140], [84, 900]];
    let at = 0;
    for (const [m, ms] of seq) {
      tone({ wave: 'square', from: hz(m), ms: ms * 0.92, gain: 0.13, at });
      tone({ wave: 'triangle', from: hz(m - 12), ms: ms * 0.92, gain: 0.14, at });
      at += ms;
    }
    noise({ ms: 1400, gain: 0.1, freq: 6000, sweepTo: 1500, at: 980 });
  },
};

// ── Hold-to-confirm "charge" tone ───────────────────────────────────────────

export function startCharge(ms: number, pan = 0): () => void {
  const a = audio();
  if (!a) return () => {};
  const t0 = a.ctx.currentTime;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(150, t0);
  osc.frequency.exponentialRampToValueAtTime(620, t0 + ms / 1000);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.12);
  g.gain.exponentialRampToValueAtTime(0.13, t0 + ms / 1000);
  osc.connect(g).connect(panned(a, pan));
  osc.start(t0);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const t = a.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(0.0001, t, 0.015);
    osc.stop(t + 0.1);
  };
}

// ── Jingles and clips ───────────────────────────────────────────────────────

export interface Playing {
  done: Promise<void>;
  stop(fadeMs?: number): void;
}

const NOTHING: Playing = { done: Promise.resolve(), stop() {} };

export function playNotes(notes: Note[], wave: Wave, pan = 0): Playing {
  const a = audio();
  if (!a) return NOTHING;
  const bus = a.ctx.createGain();
  bus.connect(panned(a, pan));
  let at = 0;
  const t0 = a.ctx.currentTime + 0.01;
  const oscs: OscillatorNode[] = [];
  for (const [midi, ms] of notes) {
    if (midi > 0) {
      const osc = a.ctx.createOscillator();
      const g = a.ctx.createGain();
      const s = t0 + at / 1000;
      const e = s + (ms / 1000) * 0.94;
      osc.type = wave;
      osc.frequency.value = hz(midi);
      const peak = wave === 'square' || wave === 'sawtooth' ? 0.13 : 0.24;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(peak, s + 0.006);
      g.gain.exponentialRampToValueAtTime(peak * 0.5, s + (e - s) * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, e);
      osc.connect(g).connect(bus);
      osc.start(s);
      osc.stop(e + 0.02);
      oscs.push(osc);
    }
    at += ms;
  }
  let finish: () => void = () => {};
  const done = new Promise<void>((r) => (finish = r));
  const timer = window.setTimeout(finish, at + 30);
  return {
    done,
    stop(fadeMs = 120) {
      bus.gain.setTargetAtTime(0.0001, a.ctx.currentTime, fadeMs / 4000);
      window.clearTimeout(timer);
      window.setTimeout(() => {
        oscs.forEach((o) => {
          try {
            o.stop();
          } catch {
            // already stopped
          }
        });
        finish();
      }, fadeMs);
    },
  };
}

const clipCache = new Map<string, AudioBuffer>();

async function playClip(id: string, pan: number): Promise<Playing> {
  const a = audio();
  if (!a) return NOTHING;
  let buf = clipCache.get(id);
  if (!buf) {
    const blob = await loadClip(id);
    if (!blob) return NOTHING;
    buf = await a.ctx.decodeAudioData(await blob.arrayBuffer());
    clipCache.set(id, buf);
  }
  const maxSec = settingsStore.get().clipMaxSec;
  const len = Math.min(buf.duration, maxSec);
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const g = a.ctx.createGain();
  const t0 = a.ctx.currentTime;
  g.gain.setValueAtTime(0.9, t0);
  if (buf.duration > maxSec) {
    g.gain.setValueAtTime(0.9, t0 + len - 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t0 + len);
  }
  src.connect(g).connect(panned(a, pan));
  src.start(t0, 0, len);
  let finish: () => void = () => {};
  const done = new Promise<void>((r) => (finish = r));
  src.onended = () => finish();
  return {
    done,
    stop(fadeMs = 200) {
      g.gain.cancelScheduledValues(a.ctx.currentTime);
      g.gain.setTargetAtTime(0.0001, a.ctx.currentTime, fadeMs / 4000);
      window.setTimeout(() => {
        try {
          src.stop();
        } catch {
          // already stopped
        }
        finish();
      }, fadeMs);
    },
  };
}

export async function playSound(ref: SoundRef, pan = 0): Promise<Playing> {
  if (ref.kind === 'jingle') {
    const j = jingleById(ref.id);
    return j ? playNotes(j.notes, j.wave, pan) : NOTHING;
  }
  if (ref.kind === 'clip') {
    try {
      return await playClip(ref.id, pan);
    } catch {
      return NOTHING;
    }
  }
  return NOTHING;
}

/**
 * Intro and outro sounds share one lane so an outro is followed by the next
 * player's intro instead of talking over it. If turns outrun the music, the
 * backlog is dropped rather than queued forever.
 */
class TurnLane {
  private queue: { ref: SoundRef; pan: number }[] = [];
  private current: Playing | null = null;
  private busy = false;

  play(ref: SoundRef, pan: number) {
    if (ref.kind === 'none') return;
    this.queue.push({ ref, pan });
    if (this.queue.length > 2) {
      // Turns are outrunning the music: drop the backlog and wrap up what is playing.
      this.queue.splice(0, this.queue.length - 2);
      this.current?.stop(300);
    }
    void this.pump();
  }

  flush() {
    this.queue = [];
    this.current?.stop(150);
  }

  private async pump() {
    if (this.busy) return;
    this.busy = true;
    while (this.queue.length) {
      const item = this.queue.shift()!;
      const playing = await playSound(item.ref, item.pan);
      this.current = playing;
      await playing.done;
      this.current = null;
    }
    this.busy = false;
  }
}

export const turnLane = new TurnLane();
