import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { colorById } from '../../engine/data';
import type { GameState } from '../../engine/types';
import { IconUndo } from '../Icons';

/** Every line the game has written, newest first, each with a mark to rewind to just before it. */
export function ShipsLog({ game, onRewind }: { game: GameState; onRewind?(event: number): void }) {
  // Rewinding takes two clicks on the same line: one to arm, one to mean it.
  const [armed, setArmed] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: 0 });
  }, [game.logSeq]);

  return (
    <div className="log scroll" ref={logRef}>
      {[...game.log].reverse().map((e) => (
        <div key={e.id} className="log__row" data-tone={e.tone} data-armed={armed === e.event || undefined} style={{ '--pc': e.seat != null ? colorById(game.players[e.seat].color).led : 'transparent' } as CSSProperties}>
          <span className="log__round mono-num">R{e.round}</span>
          <span>{e.text}</span>
          {onRewind && e.event != null && ((ev: number) => (
            <button
              type="button"
              className="log__rewind"
              title="Rewind the game to just before this"
              aria-label={armed === ev ? `Rewind to before: ${e.text}` : `Rewind to before "${e.text}"`}
              onBlur={() => setArmed(null)}
              onClick={() => {
                if (armed === ev) {
                  setArmed(null);
                  onRewind(ev);
                } else setArmed(ev);
              }}
            >
              <IconUndo /> {armed === ev ? 'Rewind to here?' : ''}
            </button>
          ))(e.event)}
        </div>
      ))}
    </div>
  );
}
