import { sfx } from '../../audio/synth';
import { pendingAcks, unusedCards } from '../../engine/engine';
import type { Action, GameState } from '../../engine/types';
import { IconFlask } from '../Icons';

interface Props {
  game: GameState;
  dispatch(a: Action): void;
  onReset(): void;
  onJump(where: 'strategy' | 'action' | 'late'): void;
}

interface Scenario {
  label: string;
  hint: string;
  enabled: boolean;
  run(): void;
}

/** One-click shortcuts to every situation the buttons have to handle. */
export function ScenarioLab({ game, dispatch, onReset, onJump }: Props) {
  const at = Date.now();
  const inAction = game.phase === 'action' && game.active != null && !game.seating;
  const active = inAction ? game.players[game.active!] : null;
  const inPrimary = game.strategyPlay?.stage === 'primary';
  const waiting = game.strategyPlay?.stage === 'secondary' ? pendingAcks(game) : [];
  const others = game.players.map((_, i) => i).filter((i) => i !== game.active);

  const groups: { title: string; items: Scenario[] }[] = [
    {
      title: 'A turn',
      items: [
        { label: 'Seat claiming', hint: 'Every button breathes white; players press in seat order to claim theirs', enabled: !game.seating, run: () => dispatch({ type: 'START_SEATING', at }) },
        { label: 'Start of round', hint: 'Strategy phase: the chooser breathes', enabled: true, run: () => onJump('strategy') },
        { label: 'Fresh turn', hint: "Action phase, cards dealt, first player's button breathing", enabled: true, run: () => onJump('action') },
        { label: 'End turn', hint: 'Same as holding the active button to full', enabled: inAction, run: () => dispatch({ type: 'INPUT', seat: game.active!, input: 'hold', at }) },
        { label: 'Tap instead of hold', hint: 'Active player taps: a nudge, nothing happens', enabled: inAction && !game.strategyPlay, run: () => dispatch({ type: 'INPUT', seat: game.active!, input: 'tap', at }) },
        { label: 'Wrong player holds', hint: 'Someone else tries to end the turn: ignored', enabled: inAction && !game.strategyPlay, run: () => dispatch({ type: 'INPUT', seat: others[0], input: 'hold', at }) },
      ],
    },
    {
      title: 'Strategy card',
      items: [
        { label: 'Double-tap: play card', hint: "The screen announces the card; the owner's button blinks for the primary", enabled: inAction && !game.strategyPlay && !game.actedThisTurn && !!active && unusedCards(active).length > 0, run: () => dispatch({ type: 'INPUT', seat: game.active!, input: 'double', at }) },
        { label: 'Primary done', hint: 'Owner taps: everyone else starts flashing for the secondary', enabled: inAction && inPrimary, run: () => dispatch({ type: 'PRIMARY_DONE', at }) },
        { label: 'Try to end turn early', hint: 'Denied during the primary, and while anyone is still flashing', enabled: inAction && (inPrimary || waiting.length > 0), run: () => dispatch({ type: 'INPUT', seat: game.active!, input: 'hold', at }) },
        { label: 'One player responds', hint: 'Their button settles', enabled: waiting.length > 0, run: () => dispatch({ type: 'INPUT', seat: waiting[0], input: 'tap', at }) },
        { label: 'Everyone responds', hint: 'Active player is released', enabled: waiting.length > 0, run: () => dispatch({ type: 'ACK_ALL', at }) },
      ],
    },
    {
      title: 'Passing',
      items: [
        { label: 'Late in the round', hint: 'Every strategy card has been played, so passing is allowed', enabled: true, run: () => onJump('late') },
        { label: 'Pass too early', hint: "Denied: can't pass with an unplayed card", enabled: inAction && !!active && unusedCards(active).length > 0 && !game.strategyPlay, run: () => dispatch({ type: 'INPUT', seat: game.active!, input: 'pass', at }) },
        { label: 'Pass', hint: 'Button goes dark, turn moves on', enabled: inAction && !!active && unusedCards(active).length === 0 && !game.actedThisTurn, run: () => dispatch({ type: 'INPUT', seat: game.active!, input: 'pass', at }) },
        { label: 'Everyone has passed', hint: 'Jump to the status phase ready-check', enabled: game.phase === 'action', run: () => dispatch({ type: 'ADVANCE', at }) },
      ],
    },
    {
      title: 'Between rounds',
      items: [
        { label: 'One player ready', hint: 'Status phase: white breathing → settled', enabled: game.phase === 'status', run: () => dispatch({ type: 'INPUT', seat: game.ready.indexOf(false), input: 'tap', at }) },
        { label: 'Agenda phase', hint: 'Voting goes round the table, speaker last', enabled: game.phase === 'action' || game.phase === 'status', run: () => { dispatch({ type: 'SET_CUSTODIANS', removed: true }); if (game.phase === 'action') dispatch({ type: 'ADVANCE', at }); dispatch({ type: 'READY_ALL', at }); } },
        { label: 'Victory', hint: 'Winner goes rainbow, fanfare plays', enabled: game.phase !== 'finished', run: () => dispatch({ type: 'VP', seat: game.active ?? 0, delta: game.vpTarget, at }) },
      ],
    },
  ];

  return (
    <section className="panel lab">
      <div className="panel__head">
        <span><IconFlask style={{ width: 13, height: 13, verticalAlign: -2, marginRight: 8 }} />Scenario lab — jump to any situation</span>
        <button type="button" className="btn btn--sm btn--ghost" onClick={onReset}>Reset</button>
      </div>
      <div className="lab__groups">
        {groups.map((g) => (
          <div key={g.title} className="lab__group">
            <div className="lab__title">{g.title}</div>
            <div className="lab__items">
              {g.items.map((s) => (
                <button key={s.label} type="button" className="btn btn--sm" title={s.hint} disabled={!s.enabled} onClick={() => { sfx.click(); s.run(); }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
