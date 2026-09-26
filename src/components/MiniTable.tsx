import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { cardByNumber, colorById } from '../engine/data';
import { pendingAcks } from '../engine/engine';
import { deriveOutputs } from '../engine/outputs';
import type { GameState } from '../engine/types';
import { useStore } from '../state/createStore';
import { seedDemo } from '../state/demo';
import { createGameStore } from '../state/game';
import { HexTable } from './game/HexTable';
import { seatPosition } from './game/geometry';
import { Seat } from './game/Seat';
import { useReactions } from './game/useReactions';
import '../styles/game.css';

type Beat = { wait: number; run(g: GameState, store: ReturnType<typeof createGameStore>): void };

const hold: Beat['run'] = (g, s) => g.active != null && s.dispatch({ type: 'INPUT', seat: g.active, input: 'hold', at: Date.now() });
const ackNext: Beat['run'] = (g, s) => {
  const w = pendingAcks(g);
  if (w.length) s.dispatch({ type: 'INPUT', seat: w[0], input: 'tap', at: Date.now() });
};

/** A short scripted loop: a plain turn, then a strategy card with everyone responding. */
const SCRIPT: Beat[] = [
  { wait: 2600, run: hold },
  { wait: 2200, run: (g, s) => g.active != null && s.dispatch({ type: 'INPUT', seat: g.active, input: 'double', at: Date.now() }) },
  { wait: 2600, run: (_g, s) => s.dispatch({ type: 'PRIMARY_DONE', at: Date.now() }) },
  { wait: 1500, run: hold }, // refused: people are still flashing
  { wait: 1300, run: ackNext },
  { wait: 520, run: ackNext },
  { wait: 420, run: ackNext },
  { wait: 640, run: ackNext },
  { wait: 900, run: ackNext },
  { wait: 1900, run: hold },
  { wait: 2600, run: (_g, s) => seedDemo(s, 'action') },
];

function caption(g: GameState): string {
  if (g.active == null) return '';
  const who = g.players[g.active].name;
  const sp = g.strategyPlay;
  if (!sp) return `${who}'s turn — their button breathes until they hold it down.`;
  if (sp.stage === 'primary') return `${who} double-taps: ${cardByNumber(sp.card).name} is out. Their button blinks while they do the primary.`;
  const waiting = pendingAcks(g).length;
  const denied = g.fx.at(-1)?.kind === 'denied';
  if (waiting && denied) return `${who} tries to end the turn early. Denied — ${waiting} still flashing.`;
  if (waiting) return `Primary done. Everyone else flashes until they tap in — ${waiting} to go.`;
  return `Everyone has responded. ${who} is free to end the turn.`;
}

/** Self-playing, silent table for the landing page. */
export function MiniTable() {
  const store = useMemo(() => createGameStore(), []);
  const { game } = useStore(store);
  const step = useRef(0);

  useEffect(() => {
    seedDemo(store, 'action');
    let timer = 0;
    const tick = () => {
      const beat = SCRIPT[step.current % SCRIPT.length];
      timer = window.setTimeout(() => {
        const g = store.get().game;
        if (g) beat.run(g, store);
        step.current += 1;
        tick();
      }, beat.wait);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [store]);

  if (!game) return null;
  return <MiniTableView game={game} />;
}

function MiniTableView({ game }: { game: GameState }) {
  const outputs = useMemo(() => deriveOutputs(game), [game]);
  const reactions = useReactions(game);
  const n = game.players.length;
  const sp = game.strategyPlay;
  return (
    <div className="mini">
      <div className="table mini__table">
        <HexTable homes={game.players.map((p, seat) => ({ color: colorById(p.color).led, active: seat === game.active, passed: p.passed }))} />
        {game.players.map((p, seat) => (
          <Seat
            key={seat}
            spot={seat}
            pos={seatPosition(seat, n)}
            player={p}
            output={outputs[seat]}
            look="pulse"
            size={92}
            holdMs={2000}
            isSpeaker={game.speaker === seat}
            hasZero={false}
            isActive={game.active === seat}
            liveMs={p.timeMs}
            explain={false}
            react={reactions[seat]}
          />
        ))}
        <div className="center mini__center" style={{ '--cc': sp ? cardByNumber(sp.card).color : 'transparent' } as CSSProperties}>
          {sp ? (
            <div className="play__banner" key={sp.card}>
              <span className="play__n">{sp.card}</span>
              <div>
                <div className="play__name">{cardByNumber(sp.card).name}</div>
                <div className="play__by">{sp.stage === 'primary' ? 'primary in progress' : pendingAcks(game).length ? `waiting on ${pendingAcks(game).length}` : 'all clear'}</div>
              </div>
            </div>
          ) : (
            game.active != null && <div className="center__active" key={game.active}><span className="who who--big" style={{ '--pc': outputs[game.active].color } as CSSProperties}>{game.players[game.active].name}</span></div>
          )}
        </div>
      </div>
      <p className="mini__caption" key={caption(game)}>{caption(game)}</p>
    </div>
  );
}
