import { cardByNumber, colorById } from './data';
import { currentPicker, currentScorer, currentVoter } from './engine';
import type { GameState } from './types';

/**
 * The LED vocabulary every button must speak. Deliberately tiny: anything a
 * device can do with one RGB LED and a timer.
 */
export type LedMode = 'off' | 'dim' | 'solid' | 'pulse' | 'flash' | 'rainbow';

/**
 * How a button draws `pulse` ("your move"). The meaning on the wire never changes; this is taste, chosen by the
 * host for the table and by each player for their own light. Solid is the default: a breathing light all
 * evening turned out to be a lot.
 */
export type TurnLook = 'solid' | 'pulse' | 'heartbeat';

export const TURN_LOOKS: { id: TurnLook; name: string; hint: string }[] = [
  { id: 'solid', name: 'Solid', hint: 'Steady, full brightness' },
  { id: 'pulse', name: 'Breathe', hint: 'Slowly swells and fades' },
  { id: 'heartbeat', name: 'Heartbeat', hint: 'Two quick beats, then a rest' },
];

export const isTurnLook = (x: unknown): x is TurnLook => x === 'solid' || x === 'pulse' || x === 'heartbeat';

/**
 * What a button does the moment it becomes your turn (and, if the table likes, your turn to score): a one-shot on top
 * of the steady light. Each player picks their own from their phone; the host picks the table's default. Every
 * renderer (screen, phone, real button) draws these however it can, and a button that doesn't know one ignores it.
 */
export type TurnEffect =
  | 'ring' | 'ripple' | 'sparkle' | 'rainbow' | 'cop' | 'explosion' | 'fireworks' | 'lightning' | 'fire' | 'siren'
  | 'laser' | 'comet' | 'warp' | 'confetti' | 'disco' | 'glitch' | 'neon' | 'alarm' | 'thump' | 'none';

/** Particles the screen draws for an effect, on top of what the light itself does. */
export type FxLayer = 'stars' | 'rings' | 'debris' | 'confetti' | 'embers' | 'beam';

export interface TurnEffectSpec {
  id: TurnEffect;
  name: string;
  hint: string;
  /** How long it plays. */
  ms: number;
  layer?: FxLayer;
  /** How many particles the layer has. */
  count?: number;
}

export const TURN_EFFECTS: TurnEffectSpec[] = [
  { id: 'ring', name: 'Ring', hint: 'A ring bursts out from the button', ms: 520 },
  { id: 'ripple', name: 'Ripple', hint: 'Two waves roll out from the centre', ms: 1100, layer: 'rings', count: 2 },
  { id: 'sparkle', name: 'Sparkles', hint: 'A moment of twinkles', ms: 1000, layer: 'stars', count: 10 },
  { id: 'rainbow', name: 'Rainbow', hint: 'A second of every colour, then yours', ms: 1200 },
  { id: 'cop', name: 'Cop lights', hint: 'Red, blue, red, blue', ms: 1600 },
  { id: 'explosion', name: 'Explosion', hint: 'A white flash and a shower of debris', ms: 1200, layer: 'debris', count: 14 },
  { id: 'fireworks', name: 'Fireworks', hint: 'Three bursts of coloured sparks', ms: 1700, layer: 'stars', count: 18 },
  { id: 'lightning', name: 'Lightning', hint: 'Flickers of white', ms: 900 },
  { id: 'fire', name: 'Fire', hint: 'Flickering flames and rising embers', ms: 1500, layer: 'embers', count: 9 },
  { id: 'siren', name: 'Siren', hint: 'A beacon sweeping round in your colour', ms: 1400, layer: 'beam' },
  { id: 'laser', name: 'Laser', hint: 'A thin beam sweeps round, fast', ms: 1200, layer: 'beam' },
  { id: 'comet', name: 'Comet', hint: 'A bright dot races round the rim with a tail', ms: 1300, layer: 'beam' },
  { id: 'warp', name: 'Warp', hint: 'Rings fall inward, then a flash', ms: 1100, layer: 'rings', count: 3 },
  { id: 'confetti', name: 'Confetti', hint: 'A shower of colour', ms: 1600, layer: 'confetti', count: 16 },
  { id: 'disco', name: 'Disco', hint: 'Every colour, fast', ms: 1200 },
  { id: 'glitch', name: 'Glitch', hint: 'Green, jittery, briefly broken', ms: 900 },
  { id: 'neon', name: 'Neon', hint: 'Flickers on like a neon sign', ms: 1200 },
  { id: 'alarm', name: 'Alarm', hint: 'Three red strobes', ms: 900 },
  { id: 'thump', name: 'Thump', hint: 'Two big beats', ms: 1000 },
  { id: 'none', name: 'None', hint: 'The light just comes on', ms: 0 },
];

export const turnEffectSpec = (id: TurnEffect): TurnEffectSpec => TURN_EFFECTS.find((e) => e.id === id) ?? TURN_EFFECTS[0];

export const isTurnEffect = (x: unknown): x is TurnEffect => TURN_EFFECTS.some((e) => e.id === x);

/** Brightness is a share of the button's full output, kept off the floor so a light can't be "set" to invisible. */
export const MIN_BRIGHTNESS = 0.1;
export const clampBrightness = (b: unknown): number => (typeof b === 'number' && Number.isFinite(b) ? Math.min(1, Math.max(MIN_BRIGHTNESS, b)) : 1);

export interface DeviceOutput {
  color: string;
  mode: LedMode;
  /** Why the light looks like this — shown in the simulator, ignored by hardware. */
  reason: string;
}

/** What a button nobody has claimed yet shows while seats are being claimed. */
export const UNCLAIMED: DeviceOutput = { color: '#ffffff', mode: 'pulse', reason: 'Unclaimed — press when your name is called' };

/** Pure function of game state → what every button should be showing right now. */
export function deriveOutputs(g: GameState): DeviceOutput[] {
  return g.players.map((p, seat): DeviceOutput => {
    const own = colorById(p.color).led;
    if (g.seating) {
      return g.bindings[seat]
        ? { color: own, mode: 'solid', reason: 'Seat claimed' }
        : { color: own, mode: 'off', reason: 'No button yet' };
    }
    switch (g.phase) {
      case 'strategy': {
        if (seat === currentPicker(g)) return { color: own, mode: 'pulse', reason: 'Choosing a strategy card' };
        return p.cards.length
          ? { color: own, mode: 'dim', reason: 'Has chosen' }
          : { color: own, mode: 'off', reason: 'Waiting to choose' };
      }
      case 'action': {
        const sp = g.strategyPlay;
        if (sp) {
          const c = cardByNumber(sp.card);
          if (sp.stage === 'primary') {
            return seat === sp.by
              ? { color: c.color, mode: 'flash', reason: `Doing the ${c.name} primary — tap when done` }
              : p.passed
                ? { color: own, mode: 'off', reason: 'Passed' }
                : { color: own, mode: 'dim', reason: `${c.name} primary in progress` };
          }
          if (seat === sp.by) {
            return sp.acks.every(Boolean)
              ? { color: own, mode: 'pulse', reason: 'Everyone responded — hold to end turn' }
              : { color: c.color, mode: 'solid', reason: `Played ${c.name}` };
          }
          return sp.acks[seat]
            ? { color: own, mode: 'dim', reason: 'Responded' }
            : { color: c.color, mode: 'flash', reason: `${c.name} played — tap when done` };
        }
        if (seat === g.active) return { color: own, mode: 'pulse', reason: 'Your turn — hold to end it' };
        if (p.passed) return { color: own, mode: 'off', reason: 'Passed' };
        return { color: own, mode: 'dim', reason: 'Waiting' };
      }
      case 'status': {
        if (g.statusStep === 'fanfare') return { color: own, mode: 'rainbow', reason: 'The round is over!' };
        if (g.statusStep === 'scoring') {
          if (seat === currentScorer(g)) return { color: own, mode: 'pulse', reason: 'Your turn to score — tap when done' };
          return g.scoringOrder.indexOf(seat) < g.scoringIdx
            ? { color: own, mode: 'dim', reason: 'Scored' }
            : { color: own, mode: 'dim', reason: 'Waiting to score' };
        }
        return g.ready[seat]
          ? { color: own, mode: 'dim', reason: 'Ready' }
          : { color: '#ffffff', mode: 'pulse', reason: 'Status phase — tap when ready' };
      }
      case 'agenda':
        return seat === currentVoter(g)
          ? { color: own, mode: 'pulse', reason: 'Your vote — tap when done' }
          : { color: own, mode: 'dim', reason: 'Waiting to vote' };
      case 'finished':
        return seat === g.winner
          ? { color: own, mode: 'rainbow', reason: 'Winner!' }
          : { color: own, mode: 'dim', reason: 'Game over' };
    }
  });
}
