import { useEffect, useRef, useState, type ReactNode } from 'react';
import { pendingAcks } from '../../engine/engine';
import type { GameState } from '../../engine/types';
import { IconClose } from '../Icons';

interface Step {
  title: string;
  body(g: GameState, holdSec: string): ReactNode;
  /** Compared against the game as it was when the step began. */
  done(g: GameState, start: GameState): boolean;
}

const name = (g: GameState, seat: number | null) => (seat == null ? 'The player' : g.players[seat].name);

const STEPS: Step[] = [
  {
    title: 'Whose turn is it?',
    body: (g, s) => (
      <>
        <b>{name(g, g.active)}</b>'s button is breathing in their colour — visible from across the table. They take their action on the board, then end their turn:{' '}
        <b>press and hold their button for {s} seconds</b> (or hold <kbd>{(g.active ?? 0) + 1}</kbd> on your keyboard).
      </>
    ),
    done: (g, start) => g.active !== start.active,
  },
  {
    title: 'Playing a strategy card',
    body: (g) => (
      <>
        Now it's <b>{name(g, g.active)}</b>. This turn they flip their strategy card: <b>double-tap their button</b> (or double-press <kbd>{(g.active ?? 0) + 1}</kbd>). The big screen announces it to the room.
      </>
    ),
    done: (g) => g.strategyPlay != null,
  },
  {
    title: 'Primary first',
    body: (g) => (
      <>
        Only <b>{name(g, g.active)}</b>'s button is blinking, in the card's colour: they're doing the primary and everyone else can wait. When they're finished, <b>tap their button once</b> to open the secondaries.
      </>
    ),
    done: (g) => g.strategyPlay?.stage === 'secondary',
  },
  {
    title: 'Nobody gets skipped',
    body: (g) => (
      <>
        Now every other button is flashing. {name(g, g.active)} is locked in — try holding their button and watch it refuse. <b>Tap each flashing button</b> as that player finishes (or declines) the secondary. {pendingAcks(g).length} to go.
      </>
    ),
    done: (g) => g.strategyPlay?.stage === 'secondary' && pendingAcks(g).length === 0,
  },
  {
    title: 'Released',
    body: (g, s) => (
      <>
        All clear — {name(g, g.active)}'s button is breathing again. <b>Hold it for {s} seconds</b> to pass the turn on.
      </>
    ),
    done: (g, start) => g.active !== start.active,
  },
  {
    title: "That's the whole idea",
    body: () => (
      <>
        Keep playing, or use the <b>Scenario lab</b> below to jump straight to passing, the status-phase ready check, agenda voting or a win. Everything a real button would do, these do.
      </>
    ),
    done: () => false,
  },
];

export function Tour({ game, holdMs, onClose }: { game: GameState; holdMs: number; onClose(): void }) {
  const [i, setI] = useState(0);
  const start = useRef(game);
  const step = STEPS[i];

  useEffect(() => {
    if (step.done(game, start.current)) {
      start.current = game;
      setI((n) => Math.min(n + 1, STEPS.length - 1));
    }
  }, [game, step]);

  return (
    <div className="tour panel panel--ticks" key={i}>
      <div className="tour__head">
        <span className="eyebrow">How it works · {i + 1}/{STEPS.length}</span>
        <button type="button" className="tour__close" aria-label="Close the tour" onClick={onClose}><IconClose /></button>
      </div>
      <h3>{step.title}</h3>
      <p>{step.body(game, (holdMs / 1000).toFixed(holdMs % 1000 ? 1 : 0))}</p>
      <div className="tour__dots">
        {STEPS.map((_, n) => <i key={n} data-on={n <= i || undefined} />)}
      </div>
    </div>
  );
}
