import { useMemo } from 'react';
import type { TurnEffect } from '../../engine/outputs';
import type { Fx, GameState } from '../../engine/types';

/** A one-shot the button draws: the engine's reactions, and the player's chosen turn effect. */
export type ReactionKind = 'denied' | 'ack' | 'hint' | 'burst' | Exclude<TurnEffect, 'ring' | 'none'>;
export type Reaction = { id: number; kind: ReactionKind } | null;

const REACTIONS: Partial<Record<Fx['kind'], ReactionKind>> = {
  claim: 'burst',
  denied: 'denied',
  hint: 'hint',
  ack: 'ack',
  ready: 'ack',
  pick: 'ack',
  turnStart: 'burst',
  /** Your turn to score: rings fall inward, whoever you are. */
  score: 'warp',
  allAcked: 'burst',
};

/** How a turn effect is drawn: the ring is the burst every button has always done; none draws nothing. */
export const reactionFor = (effect: TurnEffect): ReactionKind | null => (effect === 'ring' ? 'burst' : effect === 'none' ? null : effect);

/** The engine's one-shots are the same for everyone; the start of a turn is drawn to each seat's taste. */
const TURN_FX = new Set<Fx['kind']>(['turnStart']);

/**
 * The latest one-shot visual reaction for each seat's button. `effects`, per seat, is how that player likes the
 * start of their turn drawn; without it, the ring.
 */
export function useReactions(game: GameState, effects: (TurnEffect | undefined)[] = []): Reaction[] {
  return useMemo(() => {
    const out: Reaction[] = game.players.map(() => null);
    for (const f of game.fx) {
      if (f.seat == null) continue;
      const kind = TURN_FX.has(f.kind) ? reactionFor(effects[f.seat] ?? 'ring') : REACTIONS[f.kind];
      if (kind) out[f.seat] = { id: f.id, kind };
      else if (TURN_FX.has(f.kind)) out[f.seat] = null;
    }
    return out;
  }, [game.fx, game.players, effects]);
}
