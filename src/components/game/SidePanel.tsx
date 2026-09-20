import { useEffect, useRef, type CSSProperties } from 'react';
import { sfx } from '../../audio/synth';
import { cardByNumber, colorById } from '../../engine/data';
import { initiativeOrder } from '../../engine/engine';
import type { Action, GameState } from '../../engine/types';
import { IconGavel } from '../Icons';

interface Props {
  game: GameState;
  dispatch(a: Action): void;
}

export function SidePanel({ game, dispatch }: Props) {
  const byInitiative = game.phase === 'action';
  const order = byInitiative ? initiativeOrder(game) : game.players.map((_, i) => i);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: 0 });
  }, [game.logSeq]);

  return (
    <aside className="side">
      <section className="panel side__players">
        <div className="panel__head">
          <span>{byInitiative ? 'Turn order' : 'Players'}</span>
          <span>First to {game.vpTarget}</span>
        </div>
        <ul className="roster">
          {order.map((seat) => {
            const p = game.players[seat];
            const led = colorById(p.color).led;
            const isSpeaker = game.speaker === seat;
            return (
              <li
                key={seat}
                className="roster__row"
                data-active={game.active === seat || undefined}
                data-passed={p.passed || undefined}
                style={{ '--pc': led } as CSSProperties}
              >
                <span className="roster__init">
                  {game.zeroToken === seat && <span className="cardpip" style={{ '--cc': '#fff' } as CSSProperties}>0</span>}
                  {p.cards.length ? (
                    p.cards.map((c) => (
                      <span key={c} className="cardpip" data-used={p.usedCards.includes(c) || undefined} style={{ '--cc': cardByNumber(c).color } as CSSProperties} title={cardByNumber(c).name}>{c}</span>
                    ))
                  ) : game.zeroToken !== seat ? (
                    <span className="cardpip cardpip--empty">–</span>
                  ) : null}
                </span>
                <span className="roster__who">
                  <span className="roster__name">{p.name}</span>
                  <span className="roster__faction">{p.passed ? 'Passed' : p.faction.replace(/^The /, '')}</span>
                  <span className="roster__bar"><i style={{ width: `${(p.vp / game.vpTarget) * 100}%` }} /></span>
                </span>
                <button
                  type="button"
                  className="roster__speaker"
                  aria-pressed={isSpeaker}
                  title={isSpeaker ? 'Speaker' : `Give ${p.name} the speaker token`}
                  onClick={() => {
                    sfx.click();
                    dispatch({ type: 'SET_SPEAKER', seat });
                  }}
                >
                  <IconGavel />
                </button>
                <span className="stepper">
                  <button type="button" aria-label={`Remove a point from ${p.name}`} disabled={p.vp <= 0} onClick={() => { sfx.click(); dispatch({ type: 'VP', seat, delta: -1, at: Date.now() }); }}>−</button>
                  <b key={p.vp} className="stepper__n mono-num">{p.vp}</b>
                  <button type="button" aria-label={`Give ${p.name} a point`} disabled={game.phase === 'finished'} onClick={() => { sfx.click(); dispatch({ type: 'VP', seat, delta: 1, at: Date.now() }); }}>+</button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel side__log">
        <div className="panel__head"><span>Ship's log</span><span>Round {game.round}</span></div>
        <div className="log scroll" ref={logRef}>
          {[...game.log].reverse().map((e) => (
            <div key={e.id} className="log__row" data-tone={e.tone} style={{ '--pc': e.seat != null ? colorById(game.players[e.seat].color).led : 'transparent' } as CSSProperties}>
              <span className="log__round mono-num">R{e.round}</span>
              <span>{e.text}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
