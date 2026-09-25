import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../audio/synth';
import { cardByNumber } from '../../engine/data';
import type { Action, GameState } from '../../engine/types';

/**
 * The levers for when the rules engine can't know what happened at the table: an action card, a ruling, a
 * mistake nobody wants to rewind through. Every one of these is an ordinary action, so it's logged and undoable.
 */
export function RefereePanel({ game, dispatch, onClose }: { game: GameState; dispatch(a: Action): void; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [turnTo, setTurnTo] = useState<number>(game.players.findIndex((_, i) => i !== game.active && !game.players[i].passed));
  const at = () => Date.now();
  const act = (a: Action) => {
    sfx.click();
    dispatch(a);
  };

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (ref.current && !ref.current.parentElement!.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const inAction = game.phase === 'action' && !game.seating;
  const sp = game.strategyPlay;

  return (
    <div className="popover popover--referee panel" ref={ref} role="dialog" aria-label="Referee">
      <div className="referee__section">
        <div className="eyebrow">The turn</div>
        <div className="referee__row">
          <select className="select" value={turnTo} aria-label="Give the turn to" onChange={(e) => setTurnTo(+e.target.value)} disabled={!inAction}>
            {game.players.map((p, i) => <option key={i} value={i} disabled={i === game.active}>{p.name}{p.passed ? ' (passed)' : ''}</option>)}
          </select>
          <button type="button" className="btn btn--sm" disabled={!inAction || turnTo < 0 || turnTo === game.active} onClick={() => act({ type: 'SET_ACTIVE', seat: turnTo, at: at() })}>Give them the turn</button>
        </div>
        {sp && (
          <button type="button" className="btn btn--sm" onClick={() => act({ type: 'CANCEL_PLAY', at: at() })}>
            Cancel {cardByNumber(sp.card).name}: back to {game.players[sp.by].name}, unplayed
          </button>
        )}
      </div>

      <div className="referee__section">
        <div className="eyebrow">Passed, and cards played</div>
        <ul className="referee__players">
          {game.players.map((p, seat) => (
            <li key={seat}>
              <span className="referee__name">{p.name}</span>
              <label className="toggle" title={p.passed ? 'Bring them back into the round' : 'Mark them as passed'}>
                <input type="checkbox" checked={p.passed} disabled={!inAction} onChange={(e) => act({ type: 'SET_PASSED', seat, passed: e.target.checked, at: at() })} />
                <span>passed</span>
              </label>
              <span className="referee__cards">
                {p.cards.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="cardpip"
                    data-used={p.usedCards.includes(c) || undefined}
                    style={{ '--cc': cardByNumber(c).color } as React.CSSProperties}
                    title={`${cardByNumber(c).name}: ${p.usedCards.includes(c) ? 'played. Click to mark unplayed' : 'unplayed. Click to mark played'}`}
                    aria-label={`${p.name}'s ${cardByNumber(c).name}, ${p.usedCards.includes(c) ? 'played' : 'unplayed'}`}
                    onClick={() => act({ type: 'SET_CARD_USED', seat, card: c, used: !p.usedCards.includes(c) })}
                  >
                    {c}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="referee__section">
        <div className="eyebrow">Phases</div>
        <div className="referee__row">
          <button type="button" className="btn btn--sm" disabled={!inAction} onClick={() => act({ type: 'GOTO', phase: 'status', at: at() })}>Jump to the status phase</button>
          <button type="button" className="btn btn--sm" disabled={game.seating != null || game.phase === 'finished' || game.phase === 'agenda'} onClick={() => act({ type: 'GOTO', phase: 'agenda', at: at() })}>Jump to the agenda phase</button>
          <button type="button" className="btn btn--sm" disabled={game.seating != null || game.phase === 'finished'} onClick={() => act({ type: 'GOTO', phase: 'next-round', at: at() })}>Start the next round</button>
        </div>
      </div>
      <p className="muted referee__note">Everything here is logged and can be undone. For anything else, rewind from the Ship's log.</p>
    </div>
  );
}
