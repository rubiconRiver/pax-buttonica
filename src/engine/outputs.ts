import { cardByNumber, colorById } from './data';
import { currentPicker, currentVoter } from './engine';
import type { GameState } from './types';

/**
 * The LED vocabulary every button must speak. Deliberately tiny: anything a
 * device can do with one RGB LED and a timer.
 */
export type LedMode = 'off' | 'dim' | 'solid' | 'pulse' | 'flash' | 'rainbow';

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
      case 'status':
        return g.ready[seat]
          ? { color: own, mode: 'dim', reason: 'Ready' }
          : { color: '#ffffff', mode: 'pulse', reason: 'Status phase — tap when ready' };
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
