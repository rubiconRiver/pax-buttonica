import type { CSSProperties } from 'react';
import { sfx } from '../../audio/synth';
import { STATUS_STEPS, STRATEGY_CARDS, cardByNumber, colorById } from '../../engine/data';
import { cardHolder, currentPicker, currentScorer, simDevice, currentVoter, endTurnBlocker, pendingAcks, unusedCards } from '../../engine/engine';
import type { Action, GameState } from '../../engine/types';
import { IconCheck, IconCrown } from '../Icons';
import { formatClock } from './geometry';

interface Props {
  game: GameState;
  now: number;
  liveMs: number;
  holdMs: number;
  dispatch(a: Action): void;
  onUndo(): void;
  onNewGame(): void;
}

const at = () => Date.now();

export function CenterPanel(props: Props) {
  const { game } = props;
  return (
    <div className="center" data-phase={game.phase} key={game.seating ? 'seating' : `${game.phase}-${game.round}-${game.phase === 'status' ? game.statusStep : ''}`}>
      {game.seating ? <SeatingView {...props} /> : <PhaseView {...props} />}
    </div>
  );
}

function PhaseView(props: Props) {
  const { game } = props;
  return (
    <>
      {game.phase === 'strategy' && <StrategyView {...props} />}
      {game.phase === 'action' && <ActionView {...props} />}
      {game.phase === 'status' && <StatusView {...props} />}
      {game.phase === 'agenda' && <AgendaView {...props} />}
      {game.phase === 'finished' && <FinishedView {...props} />}
    </>
  );
}

function SeatingView({ game, dispatch }: Props) {
  const next = game.seating!.next;
  return (
    <>
      <div className="eyebrow">Claim your seat · {next + 1} of {game.players.length}</div>
      <h2 className="center__active" key={next}><Who game={game} seat={next} big /></h2>
      <p className="center__hint">Press any breathing button. It's yours for the rest of the game.</p>
      <div className="voters">
        {game.players.map((p, i) => (
          <span key={i} className="voter" data-state={i < next ? 'claimed' : i === next ? 'now' : 'next'} style={{ '--pc': colorById(p.color).led } as CSSProperties}>
            {p.name}
          </span>
        ))}
      </div>
      <div className="center__actions">
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => dispatch({ type: 'SKIP_SEATING', devices: game.players.map((_, i) => simDevice(i)), at: at() })}>
          Skip — seat everyone in order
        </button>
      </div>
    </>
  );
}

function Who({ game, seat, big }: { game: GameState; seat: number; big?: boolean }) {
  const p = game.players[seat];
  return (
    <span className={big ? 'who who--big' : 'who'} style={{ '--pc': colorById(p.color).led } as CSSProperties}>
      {p.name}
    </span>
  );
}

function StrategyView({ game, dispatch }: Props) {
  const picker = currentPicker(game);
  return (
    <>
      <div className="eyebrow">Round {game.round} · Strategy phase</div>
      <h2 className="center__title">
        {picker != null ? <><Who game={game} seat={picker} /> is choosing</> : 'All cards chosen'}
      </h2>
      <div className="cards">
        {STRATEGY_CARDS.map((c) => {
          const holder = cardHolder(game, c.n);
          const tg = game.tradeGoods[c.n - 1];
          return (
            <button
              key={c.n}
              type="button"
              className="scard"
              style={{ '--cc': c.color, '--pc': holder != null ? colorById(game.players[holder].color).led : undefined } as CSSProperties}
              data-taken={holder != null || undefined}
              disabled={holder != null}
              title={c.primary}
              onPointerEnter={() => holder == null && sfx.tick()}
              onClick={() => dispatch({ type: 'PICK_CARD', card: c.n, at: at() })}
            >
              <span className="scard__plate">{c.n}</span>
              <span className="scard__body">
                <span className="scard__name">{c.name}</span>
                <span className="scard__gist">{c.primary}</span>
              </span>
              {tg > 0 && holder == null && <span className="scard__tg" title="Trade goods on this card">+{tg}</span>}
              {holder != null && <span className="scard__holder">{game.players[holder].name}</span>}
            </button>
          );
        })}
      </div>
      <p className="center__hint">Click the card they take. Their button breathes until they do.</p>
    </>
  );
}

function ActionView({ game, liveMs, holdMs, dispatch }: Props) {
  const seat = game.active;
  if (seat == null) return null;
  const p = game.players[seat];
  const sp = game.strategyPlay;
  const unused = unusedCards(p);
  const blocker = endTurnBlocker(game);

  if (game.choosingCard) {
    return (
      <>
        <div className="eyebrow">Which card?</div>
        <h2 className="center__title"><Who game={game} seat={seat} /> is playing…</h2>
        <div className="choice">
          {unused.map((c) => {
            const card = cardByNumber(c);
            return (
              <button key={c} type="button" className="playbtn playbtn--big" style={{ '--cc': card.color } as CSSProperties} onClick={() => dispatch({ type: 'PLAY_CARD', card: c, at: at() })}>
                <b>{c}</b> {card.name}
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => dispatch({ type: 'CANCEL_CHOICE' })}>Never mind</button>
      </>
    );
  }

  if (sp) {
    const card = cardByNumber(sp.card);
    return (
      <div className="play" style={{ '--cc': card.color } as CSSProperties}>
        <div className="play__banner">
          <span className="play__n">{card.n}</span>
          <div>
            <div className="play__name">{card.name}</div>
            <div className="play__by">played by <Who game={game} seat={sp.by} /> · <span className="mono-num">{formatClock(liveMs)}</span></div>
          </div>
        </div>
        {sp.stage === 'primary' ? (
          <>
            <div className="ability"><span className="ability__label">Primary ability</span><p>{card.primary}</p></div>
            <div className="center__actions">
              <span className="center__status"><Who game={game} seat={sp.by} />, tap your blinking button when you're done</span>
              <button type="button" className="btn btn--sm" onClick={() => dispatch({ type: 'PRIMARY_DONE', at: at() })}>Primary done</button>
            </div>
          </>
        ) : (
          <SecondaryStage {...{ game, dispatch }} />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="eyebrow">Round {game.round} · Action phase</div>
      <h2 className="center__active"><Who game={game} seat={seat} big /></h2>
      <div className="center__faction">{p.faction}</div>
      <div className="center__clock mono-num" data-paused={game.paused || undefined}>{formatClock(liveMs)}</div>
      <p className="center__hint">
        {game.paused ? 'Paused' : <>Double-tap to play your strategy card · hold {(holdMs / 1000).toFixed(holdMs % 1000 ? 1 : 0)}s to end the turn</>}
      </p>
      <div className="center__actions">
        {unused.map((c) => {
          const card = cardByNumber(c);
          return (
            <button key={c} type="button" className="playbtn" style={{ '--cc': card.color } as CSSProperties} disabled={game.actedThisTurn} onClick={() => dispatch({ type: 'PLAY_CARD', card: c, at: at() })}>
              Play <b>{c}</b> {card.name}
            </button>
          );
        })}
        <button type="button" className="btn btn--sm" disabled={!!blocker} onClick={() => dispatch({ type: 'END_TURN', at: at() })}>End turn</button>
        <button type="button" className="btn btn--sm" disabled={unused.length > 0 || game.actedThisTurn} title={unused.length ? 'Must play their strategy card first' : undefined} onClick={() => dispatch({ type: 'PASS', at: at() })}>Pass</button>
      </div>
    </>
  );
}

function SecondaryStage({ game, dispatch }: Pick<Props, 'game' | 'dispatch'>) {
  const sp = game.strategyPlay!;
  const card = cardByNumber(sp.card);
  const waiting = pendingAcks(game);
  return (
    <>
        <div className="ability"><span className="ability__label">Secondary ability</span><p>{card.secondary}</p></div>
        <div className="acks">
          {game.players.map((pl, i) =>
            i === sp.by ? null : (
              <button
                key={i}
                type="button"
                className="ackpip"
                data-done={sp.acks[i] || undefined}
                style={{ '--pc': colorById(pl.color).led } as CSSProperties}
                title={sp.acks[i] ? `${pl.name} has responded` : `Mark ${pl.name} as done`}
                onClick={() => dispatch({ type: 'ACK', seat: i, at: at() })}
              >
                <span className="ackpip__dot">{sp.acks[i] && <IconCheck />}</span>
                {pl.name}
              </button>
            ),
          )}
        </div>
        {waiting.length ? (
          <div className="center__actions">
            <span className="center__status">Waiting on {waiting.length} — tap your flashing button when you're done</span>
            <button type="button" className="btn btn--sm" onClick={() => dispatch({ type: 'ACK_ALL', at: at() })}>Everyone's done</button>
          </div>
        ) : (
          <div className="center__actions">
            <span className="center__status center__status--ok">All clear — <Who game={game} seat={sp.by} />, hold to end your turn</span>
            <button type="button" className="btn btn--sm" onClick={() => dispatch({ type: 'END_TURN', at: at() })}>End turn</button>
          </div>
        )}
    </>
  );
}

function StatusView({ game, dispatch }: Props) {
  const ready = game.ready.filter(Boolean).length;
  const step = game.statusStep ?? 'tidy';
  const scorer = currentScorer(game);

  if (step === 'fanfare') {
    return (
      <>
        <div className="eyebrow">Round {game.round} · Status phase</div>
        <h2 className="center__title">Everyone has passed</h2>
        <p className="center__hint">{game.scoreInOrder ? 'Scoring starts in a moment, in initiative order.' : 'Scoring starts in a moment.'}</p>
        <div className="center__actions">
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => dispatch({ type: 'FANFARE_DONE', at: at() })}>Get on with it</button>
        </div>
      </>
    );
  }

  if (step === 'scoring' && scorer != null) {
    return (
      <>
        <div className="eyebrow">Round {game.round} · Status phase · Scoring</div>
        <h2 className="center__active"><Who game={game} seat={scorer} big /></h2>
        <p className="center__hint">scores objectives, then taps their button. Then the next player, in initiative order.</p>
        <div className="voters" aria-label="Scoring order">
          {game.scoringOrder.map((s, i) => (
            <span key={s} className="voter" data-state={i < game.scoringIdx ? 'done' : i === game.scoringIdx ? 'now' : 'next'} style={{ '--pc': colorById(game.players[s].color).led } as CSSProperties}>
              {game.players[s].name}
            </span>
          ))}
        </div>
        <div className="center__actions">
          <button type="button" className="btn btn--sm" onClick={() => dispatch({ type: 'SCORED', seat: scorer, at: at() })}>{game.players[scorer].name} is done</button>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => dispatch({ type: 'SKIP_SCORING', at: at() })}>Skip to the tidy-up</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="eyebrow">Round {game.round} · Status phase</div>
      <h2 className="center__title">Tidy up, then tap in</h2>
      <ol className="steps">
        {STATUS_STEPS.map((s) => <li key={s}>{s}</li>)}
      </ol>
      <div className="center__actions">
        <span className="center__status"><b className="mono-num">{ready}/{game.players.length}</b> ready</span>
        <label className="toggle" title="Once the custodians token leaves Mecatol Rex, every round ends with an agenda phase">
          <input type="checkbox" checked={game.custodiansRemoved} onChange={(e) => dispatch({ type: 'SET_CUSTODIANS', removed: e.target.checked })} />
          <span>Custodians removed</span>
        </label>
        <button type="button" className="btn btn--sm" onClick={() => dispatch({ type: 'READY_ALL', at: at() })}>Everyone's ready</button>
      </div>
    </>
  );
}

function AgendaView({ game, dispatch }: Props) {
  const a = game.agenda!;
  const voter = currentVoter(game);
  if (game.quietAgenda) {
    return (
      <>
        <div className="eyebrow">Round {game.round} · Agenda phase</div>
        <h2 className="center__title">Agenda phase</h2>
        <p className="center__hint">The buttons are resting. Vote at the table, then start the next round.</p>
        <div className="center__actions">
          <button type="button" className="btn btn--gold" onClick={() => dispatch({ type: 'ADVANCE', at: at() })}>Start the next round</button>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="eyebrow">Round {game.round} · Agenda phase</div>
      <h2 className="center__title">Agenda {a.n} of 2</h2>
      {voter != null && <div className="center__active"><Who game={game} seat={voter} big /></div>}
      <p className="center__hint">Cast your votes, then tap your button. The speaker votes last.</p>
      <div className="voters">
        {a.order.map((s, i) => (
          <span key={s} className="voter" data-state={i < a.idx ? 'done' : i === a.idx ? 'now' : 'next'} style={{ '--pc': colorById(game.players[s].color).led } as CSSProperties}>
            {game.players[s].name}
          </span>
        ))}
      </div>
      <div className="center__actions">
        <button type="button" className="btn btn--sm" onClick={() => dispatch({ type: 'VOTE_DONE', at: at() })}>Vote done</button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => dispatch({ type: 'ADVANCE', at: at() })}>Skip to next round</button>
      </div>
    </>
  );
}

function FinishedView({ game, onUndo, onNewGame }: Props) {
  const w = game.winner!;
  const total = game.players.reduce((t, p) => t + p.timeMs, 0);
  return (
    <>
      <div className="crown"><IconCrown /></div>
      <div className="eyebrow">Pax Magnifica, Bellum Gloriosum</div>
      <h2 className="center__active"><Who game={game} seat={w} big /></h2>
      <div className="center__faction">claims the throne in round {game.round} · {formatClock(total)} of turns played</div>
      <div className="center__actions">
        <button type="button" className="btn btn--sm" onClick={onUndo}>Undo — not so fast</button>
        <button type="button" className="btn btn--sm btn--gold" onClick={onNewGame}>New game</button>
      </div>
    </>
  );
}
