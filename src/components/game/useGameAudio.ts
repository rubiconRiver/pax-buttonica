import { useEffect, useRef } from 'react';
import { jingleById } from '../../audio/jingles';
import { sfx, turnLane } from '../../audio/synth';
import { cardByNumber } from '../../engine/data';
import { seatSpots } from '../../engine/engine';
import type { TurnEffect } from '../../engine/outputs';
import type { GameState, SoundRef } from '../../engine/types';
import { isOnHub, playsOwnSounds, refusedHoldItself, sendToDevice } from '../../hardware/serial';
import { settingsStore } from '../../state/settings';
import { seatPosition } from './geometry';

/** Turns the engine's one-shot effects into sound. Each effect plays exactly once. */
/** What a real button is told to draw for each turn effect; the ring is the burst every button knows. */
export const hubEffect = (fx: TurnEffect): 'burst' | Exclude<TurnEffect, 'ring' | 'none'> | null => (fx === 'ring' ? 'burst' : fx === 'none' ? null : fx);

/** A strategy card comes out: each real button in turn, round the table from the player who played it, this far apart. */
export const CARD_ROUND_MS = 320;

/**
 * Turns the engine's one-shot effects into sound, and into the odd frame for a real button. `effects`, per seat,
 * is how that player likes the start of their turn drawn.
 */
export function useGameAudio(game: GameState | null, enabled = true, effects: (TurnEffect | undefined)[] = []) {
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!game) return;
    // First sight of a game: don't replay its history. A lower sequence means a new game began.
    if (last.current == null) last.current = game.fxSeq;
    else if (game.fxSeq < last.current) last.current = 0;
    const n = game.players.length;
    const spots = seatSpots(game);
    for (const f of game.fx) {
      if (f.id <= last.current) continue;
      if (!enabled) continue;
      const pan = f.seat != null && spots[f.seat] >= 0 ? seatPosition(spots[f.seat], n).pan : 0;
      const p = f.seat != null ? game.players[f.seat] : null;
      const dev = f.seat != null ? game.bindings[f.seat] : null;
      // A jingle goes to the player's own button if it has a speaker; uploaded clips always play here.
      const turnSound = (ref: SoundRef) => {
        const j = ref.kind === 'jingle' ? jingleById(ref.id) : undefined;
        if (j && dev && playsOwnSounds(dev)) sendToDevice({ t: 'snd', dev, w: j.wave, n: j.notes });
        else turnLane.play(ref, pan);
      };
      if (dev && isOnHub(dev)) {
        if (f.kind === 'denied' && !(f.input === 'hold' && refusedHoldItself(dev))) sendToDevice({ t: 'fx', dev, k: 'denied' });
        if (f.kind === 'ack' || f.kind === 'ready' || f.kind === 'claim') sendToDevice({ t: 'fx', dev, k: 'ack' });
        if (f.kind === 'turnStart') {
          const k = f.seat != null ? hubEffect(effects[f.seat] ?? 'ring') : null;
          if (k) sendToDevice({ t: 'fx', dev, k });
        }
        // Your turn to score: rings fall inward, whoever you are.
        if (f.kind === 'score') sendToDevice({ t: 'fx', dev, k: 'warp' });
      }
      // A strategy card comes out: round the table from the player who played it, every real button fills in the
      // card's colour and blinks once, one after another.
      if (f.kind === 'card' && f.card != null && f.seat != null) {
        const c = cardByNumber(f.card).color.replace('#', '');
        const from = spots[f.seat];
        const round = game.players
          .map((_, seat) => seat)
          .filter((seat) => spots[seat] >= 0)
          .sort((a, b) => ((spots[a] - from + n) % n) - ((spots[b] - from + n) % n));
        round.forEach((seat, i) => {
          const d = game.bindings[seat];
          if (d && isOnHub(d)) window.setTimeout(() => sendToDevice({ t: 'fx', dev: d, k: 'card', c }), i * CARD_ROUND_MS);
        });
      }
      switch (f.kind) {
        case 'claim': sfx.ack(pan); if (p) turnSound(p.intro); break;
        case 'turnStart': if (p) turnSound(p.intro); break;
        case 'score': {
          const cue = settingsStore.get().scoringCue;
          if (cue === 'turn' && p) turnSound(p.intro);
          else if (cue === 'chime') sfx.alert();
          break;
        }
        case 'turnEnd': if (p) turnSound(p.outro); break;
        case 'card': sfx.card(); break;
        case 'alert': sfx.alert(); break;
        case 'ack': sfx.ack(pan); break;
        case 'allAcked': sfx.allClear(pan); break;
        case 'denied': sfx.denied(pan); break;
        case 'hint': sfx.hint(pan); break;
        case 'pass': sfx.pass(pan); break;
        case 'pick': sfx.pick(pan); break;
        case 'ready': sfx.ready(pan); break;
        case 'phase': sfx.phase(); break;
        case 'win': turnLane.flush(); sfx.win(); break;
      }
    }
    last.current = game.fxSeq;
  }, [game, enabled]);
}
