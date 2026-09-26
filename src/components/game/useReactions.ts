import { useMemo } from 'react';
import type { Fx, GameState } from '../../engine/types';

export type Reaction = { id: number; kind: 'denied' | 'ack' | 'hint' | 'burst' } | null;

const REACTIONS: Partial<Record<Fx['kind'], 'denied' | 'ack' | 'hint' | 'burst'>> = {
  claim: 'burst',
  denied: 'denied',
  hint: 'hint',
  ack: 'ack',
  ready: 'ack',
  pick: 'ack',
  turnStart: 'burst',
  score: 'burst',
  allAcked: 'burst',
};

/** The latest one-shot visual reaction for each seat's button. */
export function useReactions(game: GameState): Reaction[] {
  return useMemo(() => {
    const out: Reaction[] = game.players.map(() => null);
    for (const f of game.fx) {
      const kind = REACTIONS[f.kind];
      if (kind && f.seat != null) out[f.seat] = { id: f.id, kind };
    }
    return out;
  }, [game.fx, game.players]);
}
